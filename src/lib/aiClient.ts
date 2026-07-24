export interface PoemResponse {
  content: string;
}

export interface PoemAttribution {
  author: string;
  poem_title: string;
  source_url: string;
  method: 'ai_cross_verified' | 'database';
}

const ATTRIBUTION_CACHE_KEY = 'blindpoem.attributionCache.v6';
const VERIFIED_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type AttributionCacheEntry = {
  attribution: PoemAttribution | null;
  expiresAt: number;
};

function normalizePoemCacheKey(content: string): string {
  return content.toLowerCase().replace(/[\s，。、；！？,.!?;:：“”"'‘’《》]/g, '');
}

function readAttributionCache(): Record<string, AttributionCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ATTRIBUTION_CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAttributionCache(cache: Record<string, AttributionCacheEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    const liveEntries = Object.entries(cache)
      .filter(([, entry]) => entry?.expiresAt > Date.now())
      .slice(-100);
    window.localStorage.setItem(ATTRIBUTION_CACHE_KEY, JSON.stringify(Object.fromEntries(liveEntries)));
  } catch {
    // Verification remains available when storage is unavailable or full.
  }
}

/**
 * 根据心情关键词生成诗句（调用后端 Vercel Function）
 * API Key 只在服务端使用，前端不会暴露密钥。
 */
export async function generatePoem(
  keyword: string,
  moodName: string
): Promise<PoemResponse> {
  console.log(`🎯 生成诗句 - 关键词: ${keyword}, 心情: ${moodName}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.log('⏱️ API 请求超时（27秒），将从数据库读取备用诗句');
  }, 27000);

  try {
    const response = await fetch('/api/generate-poem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        moodName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const poemData: PoemResponse = await response.json();
    console.log('✅ 诗句生成成功:', poemData);

    if (!poemData.content) {
      throw new Error('Invalid poem data from API');
    }

    return poemData;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ 诗句生成失败:', error);
    throw error;
  }
}

export async function verifyPoemAttribution(
  content: string,
  signal?: AbortSignal
): Promise<PoemAttribution | null> {
  if (signal?.aborted) return null;
  const cacheKey = normalizePoemCacheKey(content);
  const cache = readAttributionCache();
  const cached = cache[cacheKey];
  if (cached?.expiresAt > Date.now()) return cached.attribution;

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    const response = await fetch('/api/verify-poem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json() as {
      attribution?: PoemAttribution | null;
      verification_status?: string;
    };
    const attribution = data.attribution || null;
    const shouldCacheMiss = [
      'no_matching_source',
      'partial_poem_match',
      'ai_partial_match',
      'candidate_not_supported',
      'not_found_cache',
      'not_found_database',
    ].includes(data.verification_status || '');
    if (attribution || shouldCacheMiss) {
      cache[cacheKey] = {
        attribution,
        expiresAt: Date.now() + (attribution ? VERIFIED_CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS),
      };
      writeAttributionCache(cache);
    }
    return attribution;
  } catch (error) {
    console.warn('诗句出处核验失败，本次仅展示诗句：', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

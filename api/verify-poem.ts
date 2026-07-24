import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 30 };

type SearchResult = {
  id: number;
  title: string;
  content: string;
  rawContent: string;
  url: string;
};

type Attribution = {
  author: string;
  poem_title: string;
  source_url: string;
  method: 'ai_cross_verified' | 'database';
};

type VerificationStatus = 'pending' | 'verified' | 'not_found' | 'retryable_error';

type StoredPoem = {
  author: string | null;
  poem_title: string | null;
  source_url: string | null;
  attribution_status: VerificationStatus;
  verification_reason: string | null;
  verification_attempted_at: string | null;
};

const SEARCH_TIMEOUT_MS = 6000;
const AI_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RETRYABLE_ERROR_COOLDOWN_MS = 60 * 60 * 1000;
const AI_REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_VERSION = 'ai_cross_search_v3';
const attributionCache = new Map<string, { attribution: Attribution | null; expiresAt: number }>();
const rateWindows = new Map<string, { count: number; resetAt: number }>();
let tavilyQuotaBlockedUntil = 0;
let tavilyUsageCheckedAt = 0;

class TavilyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
    public readonly retryAfterSeconds: number | null
  ) {
    super(`Tavily API Error: ${status}`);
  }
}

function getNextMonthStart(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
}

function isTavilyQuotaBlocked(): boolean {
  return tavilyQuotaBlockedUntil > Date.now();
}

async function refreshTavilyQuotaStatus(): Promise<void> {
  if (isTavilyQuotaBlocked() || Date.now() - tavilyUsageCheckedAt < 10 * 60 * 1000) return;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return;
  tavilyUsageCheckedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch('https://api.tavily.com/usage', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return;
    const data = await response.json() as { key?: { usage?: unknown; limit?: unknown } };
    const usage = Number(data.key?.usage);
    const limit = Number(data.key?.limit);
    if (Number.isFinite(usage) && Number.isFinite(limit) && limit > 0 && usage >= limit) {
      tavilyQuotaBlockedUntil = getNextMonthStart();
    }
  } catch {
    // A failed usage check must not be confused with exhausted search credits.
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s，。、；！？,.!?;:：“”"'‘’《》〈〉「」『』（）()【】{}]/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '');
}

function getSupabaseAdminConfig(): { url: string; key: string } | null {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
  const key = String(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return url && key ? { url, key } : null;
}

function getSupabaseAdminHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_secret_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

async function getStoredPoem(contentKey: string): Promise<StoredPoem | null> {
  const config = getSupabaseAdminConfig();
  if (!config) return null;
  const query = new URLSearchParams({
    select: 'author,poem_title,source_url,attribution_status,verification_reason,verification_attempted_at',
    content_key: `eq.${contentKey}`,
    limit: '20',
  });
  try {
    const response = await fetch(`${config.url}/rest/v1/poems?${query}`, {
      headers: getSupabaseAdminHeaders(config.key),
    });
    if (!response.ok) {
      console.warn('Supabase attribution lookup failed:', response.status);
      return null;
    }
    const rows = await response.json() as StoredPoem[];
    return rows.find((row) => (
      row.attribution_status === 'verified' && row.author?.trim() && row.poem_title?.trim()
    )) || rows.find((row) => row.attribution_status === 'not_found') || rows[0] || null;
  } catch (error) {
    console.warn('Supabase attribution lookup unavailable:', error);
    return null;
  }
}

async function persistVerification(
  content: string,
  status: VerificationStatus,
  reason: string,
  attribution: Attribution | null = null
): Promise<void> {
  const config = getSupabaseAdminConfig();
  if (!config) return;
  try {
    const now = new Date().toISOString();
    const contentKey = normalize(content);
    const verificationFields = {
      poem_title: attribution?.poem_title || null,
      author: attribution?.author || null,
      source_url: attribution?.source_url || null,
      attribution_status: status,
      verification_reason: status === 'not_found' ? `${reason}:${VERIFICATION_VERSION}` : reason,
      verification_attempted_at: now,
      verified_at: status === 'verified' ? now : null,
    };
    const updateQuery = new URLSearchParams({ content_key: `eq.${contentKey}` });
    const updateResponse = await fetch(`${config.url}/rest/v1/poems?${updateQuery}`, {
      method: 'PATCH',
      headers: {
        ...getSupabaseAdminHeaders(config.key),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(verificationFields),
    });
    if (!updateResponse.ok) {
      console.warn('Supabase attribution update failed:', updateResponse.status, await updateResponse.text());
      return;
    }
    const updatedRows = await updateResponse.json() as unknown[];
    if (updatedRows.length > 0) return;

    const insertResponse = await fetch(`${config.url}/rest/v1/poems`, {
      method: 'POST',
      headers: {
        ...getSupabaseAdminHeaders(config.key),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ content, content_key: contentKey, ...verificationFields }),
    });
    if (!insertResponse.ok && insertResponse.status !== 409) {
      console.warn('Supabase attribution insert failed:', insertResponse.status, await insertResponse.text());
    }
  } catch (error) {
    console.warn('Supabase attribution persistence unavailable:', error);
  }
}

function isRateLimited(req: VercelRequest): boolean {
  const forwarded = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = rateWindows.get(forwarded);
  if (!current || current.resetAt <= now) {
    rateWindows.set(forwarded, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 20;
}

function poemFragments(content: string): string[] {
  const fragments = content
    .split(/[\n/／\\|，。、；！？,.!?;:：]+/)
    .map((part) => normalize(part))
    .filter((part) => part.length >= 5)
    .sort((a, b) => b.length - a.length);

  return [...new Set([normalize(content), ...fragments])].filter(Boolean);
}

function isMostlyLatin(content: string): boolean {
  const latinCount = content.match(/[a-z]/gi)?.length || 0;
  const hanCount = content.match(/[\u3400-\u9fff]/g)?.length || 0;
  return latinCount >= 8 && latinCount > hanCount * 2;
}

function containsOrderedEnglishPoem(text: string, content: string): boolean {
  if (!isMostlyLatin(content)) return false;

  const fragments = content
    .split(/[\n/／\\|，。、；！？,.!?;:：]+/)
    .map((part) => normalize(part))
    .filter((part) => part.length >= 6);
  if (fragments.length < 2) return false;

  const normalizedText = normalize(text);
  let cursor = 0;
  for (const fragment of fragments) {
    const index = normalizedText.indexOf(fragment, cursor);
    if (index < 0) return false;
    cursor = index + fragment.length;
  }
  return true;
}

function searchResultTexts(result: SearchResult): string[] {
  return [result.title, result.content, result.rawContent];
}

function containsPoem(result: SearchResult, content: string): boolean {
  const completePoem = normalize(content);
  if (!completePoem) return false;

  // Attribution is attached to the whole displayed excerpt, so a source must
  // contain that whole excerpt. Matching only one clause must never authorize
  // an author/title for synthetic text joined to a genuine quotation.
  return searchResultTexts(result).some((text) => (
    normalize(text).includes(completePoem) || containsOrderedEnglishPoem(text, content)
  ));
}

function containsPartialPoem(result: SearchResult, content: string): boolean {
  const fullPoem = normalize(content);
  const haystacks = searchResultTexts(result).map(normalize);
  if (haystacks.some((text) => text.includes(fullPoem))) return false;

  const fragments = poemFragments(content).filter((fragment) => (
    fragment !== fullPoem && fragment.length >= 6
  ));
  return fragments.some((fragment) => haystacks.some((text) => text.includes(fragment)));
}

async function tavilySearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY');

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topic: 'general',
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
        include_raw_content: true,
        include_images: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
        ? Number(retryAfterHeader)
        : null;
      if (response.status === 432 || response.status === 433) {
        tavilyQuotaBlockedUntil = getNextMonthStart();
      }
      throw new TavilyApiError(response.status, responseBody, retryAfterSeconds);
    }

    const data = await response.json() as {
      results?: Array<{ title?: unknown; content?: unknown; raw_content?: unknown; url?: unknown }>;
    };

    return (data.results || []).map((result, id) => ({
      id,
      title: String(result.title || '').trim(),
      content: String(result.content || '').trim(),
      rawContent: String(result.raw_content || '').trim(),
      url: String(result.url || '').trim(),
    })).filter((result) => result.title && result.url);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function cleanCandidate(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^(?:作者|诗人|词人|原作者)[：:\s]*/i, '')
    .replace(/(?:原文|翻译|赏析|全文|古诗|诗词).*$/i, '')
    .replace(/^[《》“”"'‘’\s]+|[《》“”"'‘’\s]+$/g, '')
    .trim();
}

function isPlausibleAuthor(author: string): boolean {
  const invalid = /^(?:字词|字词网|词典|译文|注释|赏析|原文|作者|诗人|词人|作品|古诗|诗词|首页|佚名|匿名|未知)$/i;
  if (!author || invalid.test(author)) return false;
  if (/^[\p{Script=Han}]+$/u.test(author) && author.length > 6) return false;
  return author.length <= 40;
}

function isPlausibleTitle(title: string): boolean {
  const invalid = /^(?:字词|译文|注释|赏析|原文|作者|诗人|词人|作品|古诗|诗词|未知)$/i;
  return Boolean(title) && !invalid.test(title) && title.length <= 80;
}
type CandidateResult =
  | { status: 'found'; author: string; poem_title: string }
  | { status: 'unknown' }
  | { status: 'retryable_error'; reason: string };

type ReviewResult =
  | { status: 'exact' | 'partial' | 'incorrect' | 'uncertain' }
  | { status: 'retryable_error'; reason: string };

async function callDeepSeek(
  system: string,
  user: string,
  maxTokens: number,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch (error) {
    console.warn('DeepSeek poem attribution call failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

async function identifyCandidate(content: string, signal?: AbortSignal): Promise<CandidateResult> {
  const parsed = await callDeepSeek(
    '判断整段诗句的真实作者和篇名。不得只凭其中一个名句推断；疑似拼接、改写、生成文本或不确定时返回u。只返回JSON。',
    `q=${JSON.stringify(content)}\n返回：{"s":"f|u","a":"作者","t":"篇名"}`,
    80,
    signal
  );
  if (!parsed) return { status: 'retryable_error', reason: 'ai_candidate_error' };
  if (parsed.s === 'u') return { status: 'unknown' };
  if (parsed.s !== 'f') return { status: 'retryable_error', reason: 'ai_candidate_format_error' };

  const author = cleanCandidate(String(parsed.a || ''));
  const poemTitle = cleanCandidate(String(parsed.t || ''));
  return isPlausibleAuthor(author) && isPlausibleTitle(poemTitle)
    ? { status: 'found', author, poem_title: poemTitle }
    : { status: 'retryable_error', reason: 'ai_candidate_format_error' };
}

async function reviewCandidate(
  content: string,
  author: string,
  poemTitle: string,
  signal?: AbortSignal
): Promise<ReviewResult> {
  const parsed = await callDeepSeek(
    '核查整段诗句的出处声明，优先找错。整段精确属于该作品才返回e；仅部分属于返回p；作者或篇名错误返回i；无把握返回u。不要顺从声明。只返回JSON。',
    `a=${JSON.stringify(author)}\nt=${JSON.stringify(poemTitle)}\nq=${JSON.stringify(content)}\n返回：{"s":"e|p|i|u"}`,
    40,
    signal
  );
  if (!parsed) return { status: 'retryable_error', reason: 'ai_review_error' };
  if (parsed.s === 'e') return { status: 'exact' };
  if (parsed.s === 'p') return { status: 'partial' };
  if (parsed.s === 'i') return { status: 'incorrect' };
  if (parsed.s === 'u') return { status: 'uncertain' };
  return { status: 'retryable_error', reason: 'ai_review_format_error' };
}

function findCandidateEvidence(
  sources: SearchResult[],
  content: string,
  author: string,
  title: string
): SearchResult | null {
  const normalizedAuthor = normalize(author);
  const normalizedTitle = normalize(title);
  if (!normalizedAuthor || !normalizedTitle) return null;

  const evidence = sources.map((source) => {
    const text = normalize(searchResultTexts(source).join(' '));
    return {
      source,
      hasPoem: containsPoem(source, content),
      hasAuthor: text.includes(normalizedAuthor),
      hasTitle: text.includes(normalizedTitle),
    };
  });
  const jointEvidence = evidence.find((item) => item.hasPoem && item.hasAuthor && item.hasTitle);
  return jointEvidence?.source || null;
}

function getRetryCooldownMs(reason: string | null): number {
  return /^(?:ai_unknown|ai_candidate_rejected|ai_review_uncertain)$/.test(reason || '')
    ? AI_REJECTION_COOLDOWN_MS
    : RETRYABLE_ERROR_COOLDOWN_MS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Missing poem content' });
  if (content.length > 160) return res.status(400).json({ error: 'Poem content is too long' });

  const clientConnection = new AbortController();
  const abortDisconnectedClient = () => clientConnection.abort();
  req.once('aborted', abortDisconnectedClient);
  res.once('close', () => {
    if (!res.writableEnded) abortDisconnectedClient();
  });

  const cacheKey = normalize(content);
  const storedPoem = await getStoredPoem(cacheKey);
  if (
    storedPoem?.attribution_status === 'verified' &&
    isPlausibleAuthor(storedPoem.author?.trim() || '') &&
    isPlausibleTitle(storedPoem.poem_title?.trim() || '')
  ) {
    const attribution: Attribution = {
      author: storedPoem.author.trim(),
      poem_title: storedPoem.poem_title.trim(),
      source_url: storedPoem.source_url?.trim() || '',
      method: 'database',
    };
    attributionCache.set(cacheKey, { attribution, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.status(200).json({ attribution, verification_status: 'verified_database' });
  }
  if (
    storedPoem?.attribution_status === 'not_found' &&
    storedPoem.verification_reason?.endsWith(`:${VERIFICATION_VERSION}`)
  ) {
    attributionCache.set(cacheKey, { attribution: null, expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS });
    return res.status(200).json({ attribution: null, verification_status: 'not_found_database' });
  }
  if (
    storedPoem?.attribution_status === 'retryable_error' &&
    storedPoem.verification_attempted_at &&
    Date.now() - new Date(storedPoem.verification_attempted_at).getTime()
      < getRetryCooldownMs(storedPoem.verification_reason)
  ) {
    return res.status(200).json({ attribution: null, verification_status: 'retryable_error_cooldown' });
  }

  const cached = attributionCache.get(cacheKey);
  if (cached?.expiresAt && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      attribution: cached.attribution,
      verification_status: cached.attribution ? 'verified_cache' : 'not_found_cache',
    });
  }
  if (isRateLimited(req)) return res.status(429).json({ error: 'Too many requests' });
  if (!process.env.DEEPSEEK_API_KEY) {
    await persistVerification(content, 'retryable_error', 'missing_deepseek_key');
    return res.status(200).json({ attribution: null, verification_status: 'missing_deepseek_key' });
  }

  try {
    const candidate = await identifyCandidate(content, clientConnection.signal);
    if (clientConnection.signal.aborted) return;
    if (candidate.status === 'retryable_error') {
      await persistVerification(content, 'retryable_error', candidate.reason);
      return res.status(200).json({ attribution: null, verification_status: candidate.reason });
    }
    if (candidate.status === 'unknown') {
      await persistVerification(content, 'retryable_error', 'ai_unknown');
      return res.status(200).json({ attribution: null, verification_status: 'ai_unknown' });
    }

    const review = await reviewCandidate(
      content,
      candidate.author,
      candidate.poem_title,
      clientConnection.signal
    );
    if (clientConnection.signal.aborted) return;
    if (review.status === 'retryable_error') {
      await persistVerification(content, 'retryable_error', review.reason);
      return res.status(200).json({ attribution: null, verification_status: review.reason });
    }
    if (review.status === 'partial') {
      attributionCache.set(cacheKey, { attribution: null, expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS });
      await persistVerification(content, 'not_found', 'ai_partial_match');
      return res.status(200).json({ attribution: null, verification_status: 'ai_partial_match' });
    }
    if (review.status === 'incorrect') {
      await persistVerification(content, 'retryable_error', 'ai_candidate_rejected');
      return res.status(200).json({ attribution: null, verification_status: 'ai_candidate_rejected' });
    }
    if (review.status === 'uncertain') {
      await persistVerification(content, 'retryable_error', 'ai_review_uncertain');
      return res.status(200).json({ attribution: null, verification_status: 'ai_review_uncertain' });
    }

    if (!process.env.TAVILY_API_KEY) {
      await persistVerification(content, 'retryable_error', 'missing_tavily_key');
      return res.status(200).json({ attribution: null, verification_status: 'missing_tavily_key' });
    }
    await refreshTavilyQuotaStatus();
    if (isTavilyQuotaBlocked()) {
      await persistVerification(content, 'retryable_error', 'tavily_quota_exhausted');
      return res.status(200).json({ attribution: null, verification_status: 'search_quota_exhausted' });
    }

    const searchableExcerpt = content.replace(/[\n/／\\|]+/g, ' ').replace(/\s+/g, ' ').trim();
    const verificationQuery = `"${searchableExcerpt}" "${candidate.author}" "${candidate.poem_title}"`;
    const searchResults = await tavilySearch(verificationQuery, clientConnection.signal);
    if (clientConnection.signal.aborted) return;
    const matchingSources = searchResults.filter((result) => containsPoem(result, content));
    if (matchingSources.length === 0) {
      const reason = searchResults.some((result) => containsPartialPoem(result, content))
        ? 'partial_poem_match'
        : 'no_matching_source';
      attributionCache.set(cacheKey, { attribution: null, expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS });
      await persistVerification(content, 'not_found', reason);
      return res.status(200).json({ attribution: null, verification_status: reason });
    }

    const evidenceSource = findCandidateEvidence(
      matchingSources,
      content,
      candidate.author,
      candidate.poem_title
    );

    const attribution: Attribution | null = evidenceSource ? {
        author: candidate.author,
        poem_title: candidate.poem_title,
        source_url: evidenceSource.url,
        method: 'ai_cross_verified',
      } : null;
    attributionCache.set(cacheKey, {
      attribution,
      expiresAt: Date.now() + (attribution ? CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS),
    });
    await persistVerification(
      content,
      attribution ? 'verified' : 'not_found',
      attribution ? 'verified_ai_cross_search' : 'candidate_not_supported',
      attribution
    );
    return res.status(200).json({
      attribution,
      verification_status: attribution ? 'verified' : 'candidate_not_supported',
    });
  } catch (error) {
    if (clientConnection.signal.aborted) return;
    console.error('Poem verification failed:', error);
    if (error instanceof TavilyApiError && (error.status === 432 || error.status === 433)) {
      await persistVerification(content, 'retryable_error', `tavily_quota_${error.status}`);
      return res.status(200).json({ attribution: null, verification_status: 'search_quota_exhausted' });
    }
    await persistVerification(content, 'retryable_error', 'verification_error');
    return res.status(200).json({ attribution: null, verification_status: 'verification_error' });
  }
}

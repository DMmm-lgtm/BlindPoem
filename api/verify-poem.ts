import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 30 };

type SearchResult = {
  id: number;
  title: string;
  content: string;
  url: string;
};

type Attribution = {
  author: string;
  poem_title: string;
  source_url: string;
  method: 'rules' | 'ai_fallback';
};

const SEARCH_TIMEOUT_MS = 6000;
const AI_TIMEOUT_MS = 6000;
const MAX_SNIPPET_LENGTH = 500;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 10 * 60 * 1000;
const attributionCache = new Map<string, { attribution: Attribution | null; expiresAt: number }>();
const rateWindows = new Map<string, { count: number; resetAt: number }>();

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s，。、；！？,.!?;:：“”"'‘’《》〈〉「」『』（）()【】{}]/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '');
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

function getSearchablePoemFragment(content: string): string {
  return content
    .split(/[\n/／\\|，。、；！？,.!?;:：]+/)
    .map((part) => part.trim())
    .filter((part) => normalize(part).length >= 5)
    .sort((a, b) => normalize(b).length - normalize(a).length)[0] || content;
}

function extractRelevantSnippet(rawContent: string, poemContent: string, fallback: string): string {
  if (!rawContent) return fallback.slice(0, MAX_SNIPPET_LENGTH);

  const normalizedChars: string[] = [];
  const originalPositions: number[] = [];
  [...rawContent].forEach((character, index) => {
    const normalizedCharacter = normalize(character);
    if (!normalizedCharacter) return;
    normalizedChars.push(normalizedCharacter);
    originalPositions.push(index);
  });
  const normalizedRaw = normalizedChars.join('');
  const fragment = poemFragments(poemContent).find((candidate) => normalizedRaw.includes(candidate));
  if (!fragment) return fallback.slice(0, MAX_SNIPPET_LENGTH);

  const normalizedIndex = normalizedRaw.indexOf(fragment);
  const originalIndex = originalPositions[normalizedIndex] ?? 0;
  const start = Math.max(0, originalIndex - 100);
  const summary = fallback.trim().slice(0, 200);
  const rawExcerpt = rawContent.slice(start, start + 300).trim();
  return [summary, rawExcerpt].filter(Boolean).join('\n').slice(0, MAX_SNIPPET_LENGTH);
}

function containsPoem(result: SearchResult, content: string): boolean {
  const haystack = normalize(`${result.title} ${result.content}`);
  const fragments = poemFragments(content);
  return fragments.some((fragment, index) => (
    index === 0 ? haystack.includes(fragment) : fragment.length >= 6 && haystack.includes(fragment)
  ));
}

function isMostlyChinese(content: string): boolean {
  const chineseCount = content.match(/[\u3400-\u9fff]/g)?.length || 0;
  const visibleCount = content.replace(/\s/g, '').length || 1;
  return chineseCount / visibleCount >= 0.3;
}

async function tavilySearch(query: string, poemContent: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Missing TAVILY_API_KEY');

  const controller = new AbortController();
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
        max_results: 8,
        include_answer: false,
        include_raw_content: true,
        include_images: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Tavily API Error: ${response.status}`);
    }

    const data = await response.json() as {
      results?: Array<{ title?: unknown; content?: unknown; raw_content?: unknown; url?: unknown }>;
    };

    return (data.results || []).map((result, id) => ({
      id,
      title: String(result.title || '').trim(),
      content: extractRelevantSnippet(
        String(result.raw_content || ''),
        poemContent,
        String(result.content || '').trim()
      ),
      url: String(result.url || '').trim(),
    })).filter((result) => result.title && result.url);
  } finally {
    clearTimeout(timeout);
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
  const invalid = /^(?:字词|译文|注释|赏析|原文|作者|诗人|词人|作品|古诗|诗词|佚名|匿名|未知)$/i;
  if (!author || invalid.test(author)) return false;
  if (/^[\p{Script=Han}]+$/u.test(author) && author.length > 6) return false;
  return author.length <= 40;
}

function getSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function extractWithRules(sources: SearchResult[]): Attribution | null {
  const titlePatterns = [
    /《([^《》]{1,60})》/,
    /(?:出自|作品|篇名)[：:\s]*[《“"]?([^《》“”"，。；;]{2,60})[》”"]?/,
  ];
  const authorPatterns = [
    /作者[：:\s]+([\p{L}·.-]{2,40})/u,
    /(?:唐代|宋代|元代|明代|清代|近代|现代|当代)?(?:诗人|词人|作家)[：:\s]*([\p{L}·.-]{2,40}?)(?:创作|所作|写作|的作品|的诗)/u,
    /(?:^|[|｜_—-])([\p{Script=Han}]{2,4})《/u,
    /》([\p{Script=Han}]{2,4})(?:$|[|｜_—-])/u,
  ];

  const candidates = sources.flatMap((source) => {
    const text = `${source.title}\n${source.content}`;
    const title = titlePatterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
    const author = authorPatterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
    const cleanedTitle = title ? cleanCandidate(title) : '';
    const cleanedAuthor = author ? cleanCandidate(author) : '';
    return cleanedTitle && isPlausibleAuthor(cleanedAuthor)
      ? [{ author: cleanedAuthor, poem_title: cleanedTitle, source }]
      : [];
  });

  for (const candidate of candidates) {
    const agreeingCandidates = candidates.filter((other) => (
      normalize(other.author) === normalize(candidate.author) &&
      normalize(other.poem_title) === normalize(candidate.poem_title)
    ));
    const agreementDomains = new Set(
      agreeingCandidates.map((other) => getSourceDomain(other.source.url))
    );

    if (agreementDomains.size >= 2) {
      return {
        author: candidate.author,
        poem_title: candidate.poem_title,
        source_url: candidate.source.url,
        method: 'rules',
      };
    }
  }

  return null;
}

async function extractWithDeepSeek(content: string, sources: SearchResult[]): Promise<{
  author: string;
  poem_title: string;
  source_id: number;
  evidence: string;
} | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || sources.length === 0) return null;

  const controller = new AbortController();
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
          {
            role: 'system',
            content: 'You propose a poem attribution candidate from the supplied web-search results. You may use literary knowledge when snippets are incomplete, but the backend will reject any author or title not supported by those results. Return JSON only.',
          },
          {
            role: 'user',
            content: `待核验诗句：${content}\n搜索片段：${JSON.stringify(sources.map(({ id, title, content: snippet }) => ({ id, title, snippet })))}\n请从搜索结果中提取最可能的作者和作品篇名。片段信息不完整时可以用文学知识提出候选，但候选最终必须能被同一批搜索结果支持。必须引用一个确实包含待核验诗句的 source_id 和原文 evidence。无法提出单一候选、只有相似句或结果冲突时返回 not_found。返回：{"status":"found|not_found","author":"","poem_title":"","source_id":0,"evidence":""}`,
          },
        ],
        temperature: 0,
        max_tokens: 180,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.status !== 'found') return null;

    const author = cleanCandidate(String(parsed.author || ''));
    const poemTitle = cleanCandidate(String(parsed.poem_title || ''));
    const sourceId = Number(parsed.source_id);
    const evidence = String(parsed.evidence || '').trim();
    const source = sources.find((item) => item.id === sourceId);

    if (!isPlausibleAuthor(author) || !poemTitle || !source || !evidence) return null;
    if (!normalize(`${source.title} ${source.content}`).includes(normalize(evidence))) return null;

    return { author, poem_title: poemTitle, source_id: sourceId, evidence };
  } catch (error) {
    console.warn('DeepSeek attribution fallback failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function findCandidateEvidence(
  sources: SearchResult[],
  content: string,
  author: string,
  title: string
): SearchResult | null {
  const normalizedAuthor = normalize(author);
  const titleParts = title.split(/[·:：()（）\s]+/).map(normalize).filter((part) => part.length >= 2);
  if (!normalizedAuthor || titleParts.length === 0) return null;

  const evidence = sources.map((source) => {
    const text = normalize(`${source.title} ${source.content}`);
    return {
      source,
      hasPoem: containsPoem(source, content),
      hasAuthor: text.includes(normalizedAuthor),
      hasTitle: titleParts.some((part) => text.includes(part)),
    };
  });
  const jointEvidence = evidence.find((item) => item.hasPoem && item.hasAuthor && item.hasTitle);
  if (jointEvidence) return jointEvidence.source;

  const poemAuthorEvidence = evidence.find((item) => item.hasPoem && item.hasAuthor);
  const poemTitleEvidence = evidence.find((item) => item.hasPoem && item.hasTitle);
  return poemAuthorEvidence && poemTitleEvidence
    ? poemTitleEvidence.source
    : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isRateLimited(req)) return res.status(429).json({ error: 'Too many requests' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Missing poem content' });
  if (content.length > 160) return res.status(400).json({ error: 'Poem content is too long' });
  if (!process.env.TAVILY_API_KEY) {
    return res.status(200).json({ attribution: null, verification_status: 'missing_tavily_key' });
  }

  const cacheKey = normalize(content);
  const cached = attributionCache.get(cacheKey);
  if (cached?.expiresAt && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      attribution: cached.attribution,
      verification_status: cached.attribution ? 'verified_cache' : 'not_found_cache',
    });
  }

  try {
    const searchableFragment = getSearchablePoemFragment(content);
    const discoveryQuery = isMostlyChinese(content)
      ? `"${searchableFragment}" 作者`
      : `"${searchableFragment}" author`;
    const searchResults = await tavilySearch(discoveryQuery, content);
    const matchingSources = searchResults.filter((result) => containsPoem(result, content)).slice(0, 5);
    if (matchingSources.length === 0) {
      attributionCache.set(cacheKey, { attribution: null, expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS });
      return res.status(200).json({ attribution: null, verification_status: 'no_matching_source' });
    }

    const ruleAttribution = extractWithRules(matchingSources);
    const aiCandidate = ruleAttribution ? null : await extractWithDeepSeek(content, matchingSources);
    const candidate = ruleAttribution ? {
      author: ruleAttribution.author,
      poem_title: ruleAttribution.poem_title,
      method: 'rules' as const,
    } : aiCandidate ? {
      author: aiCandidate.author,
      poem_title: aiCandidate.poem_title,
      method: 'ai_fallback' as const,
    } : null;
    if (!candidate) {
      attributionCache.set(cacheKey, { attribution: null, expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS });
      return res.status(200).json({ attribution: null, verification_status: 'no_attribution_candidate' });
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
        method: candidate.method,
      } : null;
    attributionCache.set(cacheKey, {
      attribution,
      expiresAt: Date.now() + (attribution ? CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS),
    });
    return res.status(200).json({
      attribution,
      verification_status: attribution ? 'verified' : 'candidate_not_supported',
    });
  } catch (error) {
    console.error('Poem verification failed:', error);
    return res.status(200).json({ attribution: null, verification_status: 'verification_error' });
  }
}

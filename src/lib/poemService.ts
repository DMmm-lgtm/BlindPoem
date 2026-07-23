import { isSupabaseConfigured, supabase } from './supabaseClient';
import type { Poem } from './supabaseClient';

const LOCAL_FALLBACK_POEMS: Poem[] = [
  {
    content: '行到水穷处，坐看云起时',
    poem_title: '终南别业',
    author: '王维',
    mood: 'calm',
  },
  {
    content: '山中何事？松花酿酒，春水煎茶',
    poem_title: '人月圆·山中书事',
    author: '张可久',
    mood: 'peaceful',
  },
  {
    content: '吹灭读书灯，一身都是月',
    poem_title: '吹灭读书灯',
    author: '孙玉石',
    mood: 'quiet',
  },
  {
    content: '我有一瓢酒，可以慰风尘',
    poem_title: '简卢陟',
    author: '韦应物',
    mood: 'weary',
  },
  {
    content: '海上生明月，天涯共此时',
    poem_title: '望月怀远',
    author: '张九龄',
    mood: 'longing',
  },
  {
    content: '且将新火试新茶，诗酒趁年华',
    poem_title: '望江南·超然台作',
    author: '苏轼',
    mood: 'hopeful',
  },
  {
    content: '树深时见鹿，溪午不闻钟',
    poem_title: '访戴天山道士不遇',
    author: '李白',
    mood: 'dreamy',
  },
  {
    content: '玻璃晴朗，橘子辉煌',
    poem_title: '过节',
    author: '北岛',
    mood: 'bright',
  },
];

const LOCAL_POEM_CACHE_KEY = 'blindpoem.localPoems.v2';
const MAX_LOCAL_POEMS = 80;
const RECENT_POEMS_KEY = 'blindpoem.recentPoems.v1';
const MAX_RECENT_POEMS = 20;
const INVALID_AUTHOR_PATTERN = /^(未知|佚名|匿名|无|anonymous|unknown)$/i;

function hasKnownAuthor(poem: Pick<Poem, 'author'>): boolean {
  const author = String(poem.author || '').trim();
  return Boolean(author) && !INVALID_AUTHOR_PATTERN.test(author);
}

function readLocalPoems(): Poem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_POEM_CACHE_KEY);
    if (!raw) {
      return [];
    }

    const poems = JSON.parse(raw) as Poem[];
    return Array.isArray(poems)
      ? poems.filter((poem) => poem && poem.content && hasKnownAuthor(poem))
      : [];
  } catch (error) {
    console.warn('⚠️ 读取本地诗句缓存失败：', error);
    return [];
  }
}

function savePoemToLocalCache(poem: Poem): boolean {
  if (!hasKnownAuthor(poem)) {
    console.info('ℹ️ 跳过保存匿名/未知作者诗句');
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const existingPoems = readLocalPoems();
    const withoutDuplicate = existingPoems.filter(
      (existingPoem) => existingPoem.content !== poem.content
    );
    const nextPoems = [
      {
        ...poem,
        created_at: poem.created_at || new Date().toISOString(),
      },
      ...withoutDuplicate,
    ].slice(0, MAX_LOCAL_POEMS);

    window.localStorage.setItem(LOCAL_POEM_CACHE_KEY, JSON.stringify(nextPoems));
    return true;
  } catch (error) {
    console.warn('⚠️ 写入本地诗句缓存失败：', error);
    return false;
  }
}

function normalizePoemContent(content: string): string {
  return content.replace(/[\s，。、；！？,.!?;:：“”"'‘’《》]/g, '').toLowerCase();
}

export function readRecentPoemContents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_POEMS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_POEMS)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentPoem(content: string): void {
  if (typeof window === 'undefined' || !content.trim()) return;
  const normalized = normalizePoemContent(content);
  const next = [content, ...readRecentPoemContents().filter(
    (item) => normalizePoemContent(item) !== normalized
  )].slice(0, MAX_RECENT_POEMS);
  window.localStorage.setItem(RECENT_POEMS_KEY, JSON.stringify(next));
}

function getLocalFallbackPoem(excludedContents: string[] = []): Poem {
  const cachedPoems = readLocalPoems();
  const localFallbackPoems = LOCAL_FALLBACK_POEMS.filter(hasKnownAuthor);
  const excluded = new Set(excludedContents.map(normalizePoemContent));
  const combinedPool = [...cachedPoems, ...localFallbackPoems].filter(
    (poem, index, poems) => poems.findIndex(
      (candidate) => normalizePoemContent(candidate.content) === normalizePoemContent(poem.content)
    ) === index
  );
  const freshPool = combinedPool.filter((poem) => !excluded.has(normalizePoemContent(poem.content)));
  const poemPool = freshPool.length > 0 ? freshPool : combinedPool;
  const randomIndex = Math.floor(Math.random() * poemPool.length);
  return poemPool[randomIndex];
}

/**
 * 检查诗句是否已存在
 */
async function isPoemExists(content: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from('poems')
    .select('id')
    .eq('content', content)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = 没有找到记录，这是正常的
    console.error('查询诗句失败：', error);
  }

  return data !== null;
}

/**
 * 保存诗句到 Supabase（唯一性检查）
 */
export async function savePoemToDatabase(
  content: string,
  poem_title: string,
  author: string,
  mood: string,
  source_url?: string
): Promise<boolean> {
  const poemToSave: Poem = {
    content,
    content_key: normalizePoemContent(content),
    poem_title,
    author,
    source_url,
    attribution_status: 'verified',
    verification_reason: 'verified_api',
    verification_attempted_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
    mood,
  };

  if (!hasKnownAuthor(poemToSave)) {
    console.info('ℹ️ 跳过保存匿名/未知作者诗句');
    return false;
  }

  const savedLocally = savePoemToLocalCache(poemToSave);

  if (!isSupabaseConfigured || !supabase) {
    console.info('ℹ️ 未配置 Supabase，已保存到浏览器本地缓存');
    return savedLocally;
  }

  try {
    // 先检查是否已存在
    const exists = await isPoemExists(content);
    
    if (exists) {
      console.log('⚠️ 诗句已存在，跳过写入：', content);
      return savedLocally;
    }

    // 写入数据库
    const { error } = await supabase.from('poems').insert(poemToSave);

    if (error) {
      console.error('❌ 写入 Supabase 失败：', error);
      return savedLocally;
    }

    console.log('✅ 诗句已保存到 Supabase：', content);
    return true;
  } catch (error) {
    console.error('❌ savePoemToDatabase 错误：', error);
    return savedLocally;
  }
}

export async function incrementPoemLike(
  content: string,
  poem_title: string,
  author: string
): Promise<number | null> {
  if (!hasKnownAuthor({ author }) || !poem_title.trim()) {
    console.info('ℹ️ 未核验出处的诗句不写入公共点赞统计');
    return null;
  }

  if (!isSupabaseConfigured || !supabase) {
    console.info('ℹ️ 未配置 Supabase，本次喜欢只保存在浏览器收藏夹');
    return null;
  }

  try {
    await savePoemToDatabase(content, poem_title, author, 'favorite');

    const { data, error } = await supabase.rpc('increment_poem_like', {
      poem_content: content,
    });

    if (error) {
      console.error('❌ 点赞计数更新失败：', error);
      return null;
    }

    return typeof data === 'number' ? data : null;
  } catch (error) {
    console.error('❌ incrementPoemLike 错误：', error);
    return null;
  }
}

/**
 * 从 Supabase 随机读取一条诗句（容错机制）
 */
export async function getRandomPoemFromDatabase(excludedContents: string[] = []): Promise<Poem | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.info('ℹ️ 未配置 Supabase，使用本地备用诗句');
    return getLocalFallbackPoem(excludedContents);
  }

  try {
    const { count, error: countError } = await supabase
      .from('poems')
      .select('id', { count: 'exact', head: true })
      .eq('attribution_status', 'verified')
      .not('author', 'is', null)
      .not('author', 'in', '("未知","佚名","匿名","无","anonymous","unknown")');

    if (countError) {
      console.error('❌ 查询 Supabase 诗句数量失败：', countError);
      return getLocalFallbackPoem(excludedContents);
    }

    if (!count || count <= 0) {
      console.warn('⚠️ 数据库中还没有诗句');
      return getLocalFallbackPoem(excludedContents);
    }

    const excluded = new Set(excludedContents.map(normalizePoemContent));
    const attemptedOffsets = new Set<number>();
    const maxAttempts = Math.min(count, excluded.size + 1);
    let firstRandomPoem: Poem | null = null;

    // Draw offsets uniformly from the entire filtered table. Sampling without
    // replacement preserves equal probability while allowing recent results to be rejected.
    while (attemptedOffsets.size < maxAttempts) {
      let randomOffset = Math.floor(Math.random() * count);
      while (attemptedOffsets.has(randomOffset)) {
        randomOffset = Math.floor(Math.random() * count);
      }
      attemptedOffsets.add(randomOffset);

      const { data, error } = await supabase
        .from('poems')
        .select('*')
        .eq('attribution_status', 'verified')
        .not('author', 'is', null)
        .not('author', 'in', '("未知","佚名","匿名","无","anonymous","unknown")')
        .order('created_at', { ascending: false })
        .range(randomOffset, randomOffset)
        .limit(1);

      if (error) {
        console.error('❌ 从 Supabase 读取失败：', error);
        return getLocalFallbackPoem(excludedContents);
      }

      const candidate = data?.find(hasKnownAuthor) || null;
      if (!candidate) continue;
      firstRandomPoem ||= candidate;

      if (!excluded.has(normalizePoemContent(candidate.content))) {
        console.log('✅ 从全部数据库中随机读取到诗句：', candidate.content);
        return candidate;
      }
    }

    // This only happens when the database itself contains no poem outside the
    // browser's recent list. Returning the first uniform draw is then unavoidable.
    const randomPoem = firstRandomPoem;

    if (!randomPoem) {
      console.warn('⚠️ 随机诗句作者未知，改用本地备用诗句');
      return getLocalFallbackPoem(excludedContents);
    }

    console.log('⚠️ 数据库诗句均在最近记录中，允许重复返回：', randomPoem.content);
    return randomPoem;
  } catch (error) {
    console.error('❌ getRandomPoemFromDatabase 错误：', error);
    return getLocalFallbackPoem(excludedContents);
  }
}

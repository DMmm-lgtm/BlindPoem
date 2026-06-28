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

const LOCAL_POEM_CACHE_KEY = 'blindpoem.localPoems.v1';
const MAX_LOCAL_POEMS = 80;

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
      ? poems.filter((poem) => poem && poem.content)
      : [];
  } catch (error) {
    console.warn('⚠️ 读取本地诗句缓存失败：', error);
    return [];
  }
}

function savePoemToLocalCache(poem: Poem): boolean {
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

function getLocalFallbackPoem(): Poem {
  const cachedPoems = readLocalPoems();
  const poemPool = cachedPoems.length > 0 ? cachedPoems : LOCAL_FALLBACK_POEMS;
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
  mood: string
): Promise<boolean> {
  const poemToSave: Poem = {
    content,
    poem_title,
    author,
    mood,
  };
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
export async function getRandomPoemFromDatabase(): Promise<Poem | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.info('ℹ️ 未配置 Supabase，使用本地备用诗句');
    return getLocalFallbackPoem();
  }

  try {
    // 先取 10 条，然后在客户端随机选一条（简单有效）
    const { data, error } = await supabase
      .from('poems')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ 从 Supabase 读取失败：', error);
      return getLocalFallbackPoem();
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ 数据库中还没有诗句');
      return getLocalFallbackPoem();
    }

    // 客户端随机选择
    const randomIndex = Math.floor(Math.random() * data.length);
    const randomPoem = data[randomIndex];

    console.log('✅ 从数据库读取到随机诗句：', randomPoem.content);
    return randomPoem;
  } catch (error) {
    console.error('❌ getRandomPoemFromDatabase 错误：', error);
    return getLocalFallbackPoem();
  }
}

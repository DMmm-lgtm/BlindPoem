import { supabase } from './supabaseClient';
import type { Poem } from './supabaseClient';

/**
 * 检查诗句是否已存在
 */
async function isPoemExists(content: string): Promise<boolean> {
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
  try {
    // 先检查是否已存在
    const exists = await isPoemExists(content);
    
    if (exists) {
      console.log('⚠️ 诗句已存在，跳过写入：', content);
      return false;
    }

    // 写入数据库
    const { error } = await supabase.from('poems').insert({
      content,
      poem_title,
      author,
      mood,
    });

    if (error) {
      console.error('❌ 写入 Supabase 失败：', error);
      return false;
    }

    console.log('✅ 诗句已保存到 Supabase：', content);
    return true;
  } catch (error) {
    console.error('❌ savePoemToDatabase 错误：', error);
    return false;
  }
}

/**
 * 从 Supabase 随机读取一条诗句（容错机制）
 */
export async function getRandomPoemFromDatabase(): Promise<Poem | null> {
  try {
    // 先取 10 条，然后在客户端随机选一条（简单有效）
    const { data, error } = await supabase
      .from('poems')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ 从 Supabase 读取失败：', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ 数据库中还没有诗句');
      return null;
    }

    // 客户端随机选择
    const randomIndex = Math.floor(Math.random() * data.length);
    const randomPoem = data[randomIndex];

    console.log('✅ 从数据库读取到随机诗句：', randomPoem.content);
    return randomPoem;
  } catch (error) {
    console.error('❌ getRandomPoemFromDatabase 错误：', error);
    return null;
  }
}


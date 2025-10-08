import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 检查环境变量是否配置
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 Supabase 环境变量！请检查 .env.local 文件');
}

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 定义诗句类型
export interface Poem {
  id?: string;
  content: string;
  poem_title?: string;
  author?: string;
  mood?: string;
  created_at?: string;
}


import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 定义诗句类型
export interface Poem {
  id?: string;
  content: string;
  poem_title?: string;
  author?: string;
  mood?: string;
  created_at?: string;
}

// Supabase 是可选能力：没有配置时，页面仍可运行并使用本地备用诗句。
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

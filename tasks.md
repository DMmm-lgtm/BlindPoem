# Tasks - BlindPoem (盲盒诗)

> 💡 **目标**：4小时内完成一个点击 Emoji 获取 AI 诗句的网页工具

---

## Phase 0: 初始化 ⚙️

### T0.1 创建 React + Vite + TypeScript 项目

**步骤**：
```bash
# 在 BlindPoem 文件夹内执行
cd /Users/dyl/GitHub/BlindPoem
npm create vite@latest . -- --template react-ts
```

**如果提示文件夹不为空**：
- 选择 `y` 确认在当前目录创建
- 或者先清空文件夹（保留 prp.md 和 tasks.md）

**验收**：
- [ ] 生成了 `package.json`、`vite.config.ts`、`src/` 文件夹
- [ ] 运行 `npm install` 无报错
- [ ] 运行 `npm run dev` 能看到 Vite 默认页面

---

### T0.2 安装必要依赖

**步骤**：
```bash
# 安装 Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 安装 Supabase 客户端
npm install @supabase/supabase-js

# 安装 Google Generative AI SDK
npm install @google/generative-ai
```

**配置 Tailwind CSS**：

1. **编辑 `tailwind.config.js`**：
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'night-blue': '#0a0e27',
        'dawn-purple': '#1a1a3e',
        'gold': '#ffd700',
      },
    },
  },
  plugins: [],
}
```

2. **编辑 `src/index.css`**（替换全部内容）：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 全局样式 */
body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%);
  color: #f5f5f5;
  overflow: hidden;
}

* {
  box-sizing: border-box;
}
```

**验收**：
- [ ] `npm run dev` 能启动，页面背景变为深蓝色
- [ ] `node_modules/` 包含 `@supabase/supabase-js` 和 `@google/generative-ai`
- [ ] 没有安装错误提示

---

### T0.3 配置环境变量

**步骤**：

1. **在项目根目录创建 `.env.local` 文件**：
```bash
touch .env.local
```

2. **编辑 `.env.local`**（暂时留空，后续填入）：
```env
# Supabase 配置（Phase 1 完成后填入）
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Gemini API 配置（Phase 2 开始前填入）
VITE_GEMINI_API_KEY=
```

3. **创建 `.gitignore`**（如果没有）：
```
node_modules
dist
.env.local
.DS_Store
```

**验收**：
- [ ] `.env.local` 文件已创建
- [ ] `.gitignore` 包含 `.env.local`
- [ ] 文件不会被 Git 追踪（运行 `git status` 确认）

---

## Phase 1: Supabase 配置 🗄️

### T1.1 创建 Supabase 项目

**步骤**：

1. **打开浏览器，访问** [https://supabase.com](https://supabase.com)
2. **登录或注册账号**（建议用 GitHub 登录）
3. **点击 "New Project"**：
   - Project Name: `blindpoem`
   - Database Password: **记住这个密码！**（建议用密码管理器保存）
   - Region: 选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`
4. **等待项目创建**（约 2 分钟）
5. **获取 API 密钥**：
   - 进入项目后，点击左侧 "Settings" → "API"
   - 复制 `Project URL` 和 `anon public` key

**更新 `.env.local`**：
```env
VITE_SUPABASE_URL=你的_Project_URL
VITE_SUPABASE_ANON_KEY=你的_anon_key
```

**验收**：
- [ ] Supabase 项目状态显示为 "Active"
- [ ] `.env.local` 已填入正确的 URL 和 KEY
- [ ] 重启 `npm run dev` 后无报错

---

### T1.2 创建诗句数据表

**步骤**：

1. **进入 Supabase 项目，点击左侧 "SQL Editor"**
2. **点击 "New Query"，粘贴以下 SQL**：

```sql
-- 创建诗句表
CREATE TABLE poems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL UNIQUE, -- 诗句内容（唯一性约束）
  poem_title TEXT, -- 诗名
  author TEXT, -- 作者
  mood TEXT, -- 心情关键词（如：happy, sad, excited）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX idx_poems_mood ON poems(mood);
CREATE INDEX idx_poems_created_at ON poems(created_at DESC);

-- 启用 RLS（Row Level Security）
ALTER TABLE poems ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取
CREATE POLICY "Enable read access for all users" ON poems
  FOR SELECT USING (true);

-- 创建策略：允许所有人插入（暂时，后续可改为需要认证）
CREATE POLICY "Enable insert for all users" ON poems
  FOR INSERT WITH CHECK (true);
```

3. **点击 "Run" 执行 SQL**
4. **验证表是否创建成功**：
   - 点击左侧 "Table Editor"
   - 应该能看到 `poems` 表

**验收**：
- [ ] `poems` 表已创建，包含字段：id, content, poem_title, author, mood, created_at
- [ ] 点击 "Table Editor" → "poems" 能看到空表
- [ ] SQL 执行无错误提示

---

### T1.3 配置 Supabase 客户端

**步骤**：

1. **创建 `src/lib/supabaseClient.ts` 文件**：
```bash
mkdir -p src/lib
touch src/lib/supabaseClient.ts
```

2. **编辑 `src/lib/supabaseClient.ts`**：
```typescript
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
```

**验收**：
- [ ] 文件 `src/lib/supabaseClient.ts` 已创建
- [ ] 重启 `npm run dev` 无报错
- [ ] 浏览器控制台无错误信息

---

## Phase 2: 基础 UI 和 AI 核心功能 🎨

### T2.1 创建基础页面布局

**步骤**：

1. **编辑 `src/App.tsx`**（替换全部内容）：
```typescript
import { useState } from 'react';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [poemData, setPoemData] = useState<{
    content: string;
    poem_title: string;
    author: string;
  } | null>(null);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-night-blue to-dawn-purple">
      {/* 页面标题 */}
      <header className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <h1 className="text-3xl font-light text-gold opacity-80">盲盒诗</h1>
      </header>

      {/* Emoji 按钮区域（稍后添加） */}
      <div className="emoji-container">
        {/* T2.2 会在这里添加 17 个 Emoji 按钮 */}
      </div>

      {/* 诗句展示区域（中央） */}
      {poemData && (
        <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="poem-display bg-black/40 backdrop-blur-md rounded-2xl p-8 max-w-2xl pointer-events-auto">
            <p className="text-2xl text-white mb-4 leading-relaxed">
              {poemData.content}
            </p>
            <div className="text-sm text-gold/80">
              <p>《{poemData.poem_title}》</p>
              <p>— {poemData.author}</p>
            </div>
            <button
              onClick={() => setPoemData(null)}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="text-gold text-xl animate-pulse">
            诗意生成中...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
```

2. **创建 `src/App.css`**：
```css
.emoji-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.poem-display {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

**验收**：
- [ ] 页面显示深色渐变背景
- [ ] 顶部中央显示"盲盒诗"标题
- [ ] 没有控制台错误

---

### T2.2 创建 17 个 Emoji 按钮

**步骤**：

1. **在 `src/App.tsx` 中，定义 Emoji 数据**（在 `App` 函数顶部添加）：
```typescript
// 17 个 Emoji 及其对应的心情关键词
const EMOJI_MOODS = [
  { emoji: '😊', mood: '快乐', keyword: 'happy' },
  { emoji: '😢', mood: '悲伤', keyword: 'sad' },
  { emoji: '🚀', mood: '激动', keyword: 'excited' },
  { emoji: '🌙', mood: '宁静', keyword: 'peaceful' },
  { emoji: '🔥', mood: '热情', keyword: 'passionate' },
  { emoji: '🌸', mood: '温柔', keyword: 'gentle' },
  { emoji: '⚡', mood: '震撼', keyword: 'shocked' },
  { emoji: '🌊', mood: '平静', keyword: 'calm' },
  { emoji: '🎭', mood: '戏剧', keyword: 'dramatic' },
  { emoji: '🦋', mood: '轻盈', keyword: 'light' },
  { emoji: '🌅', mood: '希望', keyword: 'hopeful' },
  { emoji: '🍃', mood: '清新', keyword: 'fresh' },
  { emoji: '⭐', mood: '梦幻', keyword: 'dreamy' },
  { emoji: '🌹', mood: '浪漫', keyword: 'romantic' },
  { emoji: '🎨', mood: '创意', keyword: 'creative' },
  { emoji: '🎵', mood: '音乐', keyword: 'musical' },
  { emoji: '💭', mood: '思考', keyword: 'thoughtful' },
];
```

2. **替换 `.emoji-container` 部分**：
```typescript
{/* Emoji 按钮区域 */}
<div className="emoji-container">
  {EMOJI_MOODS.map((item, index) => {
    // 随机定位（避免重叠，分布在屏幕各处）
    const positions = [
      { top: '10%', left: '15%' },
      { top: '20%', left: '80%' },
      { top: '30%', left: '25%' },
      { top: '40%', left: '70%' },
      { top: '50%', left: '10%' },
      { top: '60%', left: '85%' },
      { top: '70%', left: '30%' },
      { top: '80%', left: '65%' },
      { top: '15%', left: '50%' },
      { top: '25%', left: '40%' },
      { top: '35%', left: '90%' },
      { top: '45%', left: '20%' },
      { top: '55%', left: '60%' },
      { top: '65%', left: '45%' },
      { top: '75%', left: '75%' },
      { top: '85%', left: '15%' },
      { top: '90%', left: '50%' },
    ];

    return (
      <button
        key={index}
        onClick={() => handleEmojiClick(item.keyword, item.mood)}
        className="emoji-btn absolute text-5xl cursor-pointer hover:scale-110 transition-transform"
        style={{
          top: positions[index].top,
          left: positions[index].left,
          transform: 'translate(-50%, -50%)',
        }}
        title={item.mood}
      >
        {item.emoji}
      </button>
    );
  })}
</div>
```

3. **添加点击处理函数**（临时占位，稍后实现 AI 调用）：
```typescript
const handleEmojiClick = async (keyword: string, mood: string) => {
  console.log('点击了：', mood, keyword);
  // T2.3 会实现真正的 AI 调用
};
```

4. **在 `src/App.css` 添加呼吸式辉光效果**：
```css
.emoji-btn {
  filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));
  animation: breathe 3s ease-in-out infinite;
}

.emoji-btn:hover {
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
}

@keyframes breathe {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5));
  }
}
```

**验收**：
- [ ] 页面显示 17 个 Emoji 按钮，分布在屏幕各处
- [ ] 鼠标悬停时 Emoji 放大
- [ ] Emoji 有呼吸式辉光效果
- [ ] 点击 Emoji 时控制台输出心情关键词

---

### T2.3 配置 Gemini API

**步骤**：

1. **获取 Gemini API Key**：
   - 访问 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - 登录 Google 账号
   - 点击 "Create API Key"
   - 复制生成的 API Key

2. **更新 `.env.local`**：
```env
VITE_GEMINI_API_KEY=你的_Gemini_API_Key
```

3. **重启开发服务器**：
```bash
# 按 Ctrl+C 停止，然后重新运行
npm run dev
```

**验收**：
- [ ] `.env.local` 已填入 Gemini API Key
- [ ] 重启后浏览器控制台无错误
- [ ] 可以在控制台输入 `import.meta.env.VITE_GEMINI_API_KEY` 看到 API Key（开发模式）

---

### T2.4 实现 AI 调用核心逻辑

**步骤**：

1. **创建 `src/lib/geminiClient.ts`**：
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('缺少 Gemini API Key！请检查 .env.local 文件');
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface PoemResponse {
  content: string; // 诗句内容（≤30字）
  poem_title: string; // 诗名
  author: string; // 作者
}

/**
 * 根据心情关键词生成诗句
 * @param keyword 心情关键词（如：happy, sad）
 * @param moodName 心情名称（如：快乐、悲伤）
 */
export async function generatePoem(
  keyword: string,
  moodName: string
): Promise<PoemResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  // 动态生成提示词
  const prompt = `你是一位精通中国古典诗词的诗人。请根据"${moodName}"这个心情，从中国古典诗词中选择一句最贴合的诗句（不超过30字）。

要求：
1. 必须是真实存在的中国古典诗句
2. 诗句要与"${moodName}"这个心情高度契合
3. 返回格式必须是严格的 JSON，不要包含任何 markdown 标记或其他文本

返回格式示例：
{
  "content": "诗句内容",
  "poem_title": "诗名",
  "author": "作者"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 清理可能的 markdown 代码块标记
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // 解析 JSON
    const poemData: PoemResponse = JSON.parse(text);

    // 验证返回数据
    if (!poemData.content || !poemData.poem_title || !poemData.author) {
      throw new Error('AI 返回数据不完整');
    }

    return poemData;
  } catch (error) {
    console.error('Gemini API 调用失败：', error);
    throw error;
  }
}
```

2. **在 `src/App.tsx` 中实现 `handleEmojiClick`**（替换之前的临时版本）：
```typescript
import { generatePoem } from './lib/geminiClient';

// ... 在 App 组件内部

const handleEmojiClick = async (keyword: string, mood: string) => {
  setIsLoading(true);
  setPoemData(null); // 清空之前的诗句

  try {
    // 调用 Gemini API
    const poem = await generatePoem(keyword, mood);
    
    // 展示诗句
    setPoemData({
      content: poem.content,
      poem_title: poem.poem_title,
      author: poem.author,
    });

    console.log('✅ AI 返回成功：', poem);
  } catch (error) {
    console.error('❌ AI 调用失败：', error);
    alert('获取诗句失败，请稍后重试');
  } finally {
    setIsLoading(false);
  }
};
```

**验收**：
- [ ] 点击任意 Emoji 按钮，显示"诗意生成中..."加载状态
- [ ] 1-3 秒后，页面中央显示诗句、诗名和作者
- [ ] 控制台输出"✅ AI 返回成功"
- [ ] 点击"关闭"按钮可以关闭诗句展示

---

## Phase 3: 数据持久化和容错机制 💾

### T3.1 实现诗句写入 Supabase（唯一性检查）

**步骤**：

1. **创建 `src/lib/poemService.ts`**：
```typescript
import { supabase, Poem } from './supabaseClient';

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
    // 方法1：使用 PostgreSQL 的 RANDOM() 函数（需要 RPC）
    // 方法2：先获取总数，再随机选一个 offset（简单但慢）
    // 方法3：直接随机排序取第一条（最简单）
    
    const { data, error } = await supabase
      .from('poems')
      .select('*')
      .limit(10); // 先取 10 条，然后在客户端随机选一条

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
```

2. **在 `src/App.tsx` 中调用保存逻辑**（修改 `handleEmojiClick`）：
```typescript
import { savePoemToDatabase } from './lib/poemService';

const handleEmojiClick = async (keyword: string, mood: string) => {
  setIsLoading(true);
  setPoemData(null);

  try {
    const poem = await generatePoem(keyword, mood);
    
    setPoemData({
      content: poem.content,
      poem_title: poem.poem_title,
      author: poem.author,
    });

    // 🆕 保存到 Supabase（异步，不阻塞 UI）
    savePoemToDatabase(
      poem.content,
      poem.poem_title,
      poem.author,
      keyword
    );

    console.log('✅ AI 返回成功：', poem);
  } catch (error) {
    console.error('❌ AI 调用失败：', error);
    alert('获取诗句失败，请稍后重试');
  } finally {
    setIsLoading(false);
  }
};
```

**验收**：
- [ ] 点击 Emoji 获取诗句后，打开 Supabase → Table Editor → poems
- [ ] 看到新增的诗句记录
- [ ] 再次点击相同 Emoji 获取相同诗句时，控制台显示"⚠️ 诗句已存在，跳过写入"
- [ ] 数据库中没有重复的诗句

---

### T3.2 实现容错机制（AI 失败时读取数据库）

**步骤**：

1. **修改 `src/App.tsx` 的 `handleEmojiClick`**（完善错误处理）：
```typescript
import { savePoemToDatabase, getRandomPoemFromDatabase } from './lib/poemService';

const handleEmojiClick = async (keyword: string, mood: string) => {
  setIsLoading(true);
  setPoemData(null);

  try {
    // 尝试调用 AI
    const poem = await generatePoem(keyword, mood);
    
    setPoemData({
      content: poem.content,
      poem_title: poem.poem_title,
      author: poem.author,
    });

    // 保存到 Supabase
    savePoemToDatabase(
      poem.content,
      poem.poem_title,
      poem.author,
      keyword
    );

    console.log('✅ AI 返回成功：', poem);
  } catch (error) {
    console.error('❌ AI 调用失败，尝试从数据库读取：', error);

    // 🆕 容错机制：从数据库随机读取
    const fallbackPoem = await getRandomPoemFromDatabase();

    if (fallbackPoem) {
      setPoemData({
        content: fallbackPoem.content,
        poem_title: fallbackPoem.poem_title || '未知',
        author: fallbackPoem.author || '佚名',
      });
      console.log('✅ 使用数据库备用诗句');
    } else {
      alert('获取诗句失败，且数据库中暂无备用诗句。请稍后重试。');
    }
  } finally {
    setIsLoading(false);
  }
};
```

**验收**：
- [ ] **测试场景1**：正常情况下点击 Emoji，能获取 AI 诗句
- [ ] **测试场景2**：关闭网络（或暂时删除 `.env.local` 中的 `VITE_GEMINI_API_KEY`），点击 Emoji
  - 控制台显示"❌ AI 调用失败，尝试从数据库读取"
  - 页面仍能显示之前保存的诗句
  - 控制台显示"✅ 使用数据库备用诗句"
- [ ] 如果数据库为空，显示提示"数据库中暂无备用诗句"

---

## Phase 4: 视觉动效和商业化功能 ✨

### T4.1 添加 CSS 渐变背景动画

**步骤**：

1. **在 `src/index.css` 中添加背景动画**（替换 `body` 样式）：
```css
body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* 渐变背景动画：从深夜到黎明 */
  background: linear-gradient(180deg, #0a0e27 0%, #1a1a3e 50%, #2a1a4e 100%);
  background-size: 100% 200%;
  animation: gradientShift 20s ease-in-out infinite;
  
  color: #f5f5f5;
  overflow: hidden;
}

@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 0% 100%;
  }
}
```

**验收**：
- [ ] 页面背景颜色缓慢从深蓝渐变到深紫，再回到深蓝
- [ ] 动画循环流畅，无卡顿

---

### T4.2 优化诗句展示效果（打字机效果 - 可选）

**步骤**（简化版，不使用打字机库）：

1. **在 `src/App.css` 中添加诗句出现动画**：
```css
.poem-display {
  animation: poemReveal 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.2);
}

@keyframes poemReveal {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 关闭时的流星效果 */
.poem-display.closing {
  animation: poemClose 0.5s ease-in forwards;
}

@keyframes poemClose {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px);
  }
}
```

**验收**：
- [ ] 诗句出现时有缓慢放大+渐入效果
- [ ] 诗句周围有淡金色辉光

---

### T4.3 实现商业化功能（10秒后显示爱心）

**步骤**：

1. **在 `src/App.tsx` 中添加状态和定时器**：
```typescript
import { useState, useEffect } from 'react';

function App() {
  // ... 其他 state
  const [showLoveButton, setShowLoveButton] = useState(false);
  const [isLoved, setIsLoved] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // 当诗句出现后，10秒后显示爱心按钮
  useEffect(() => {
    if (poemData) {
      setShowLoveButton(false);
      setIsLoved(false);
      setShowQRCode(false);

      const timer = setTimeout(() => {
        setShowLoveButton(true);
      }, 10000); // 10秒

      return () => clearTimeout(timer);
    }
  }, [poemData]);

  // 处理爱心点击
  const handleLoveClick = () => {
    setIsLoved(true);
    setShowQRCode(true);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-night-blue to-dawn-purple">
      {/* ... 其他内容 */}

      {/* 诗句展示区域 */}
      {poemData && (
        <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="poem-display bg-black/40 backdrop-blur-md rounded-2xl p-8 max-w-2xl pointer-events-auto">
            <p className="text-2xl text-white mb-4 leading-relaxed">
              {poemData.content}
            </p>
            <div className="text-sm text-gold/80">
              <p>《{poemData.poem_title}》</p>
              <p>— {poemData.author}</p>
            </div>

            {/* 🆕 爱心按钮（10秒后出现） */}
            {showLoveButton && (
              <button
                onClick={handleLoveClick}
                className={`mt-6 text-4xl transition-all duration-300 ${
                  isLoved ? 'scale-110' : 'scale-100 hover:scale-110'
                }`}
              >
                {isLoved ? '❤️' : '🤍'}
              </button>
            )}

            {/* 🆕 赞赏二维码（点击爱心后弹出） */}
            {showQRCode && (
              <div className="mt-4 p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-800 mb-2 text-center">
                  感谢支持 ☕
                </p>
                {/* 🔴 TODO: 替换为你的二维码图片路径 */}
                <img
                  src="/qrcode.png"
                  alt="赞赏码"
                  className="w-48 h-48 mx-auto"
                />
              </div>
            )}

            <button
              onClick={() => setPoemData(null)}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

2. **准备赞赏二维码图片**：
   - 将你的赞赏二维码图片命名为 `qrcode.png`
   - 放到 `public/` 文件夹下
   - 或者使用任何图床链接

**验收**：
- [ ] 诗句出现后，等待 10 秒，出现白色空心爱心 🤍
- [ ] 点击爱心后，变为红心 ❤️ 并放大
- [ ] 同时下方弹出赞赏二维码图片
- [ ] 关闭诗句后，爱心和二维码也消失

---

## Phase 5: 部署 🚀

### T5.1 构建生产版本

**步骤**：

```bash
# 构建项目
npm run build

# 预览构建结果（可选）
npm run preview
```

**验收**：
- [ ] 生成 `dist/` 文件夹
- [ ] 运行 `npm run preview` 能访问本地生产版本
- [ ] 没有构建错误

---

### T5.2 部署到 Vercel（推荐）

**步骤**：

1. **安装 Vercel CLI**（可选，也可以用网页部署）：
```bash
npm install -g vercel
```

2. **登录 Vercel**：
```bash
vercel login
```

3. **部署项目**：
```bash
vercel
```
   - 按提示选择项目配置
   - 等待部署完成

4. **配置环境变量**：
   - 打开 Vercel 项目 Dashboard
   - 进入 "Settings" → "Environment Variables"
   - 添加以下变量：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_GEMINI_API_KEY`
   - 保存后重新部署：`vercel --prod`

**或者使用 Vercel 网页部署**：

1. 访问 [https://vercel.com](https://vercel.com)
2. 登录并点击 "New Project"
3. 导入你的 GitHub 仓库（先将代码推送到 GitHub）
4. 配置环境变量（同上）
5. 点击 "Deploy"

**验收**：
- [ ] 获得一个 Vercel 部署链接（如：`blindpoem.vercel.app`）
- [ ] 打开链接，能正常访问网站
- [ ] 点击 Emoji 能获取诗句
- [ ] 诗句能保存到 Supabase

---

### T5.3 测试线上功能

**测试清单**：

- [ ] **基础功能**：
  - [ ] 页面加载正常，显示 17 个 Emoji 按钮
  - [ ] 背景渐变动画运行流畅
  - [ ] Emoji 有呼吸式辉光效果

- [ ] **AI 功能**：
  - [ ] 点击任意 Emoji，1-3 秒内显示诗句
  - [ ] 诗句内容与选择的心情相关
  - [ ] 诗句、诗名、作者都正确显示

- [ ] **数据持久化**：
  - [ ] 检查 Supabase 数据库，确认诗句已保存
  - [ ] 测试容错机制（临时关闭网络或修改 API Key）
  - [ ] 能从数据库读取备用诗句

- [ ] **商业化功能**：
  - [ ] 诗句出现 10 秒后，显示爱心按钮
  - [ ] 点击爱心后，爱心变红
  - [ ] 赞赏二维码正确显示

- [ ] **移动端适配**：
  - [ ] 在手机浏览器打开，布局正常
  - [ ] Emoji 按钮可点击
  - [ ] 诗句在手机上能正常阅读

---

## 🎉 完成！

恭喜你完成了 BlindPoem 项目的所有开发任务！

### 📊 最终检查清单

- [ ] 所有 Phase 0-5 的任务都已完成
- [ ] 网站已部署并可公开访问
- [ ] 核心功能（AI 诗句、数据存储、容错机制）运行正常
- [ ] 视觉效果达到预期（背景动画、Emoji 辉光）
- [ ] 商业化功能（爱心、赞赏码）正常工作

### 🚀 下一步（V2 功能）

如果时间充裕，可以考虑以下增强功能：

1. **用户系统**：添加登录注册，记录用户喜欢的诗句
2. **诗句收藏**：允许用户收藏喜欢的诗句
3. **分享功能**：生成诗句卡片，分享到社交媒体
4. **高级动效**：添加星空粒子、流星特效
5. **音乐背景**：根据心情播放背景音乐
6. **打字机效果**：诗句逐字显示

---

**祝你开发顺利！🚀✨**


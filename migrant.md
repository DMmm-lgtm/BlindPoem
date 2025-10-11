# BlindPoem 技术架构与平台迁移指南

我是一个编程小白，我已经有一个网站，架构和具体细节请参考migrant.md文件。你帮我生成一个将这个网站迁移到小程序的项目流程，要包含每一步的计划和验收方法，每一步尽量少做的事情，可以多一些步骤。我预想到的迁移难点在AI的调用和数据库的API上，这两点请帮我详情介绍如何迁移。

> 本文档详细解析 BlindPoem（盲盒诗）项目的技术架构，为迁移到移动端、小程序或桌面应用提供完整的技术参考。

## 📑 目录

- [一、整体架构概览](#一整体架构概览)
- [二、核心技术栈](#二核心技术栈)
- [三、核心功能模块分析](#三核心功能模块分析)
- [四、状态管理架构](#四状态管理架构)
- [五、数据流设计](#五数据流设计)
- [六、关键技术细节](#六关键技术细节)
- [七、平台迁移指南](#七平台迁移指南)
- [八、核心依赖](#八核心依赖)
- [九、总结](#九总结)

---

## 一、整体架构概览

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                      前端展示层                          │
│  React 18 + TypeScript + Vite + Tailwind CSS           │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌────────▼─────────┐
│   AI 服务层    │    │   数据持久层      │
│  Gemini API    │    │   Supabase       │
│  (诗句生成)    │    │   (PostgreSQL)   │
└────────────────┘    └──────────────────┘
```

### 项目特点

- **无服务器架构**: 完全依赖云服务（Gemini AI + Supabase），无需自建后端
- **纯前端实现**: 所有业务逻辑在客户端完成
- **类型安全**: TypeScript 全覆盖
- **性能优化**: Canvas 渲染 + GPU 加速动画

---

## 二、核心技术栈

### 1. 前端框架

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架（函数组件 + Hooks） |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 开发服务器和构建工具 |
| Tailwind CSS | 4.x | 实用优先的样式系统 |

### 2. 外部服务

| 服务 | 用途 | 调用方式 |
|------|------|----------|
| **Gemini AI API** | 诗句生成 | REST API（无需 SDK） |
| **Supabase** | PostgreSQL 数据库 | JS SDK（`@supabase/supabase-js`） |

### 3. 开发工具

- **ESLint**: 代码规范检查
- **PostCSS**: CSS 处理
- **环境变量**: `.env.local` 管理密钥

---

## 三、核心功能模块分析

### 模块 1: Emoji 交互系统

**文件位置**: `src/App.tsx` (第 7-42 行)

#### 数据结构

```typescript
interface EmojiMood {
  emoji: string;    // Emoji 字符（如：😊）
  mood: string;     // 中文心情名（如：快乐）
  keyword: string;  // 英文关键词（如：happy）
}

const EMOJI_MOODS = [
  { emoji: '😊', mood: '快乐', keyword: 'happy' },
  { emoji: '😢', mood: '悲伤', keyword: 'sad' },
  // ... 共 27 个情绪
];
```

#### 核心特性

1. **随机位置分布** (第 519-547 行)
   - 27 个 Emoji 分布在屏幕不同位置
   - 使用百分比定位，响应式适配

2. **物理引擎** (第 504-628 行)
   ```typescript
   interface EmojiPhysics {
     x: number;          // 像素位置
     y: number;
     vx: number;         // 速度（0.1-0.3 px/frame）
     vy: number;
     rotation: number;   // 旋转角度
     rotationSpeed: number;  // 旋转速度
   }
   ```
   - 超级缓慢移动（0.1-0.3 px/frame）
   - 屏幕边界碰撞反弹（阻尼系数 0.92）
   - 缓慢旋转

3. **多彩辉光动画** (第 474-501 行)
   - 每个 Emoji 随机分配颜色（8 种）
   - 呼吸式辉光（15-33 秒周期）
   - 辉光大小动态变化（10-32px）
   - 鼠标悬停增强效果

#### 迁移建议

| 平台 | 适配方案 |
|------|----------|
| **React Native** | 使用 `react-native-reanimated` 替代物理引擎，简化碰撞检测 |
| **微信小程序** | 简化为 CSS 动画，取消物理引擎（性能限制） |
| **Electron** | 保持完整实现，性能更优 |

---

### 模块 2: AI 诗句生成系统

**文件位置**: `src/lib/geminiClient.ts`

#### 核心流程

```
用户点击 Emoji
  ↓
提取 keyword（如：happy）+ mood（如：快乐）
  ↓
动态生成 Prompt（6 种模板随机选择）
  ↓
调用 Gemini API（REST 接口）
  ↓
解析 JSON 响应 → { content, poem_title, author }
  ↓
展示诗句 + 异步保存到数据库
```

#### API 调用实现

```typescript
// REST API 调用（无需 SDK）
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 1.1,  // 高随机性，增加多样性
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      }
    })
  }
);
```

#### 6 种 Prompt 模板

| 模板类型 | 倾向 | 温度参数 |
|---------|------|---------|
| 中文版 | 中国古典诗词、现代诗 | 1.1 |
| 英文版 | 英文经典诗歌 | 1.1 |
| 现代诗版 | 20 世纪至今的现代诗 | 1.1 |
| 古典诗词版 | 唐诗、宋词、元曲 | 1.1 |
| 混合版 | 完全随机，可能无关心情 | 1.1 |
| 网络文学版 | 网络金句、歌词、电影台词 | 1.1 |

**随机化策略**:
- 每次请求随机选择一种 Prompt 模板
- 添加随机种子（`Date.now()`）和随机提示词
- 确保相同情绪也能生成不同诗句

#### 响应解析

```typescript
// 1. 获取文本内容
let text = data.candidates[0].content.parts[0].text;

// 2. 清理 markdown 标记
text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

// 3. 提取 JSON
const jsonMatch = text.match(/\{[\s\S]*\}/);
const poemData: PoemResponse = JSON.parse(jsonMatch[0]);

// 4. 验证数据完整性
if (!poemData.content || !poemData.poem_title || !poemData.author) {
  throw new Error('AI 返回数据不完整');
}
```

#### 迁移建议

| 平台 | 适配方案 |
|------|----------|
| **React Native** | 完全兼容，保持 `fetch` 调用 |
| **微信小程序** | 使用 `wx.request()`，需配置服务器域名白名单 |
| **Electron** | 建议使用 IPC 通信，后端 Node.js 管理 API Key（安全性） |

---

### 模块 3: 数据持久化（Supabase）

**文件位置**: 
- `src/lib/supabaseClient.ts` - 客户端配置
- `src/lib/poemService.ts` - 业务逻辑

#### 数据库架构

```sql
CREATE TABLE poems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL UNIQUE,  -- 诗句内容（唯一约束）
  poem_title TEXT,                -- 诗名
  author TEXT,                    -- 作者
  mood TEXT,                      -- 心情关键词（happy, sad...）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_poems_mood ON poems(mood);
CREATE INDEX idx_poems_created_at ON poems(created_at DESC);
```

#### 核心操作

##### 1. 写入（去重）

```typescript
export async function savePoemToDatabase(
  content: string,
  poem_title: string,
  author: string,
  mood: string
): Promise<boolean> {
  // 1. 检查唯一性
  const exists = await isPoemExists(content);
  if (exists) {
    console.log('⚠️ 诗句已存在，跳过写入');
    return false;
  }

  // 2. 写入数据库
  const { error } = await supabase.from('poems').insert({
    content, poem_title, author, mood
  });

  return !error;
}
```

##### 2. 读取（容错机制）

```typescript
export async function getRandomPoemFromDatabase(): Promise<Poem | null> {
  // 1. 随机获取 10 条
  const { data } = await supabase
    .from('poems')
    .select('*')
    .limit(10);

  // 2. 客户端随机选择 1 条
  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex];
}
```

#### 容错流程

```
AI 调用失败
  ↓
catch (error)
  ↓
调用 getRandomPoemFromDatabase()
  ↓
[成功] → 展示备用诗句
[失败] → alert('获取诗句失败')
```

#### 迁移建议

| 平台 | 适配方案 |
|------|----------|
| **React Native** | Supabase JS SDK 完全兼容 |
| **微信小程序** | 使用 Supabase REST API 或云开发数据库 |
| **Electron** | 完全兼容，可继续使用 JS SDK |

---

### 模块 4: 视觉系统

#### 4.1 入场动画序列

**文件位置**: `src/App.tsx` (第 45-189 行)

| 时间 | 动画效果 |
|------|----------|
| **0-11 秒** | 8 行诗句逐行淡入（基于字符数分配时长） |
| **11-13 秒** | 停留 2 秒，让用户欣赏完整诗句 |
| **13-15.9 秒** | 所有诗句逐行淡出（每行延迟 0.2 秒） |
| **15.9 秒** | 第 1 句和最后 1 句从底部淡入（背景） |
| **16 秒** | 27 个 Emoji 开始淡入（5 秒渐入） |
| **21 秒** | 提示词淡入："在每一个瞬间的情绪里..." |

**关键代码**:

```typescript
// 根据字符数计算每句的淡入时长（每秒 2 个字符）
const getLineFadeInDuration = (index: number): number => {
  return charCounts[index] / 2;
};

// 计算每句的开始时间（总时长 8 秒 + 每句 0.5 秒 delay）
const getLineStartTime = (index: number): number => {
  let startTime = 0;
  for (let i = 0; i < index; i++) {
    startTime += (charCounts[i] / totalChars) * totalDuration;
  }
  return startTime + index * 0.5;
};
```

#### 4.2 Canvas 粒子系统

**文件位置**: `src/App.tsx` (第 192-471 行)

##### 粒子配置

| 层级 | 数量 | 大小（px） | 透明度 | 颜色 |
|------|------|-----------|--------|------|
| **前景** | 40 | 1.5-3.5 | 0.3-1.0 | 纯白（255,255,255） |
| **中景** | 40 | 1.0-2.0 | 0.1-0.6 | 淡蓝白（220,230,255） |
| **背景** | 40 | 0.5-1.2 | 0.05-0.35 | 偏蓝（180,200,255） |

**总计**: 120 个粒子

##### 动画效果

1. **闪烁动画**
   - 闪烁时长: 0.5-2 秒（快速从最低→最高→最低）
   - 保持时长: 20-60 秒（保持在最低亮度）
   - 使用正弦波实现平滑过渡

2. **浮动动画**
   - 浮动周期: 60-160 秒（超级缓慢）
   - 浮动半径: 5-20px
   - 圆周运动轨迹

3. **流星效果** (第 631-705 行)
   - 每 30 秒自动触发一次
   - 诗句淡出时 50% 概率触发
   - 6 种随机方向（右下、左下、右上、左上、正下、正右）
   - 流星持续 2 秒
   - 带拖尾和光晕效果
   - 流星消失后粒子在新位置重生

##### 性能优化

```typescript
// 1. useMemo 缓存粒子数据（只计算一次）
const particleSequences = useMemo(() => {
  return { frontLayer, midLayer, backLayer };
}, []); // 空依赖数组

// 2. Canvas 使用 requestAnimationFrame
const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  allParticles.forEach(particle => {
    // 绘制逻辑...
  });
  particleAnimationRef.current = requestAnimationFrame(render);
};

// 3. GPU 加速
canvas.style.willChange = 'transform, opacity';
canvas.style.backfaceVisibility = 'hidden';
```

#### 4.3 背景渐变

**文件位置**: `src/App.tsx` (第 993-1002 行)

```css
/* 深夜蓝 → 黎明紫 */
background: linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%);

/* 40 秒循环动画 */
animation: dawnGradient 40s ease-in-out infinite;
```

#### 4.4 光芒层

**文件位置**: `src/App.tsx` (第 1005-1054 行)

| 层级 | 尺寸 | 模糊度 | 动画周期 |
|------|------|--------|---------|
| 核心光芒 | 150vw × 150vh | 60px | 12 秒 |
| 第二层 | 180vw × 180vh | 80px | 18 秒 |
| 第三层 | 200vw × 200vh | 100px | 25 秒 |

#### 迁移建议

| 平台 | 视觉系统适配 |
|------|-------------|
| **React Native** | Canvas → `react-native-skia`，粒子数减少到 50 个 |
| **微信小程序** | Canvas 2D API 兼容，但需优化性能（粒子减少到 30 个） |
| **Electron** | 完全保留，甚至可增加到 200 个粒子 |

---

## 四、状态管理架构

### 核心状态

```typescript
// 1. 入场动画状态
const [welcomePhase, setWelcomePhase] = useState<'lines' | 'sliding' | 'complete'>('lines');
const [showWelcome] = useState(true);
const [emojisVisible, setEmojisVisible] = useState(false);
const [showPrompt, setShowPrompt] = useState(false);
const [showPromptAnimation, setShowPromptAnimation] = useState(false);

// 2. AI 交互状态
const [isLoading, setIsLoading] = useState(false);
const [poemData, setPoemData] = useState<{
  content: string;
  poem_title: string;
  author: string;
} | null>(null);

// 3. 赞赏功能状态
const [showLoveButton, setShowLoveButton] = useState(false);
const [isLoved, setIsLoved] = useState(false);
const [showQRCode, setShowQRCode] = useState(false);

// 4. 动画状态
const [isPoemFadingOut, setIsPoemFadingOut] = useState(false);
const [isQRFadingOut, setIsQRFadingOut] = useState(false);

// 5. 物理引擎状态
const [emojiPhysics, setEmojiPhysics] = useState<EmojiPhysics[]>([]);
const [physicsEnabled, setPhysicsEnabled] = useState(false);

// 6. 流星系统状态
const [meteorParticles, setMeteorParticles] = useState<Map<string, MeteorInfo>>(new Map());
const [particlePositionOverrides, setParticlePositionOverrides] = useState<Map<string, Position>>(new Map());
```

### 状态管理方式

- **完全使用 React 内置 Hooks**
  - `useState`: 状态管理
  - `useEffect`: 副作用管理（定时器、事件监听）
  - `useMemo`: 性能优化（缓存粒子数据）
  - `useCallback`: 函数缓存（流星触发）
  - `useRef`: Canvas 引用、动画帧 ID

- **无外部状态库**（如 Redux、Zustand）
- **适合中小型应用**

### 迁移建议

| 平台 | 状态管理方案 |
|------|-------------|
| **React Native** | 保持相同的 Hooks 方案 |
| **微信小程序** | 使用 `this.setData()` + `Page` 生命周期 |
| **Electron** | 保持相同，可考虑增加 Electron Store |

---

## 五、数据流设计

### 用户交互完整流程

```
1. 用户点击 Emoji
   ↓
2. handleEmojiClick(keyword, mood)
   ↓
3. [如果有旧诗句]
   → 淡出二维码（0.5 秒）
   → 淡出诗句框（0.8 秒）
   → 50% 概率触发流星
   ↓
4. setIsLoading(true) + 隐藏提示词
   ↓
5. 调用 generatePoem(keyword, mood)
   ↓
6. [AI 成功]
   → setPoemData()
   → savePoemToDatabase()（异步，不阻塞 UI）
   ↓
   [AI 失败]
   → catch (error)
   → getRandomPoemFromDatabase()（容错）
   ↓
7. setIsLoading(false)
   ↓
8. [根据诗句长度计算阅读时长]
   → 中文：每秒 3 个字符
   → 英文：每秒 8 个字符
   → 上限 15 秒
   ↓
9. setTimeout() → setShowLoveButton(true)
   ↓
10. [用户点击爱心]
    → setIsLoved(true)
    → setShowQRCode(true)
    ↓
11. [30 秒后] → setShowQRCode(false)（自动隐藏）
```

### 容错机制

```
AI 调用失败
  ↓
catch (error)
  ↓
console.error('❌ AI 调用失败')
  ↓
调用 getRandomPoemFromDatabase()
  ↓
[数据库有数据]
  → setPoemData(fallbackPoem)
  → 展示备用诗句
  ↓
[数据库为空]
  → alert('获取诗句失败，且数据库中暂无备用诗句')
```

### 异步操作设计

```typescript
// ✅ 正确：AI 成功后异步保存，不阻塞 UI
const poem = await generatePoem(keyword, mood);
setPoemData(poem);  // 立即展示

// 不使用 await，不阻塞 UI
savePoemToDatabase(poem.content, poem.poem_title, poem.author, keyword);
```

---

## 六、关键技术细节

### 1. 性能优化

#### useMemo 缓存粒子数据

```typescript
// ❌ 错误：每次渲染都重新生成粒子（导致闪烁）
const particles = Array.from({ length: 120 }, () => ({
  x: Math.random(),
  y: Math.random(),
  // ...
}));

// ✅ 正确：使用 useMemo 缓存（只计算一次）
const particleSequences = useMemo(() => {
  const frontLayer = generateParticles(40, 'front', 0, 3);
  const midLayer = generateParticles(40, 'mid', 1, 4);
  const backLayer = generateParticles(40, 'back', 2, 5);
  return { frontLayer, midLayer, backLayer };
}, []); // 空依赖数组 - 只计算一次
```

#### Canvas 渲染优化

```typescript
// 1. 使用 requestAnimationFrame
const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 绘制逻辑...
  particleAnimationRef.current = requestAnimationFrame(render);
};

// 2. GPU 加速
canvas.style.willChange = 'transform, opacity';
canvas.style.backfaceVisibility = 'hidden';

// 3. 清理动画帧
return () => {
  if (particleAnimationRef.current) {
    cancelAnimationFrame(particleAnimationRef.current);
  }
};
```

#### CSS 性能优化

```css
/* ✅ 优先使用 transform 和 opacity（GPU 加速） */
.emoji-btn {
  transform: translate(-50%, -50%) rotate(0deg);
  opacity: 1;
  will-change: transform, opacity;
}

/* ❌ 避免使用 width、height、margin 动画（会触发重排） */
```

---

### 2. 动画时长计算

#### 爱心按钮出现时机

```typescript
// 根据诗句长度动态计算阅读时长
const textWithoutPunctuation = poemData.content.replace(/[，。、；！？\s]/g, '');

// 区分中文和非中文
const chineseChars = textWithoutPunctuation.match(/[\u4e00-\u9fa5]/g) || [];
const nonChineseChars = textWithoutPunctuation.replace(/[\u4e00-\u9fa5]/g, '');

// 计算时长
const chineseDuration = (chineseChars.length / 3) * 1000;  // 中文：每秒 3 字
const nonChineseDuration = (nonChineseChars.length / 8) * 1000;  // 英文：每秒 8 字
const calculatedDuration = chineseDuration + nonChineseDuration;

// 上限 15 秒
const displayDuration = Math.min(calculatedDuration, 15000);

setTimeout(() => {
  setShowLoveButton(true);
}, displayDuration);
```

#### 入场诗句淡入时长

```typescript
// 根据每句字符数分配时间
const charCounts = [5, 11, 11, 6, 6, 18, 6, 6];  // 每句的字符数

// 总时长 8 秒，按字符数比例分配
const getLineStartTime = (index: number): number => {
  const totalChars = 65;  // 总字符数
  const totalDuration = 8;
  
  let startTime = 0;
  for (let i = 0; i < index; i++) {
    startTime += (charCounts[i] / totalChars) * totalDuration;
  }
  return startTime + index * 0.5;  // 每句增加 0.5 秒 delay
};
```

---

### 3. 环境变量管理

#### 配置文件

```bash
# .env.local（不提交到 Git）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

#### 代码中读取

```typescript
// Vite 项目使用 import.meta.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 启动时检查
if (!apiKey) {
  throw new Error('缺少 Gemini API Key！请检查 .env.local 文件');
}
```

#### 各平台适配

| 平台 | 环境变量方案 |
|------|-------------|
| **Web (Vite)** | `import.meta.env.VITE_*` |
| **React Native** | `react-native-config` 或 `@env` |
| **微信小程序** | 配置文件 + `wx.getEnvInfoSync()` |
| **Electron** | `process.env.*` |

---

### 4. 错误处理规范

```typescript
try {
  // 1. AI 调用
  const poem = await generatePoem(keyword, mood);
  setPoemData(poem);
  
  // 2. 异步保存
  savePoemToDatabase(poem.content, poem.poem_title, poem.author, keyword);
  
} catch (error) {
  // 3. 详细日志
  console.error('❌ AI 调用失败，完整错误信息：', error);
  console.error('错误类型:', error instanceof Error ? error.message : String(error));
  
  // 4. 容错机制
  console.log('🔄 尝试从数据库读取备用诗句...');
  const fallbackPoem = await getRandomPoemFromDatabase();
  
  if (fallbackPoem) {
    setPoemData(fallbackPoem);
    console.log('✅ 使用数据库备用诗句');
  } else {
    alert('获取诗句失败，且数据库中暂无备用诗句。请稍后重试。');
  }
  
} finally {
  // 5. 确保重置加载状态
  setIsLoading(false);
}
```

---

## 七、平台迁移指南

### 1. React Native 迁移

#### 功能对比表

| Web 实现 | React Native 替代方案 | 难度 |
|----------|---------------------|------|
| **Canvas 粒子** | `react-native-skia` 或 `react-native-canvas` | ⭐⭐⭐ |
| **物理引擎** | `react-native-reanimated` + 自定义逻辑 | ⭐⭐ |
| **背景渐变** | `<LinearGradient>` (expo-linear-gradient) | ⭐ |
| **Gemini API** | `fetch`（保持相同） | ✅ |
| **Supabase** | `@supabase/supabase-js`（保持相同） | ✅ |
| **Emoji 渲染** | Text 组件（原生支持） | ✅ |
| **模糊效果** | `<BlurView>`（expo-blur） | ⭐ |

#### 示例代码

```jsx
// App.tsx (React Native)
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas } from '@shopify/react-native-skia';

export default function App() {
  return (
    <LinearGradient
      colors={['#0a0e27', '#1a1a3e']}
      style={{ flex: 1 }}
    >
      {/* Canvas 粒子系统 */}
      <Canvas style={{ flex: 1 }}>
        {/* Skia 绘制逻辑 */}
      </Canvas>
      
      {/* Emoji 按钮 */}
      {EMOJI_MOODS.map((item, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handleEmojiClick(item.keyword, item.mood)}
          style={[styles.emojiButton, emojiPositions[index]]}
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
        </TouchableOpacity>
      ))}
    </LinearGradient>
  );
}
```

#### 优化建议

1. **粒子数量**: 120 → 50 个（性能考虑）
2. **物理引擎**: 简化碰撞检测，使用 `Animated` API
3. **环境变量**: 使用 `react-native-config`

---

### 2. 微信小程序迁移

#### 功能对比表

| Web 实现 | 小程序替代方案 | 难度 |
|----------|---------------|------|
| **Canvas 粒子** | `<canvas>` + Canvas 2D API | ⭐⭐⭐ |
| **物理引擎** | 简化为 CSS 动画（取消碰撞） | ⭐⭐ |
| **背景渐变** | CSS `linear-gradient` | ✅ |
| **Gemini API** | `wx.request()` + 配置白名单 | ⭐ |
| **Supabase** | 云开发数据库 或 REST API | ⭐⭐ |
| **Emoji 渲染** | `<text>`（原生支持） | ✅ |
| **模糊效果** | CSS `backdrop-filter`（部分支持） | ⭐ |

#### 示例代码

```javascript
// pages/index/index.js
Page({
  data: {
    emojiMoods: [
      { emoji: '😊', mood: '快乐', keyword: 'happy' },
      // ...
    ],
    poemData: null,
    isLoading: false
  },

  handleEmojiClick(e) {
    const { keyword, mood } = e.currentTarget.dataset;
    
    this.setData({ isLoading: true });

    // 调用云函数或直接请求 Gemini API
    wx.cloud.callFunction({
      name: 'generatePoem',
      data: { keyword, mood }
    }).then(res => {
      this.setData({
        poemData: res.result,
        isLoading: false
      });
    }).catch(err => {
      console.error('AI 调用失败', err);
      // 容错：从云数据库读取
      this.getRandomPoemFromDB();
    });
  }
});
```

#### 注意事项

1. **服务器域名配置**: 
   - Gemini API: `https://generativelanguage.googleapis.com`
   - Supabase: `https://*.supabase.co`

2. **Canvas 性能优化**:
   - 粒子数减少到 30 个
   - 使用 `canvas-2d` 类型（性能更好）

3. **环境变量管理**:
   ```javascript
   // config.js
   module.exports = {
     GEMINI_API_KEY: '***',
     SUPABASE_URL: '***'
   };
   ```

---

### 3. Electron 桌面应用迁移

#### 功能对比表

| Web 实现 | Electron 方案 | 难度 |
|----------|--------------|------|
| **所有前端功能** | 完全保持（使用 Web 技术栈） | ✅ |
| **API Key 安全** | 使用 IPC 通信 + 后端管理 | ⭐⭐ |
| **性能提升** | 可增加粒子数到 200 个 | ✅ |

#### API Key 安全管理

```javascript
// main.js (主进程)
const { ipcMain } = require('electron');

ipcMain.handle('generate-poem', async (event, keyword, mood) => {
  // 在主进程中调用 API，保护 API Key
  const response = await fetch(API_URL, {
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY  // 从环境变量读取
    },
    // ...
  });
  return response.json();
});
```

```typescript
// renderer.ts (渲染进程)
const { ipcRenderer } = require('electron');

async function generatePoem(keyword: string, mood: string) {
  // 通过 IPC 调用主进程
  const result = await ipcRenderer.invoke('generate-poem', keyword, mood);
  return result;
}
```

#### 打包配置

```json
// package.json
{
  "name": "blind-poem",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "build": {
    "appId": "com.blindpoem.app",
    "mac": {
      "category": "public.app-category.entertainment"
    },
    "win": {
      "target": "nsis"
    }
  }
}
```

---

### 4. 迁移决策矩阵

| 功能 | Web | RN | 小程序 | Electron |
|------|-----|----|----|---------|
| **Canvas 粒子** | ✅ 120 个 | ⚠️ 50 个 | ⚠️ 30 个 | ✅ 200 个 |
| **物理引擎** | ✅ 完整 | ⚠️ 简化 | ❌ 取消 | ✅ 完整 |
| **AI 调用** | ✅ | ✅ | ⚠️ 需云函数 | ✅ IPC 安全 |
| **数据库** | ✅ | ✅ | ⚠️ 云开发 | ✅ |
| **性能** | 🌟🌟🌟 | 🌟🌟 | 🌟 | 🌟🌟🌟🌟 |
| **开发成本** | 低 | 中 | 中高 | 低 |

---

## 八、核心依赖

### package.json

```json
{
  "name": "blind-poem",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.33",
    "eslint": "^8.55.0"
  }
}
```

### 技术栈版本

| 技术 | 当前版本 | 说明 |
|------|---------|------|
| React | 18.3.1 | 函数组件 + Hooks |
| TypeScript | 5.2.2 | 类型安全 |
| Vite | 5.0.8 | 快速开发服务器 |
| Tailwind CSS | 4.0.0 | 实用优先样式 |
| Supabase JS | 2.39.0 | 数据库客户端 |

### 无需 SDK 的服务

- **Gemini AI**: 直接使用 REST API（`fetch`）
- **自定义字体**: `/public/QianTuBiFengShouXieTi-2.ttf`

---

## 九、总结

### 架构优势

#### ✅ 1. 无服务器架构
- 完全依赖云服务（Gemini AI + Supabase）
- 无需自建后端，降低运维成本
- 快速部署到 Vercel/Netlify

#### ✅ 2. 类型安全
- TypeScript 全覆盖
- 明确的接口定义（`Poem`、`PoemResponse`、`EmojiMood`）
- 减少运行时错误

#### ✅ 3. 容错机制
- AI 失败自动降级到数据库
- 数据库去重（唯一性检查）
- 详细的错误日志（emoji 前缀）

#### ✅ 4. 性能优化
- `useMemo` 缓存粒子数据
- Canvas `requestAnimationFrame` 优化渲染
- CSS `will-change` + GPU 加速
- 异步数据库写入（不阻塞 UI）

#### ✅ 5. 模块化设计
- 核心逻辑封装在 `lib/` 目录
- 易于测试和复用
- 清晰的文件结构

---

### 迁移核心要点

#### 保留不变的部分

1. **AI 调用逻辑**
   - REST API 调用方式
   - Prompt 模板设计
   - JSON 解析逻辑

2. **数据持久化**
   - Supabase 客户端（跨平台兼容）
   - 唯一性检查逻辑
   - 容错机制

3. **状态管理**
   - React Hooks 模式（RN 可保持）
   - 状态设计思路

4. **业务逻辑**
   - Emoji 心情配置
   - 赞赏功能流程
   - 动画时长计算

---

#### 需要适配的部分

| 功能 | Web | RN | 小程序 | Electron |
|------|-----|----|----|---------|
| **Canvas 粒子** | Canvas API | Skia/Canvas | Canvas 2D | Canvas API |
| **物理引擎** | RAF 循环 | Reanimated | CSS 动画 | RAF 循环 |
| **背景渐变** | CSS | LinearGradient | CSS | CSS |
| **环境变量** | `import.meta.env` | `react-native-config` | `config.js` | `process.env` |
| **API Key 安全** | 客户端 | 客户端 | 云函数 | IPC 主进程 |

---

#### 优化建议

| 平台 | 优化方向 |
|------|---------|
| **移动端** | 粒子数 120 → 50，简化物理引擎 |
| **小程序** | 粒子数 120 → 30，取消物理引擎，使用云函数保护 API Key |
| **桌面端** | 粒子数 120 → 200，增强视觉效果 |

---

### 快速迁移检查清单

- [ ] 复制核心逻辑（`lib/` 目录）
- [ ] 适配 Canvas 渲染方式
- [ ] 调整粒子数量（根据平台性能）
- [ ] 配置环境变量管理
- [ ] 测试 AI 调用（网络请求）
- [ ] 测试数据库连接（Supabase 或云开发）
- [ ] 适配物理引擎（或简化）
- [ ] 优化动画性能
- [ ] 配置部署流程

---

## 附录

### A. 文件清单

```
BlindPoem/
├── src/
│   ├── App.tsx                  # 主应用组件（1253 行）
│   ├── App.css                  # 应用样式和动画
│   ├── index.css                # 全局样式
│   ├── main.tsx                 # React 入口
│   └── lib/
│       ├── geminiClient.ts      # Gemini AI 调用（227 行）
│       ├── poemService.ts       # 数据库操作（94 行）
│       └── supabaseClient.ts    # Supabase 配置（25 行）
├── public/
│   ├── QianTuBiFengShouXieTi-2.ttf  # 自定义字体
│   └── qrcode.jpg               # 赞赏二维码
├── .env.local                   # 环境变量（不提交）
├── package.json                 # 依赖配置
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # Tailwind 配置
└── tsconfig.json                # TypeScript 配置
```

### B. 环境变量模板

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=AIzaSy...
```

### C. Supabase 数据库 SQL

```sql
-- 创建诗句表
CREATE TABLE poems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL UNIQUE,
  poem_title TEXT,
  author TEXT,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_poems_mood ON poems(mood);
CREATE INDEX idx_poems_created_at ON poems(created_at DESC);

-- 启用 RLS
ALTER TABLE poems ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Enable read access for all users" ON poems
  FOR SELECT USING (true);

-- 允许所有人插入
CREATE POLICY "Enable insert for all users" ON poems
  FOR INSERT WITH CHECK (true);
```

### D. 参考资源

- [Gemini API 文档](https://ai.google.dev/gemini-api/docs)
- [Supabase 文档](https://supabase.com/docs)
- [React Native Skia](https://shopify.github.io/react-native-skia/)
- [微信小程序 Canvas 2D](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html)
- [Electron 文档](https://www.electronjs.org/docs)

---

**文档版本**: 1.0  
**最后更新**: 2025-10-11  
**作者**: BlindPoem Team  
**项目地址**: `/Users/dyl/GitHub/BlindPoem`


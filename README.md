# BlindPoem

## 诗句出处核验

AI 生成接口只返回诗句，不直接提供作者和篇名。页面展示诗句后会异步调用 `/api/verify-poem`。后端先按标准化诗句查询 Supabase：`verified` 直接返回署名，当前规则确认的 `not_found` 直接保持不署名，只有 `pending`、旧规则留下的 `not_found` 或冷却期结束的 `retryable_error` 才重新核验。

新诗句先由 DeepSeek 仅根据完整展示内容提出作者和篇名候选；英文诗句要求使用规范英文作者名和英文原篇名展示。第二次独立请求以“优先找错”的方式复核整段内容，只有返回 `exact` 才进入 Tavily，并同时给出少量可靠的中英文作者别名和篇名译名。搜索查询同时携带完整诗句、作者和篇名，最终必须由同一个搜索来源的标题、摘要或完整 `raw_content` 同时支持诗句、任一已确认作者别名和任一已确认篇名别名。网页正文不会发送给 AI，因此两次请求都保持很短；搜索完整内容只用于服务端字符串校验。

搜索只检查相关度最高的前 5 个来源，先用网页标题和搜索摘要做快速验证；只有这些轻量证据不足时才再次请求完整 `raw_content`。任意一个来源完整支持三项即可通过，不要求所有网站一致。英文诗句除连续全文匹配外，也允许各分句按原顺序出现、分句之间插入中文翻译；所有英文分句仍必须齐全且顺序一致。作者和篇名仍须来自同一个来源，但网站使用中文译名、英文原名或二者混排均可通过。

正常完成搜索但没有可信出处会记录为版本化的 `not_found`；AI 第一次未知、复核不确定或否定候选会记录为短期 `retryable_error`，24 小时后允许重新判断。Tavily/DeepSeek 超时、限流、缺少密钥或程序错误也只记录为 `retryable_error`，默认一小时后允许重试，不会被误判成没有作者。核验结果由服务端写回数据库，数据库因此也是跨浏览器、跨 Vercel 实例的持久化核验缓存。

Tavily 技术错误会保留具体原因：摘要或正文搜索超时、HTTP 状态码以及非法响应不再统一写成 `verification_error`。搜索超时和 `5xx` 冷却 5 分钟，`429` 与非法响应冷却 10 分钟；鉴权、配置等其他错误仍按默认一小时处理。

DeepSeek 两次调用也会分别记录候选阶段或复核阶段，以及超时、网络错误、HTTP 状态、空响应、非法响应和非法 JSON。临时故障冷却 5 分钟，限流与响应格式故障冷却 10 分钟；旧版统一的 `ai_review_error` 也按 5 分钟处理。这样后续可以直接判断失败发生在哪一步，而不再只有一个笼统原因。

署名必须由同一个搜索来源完整支持当前展示的整段诗句。只命中其中一个分句时记录为 `partial_poem_match` 并保持不署名，避免把 AI 拼接内容整体误认作真实诗人的作品。

服务实例首次核验及每 10 分钟最多调用一次不消耗搜索额度的 Tavily Usage 接口；发现 Key 用量达到上限，或 Tavily Search 返回 `432`（套餐额度耗尽）/`433`（Pay-As-You-Go 上限）时，会熔断搜索至下一个自然月。期间不再发起 Tavily Search，已有数据库署名仍可直接显示。`429`、超时和 `5xx` 只按临时错误处理，不触发整月熔断。

Vercel 服务端环境变量：

```text
TAVILY_API_KEY=tvly-...
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SECRET_KEY=你的_sb_secret_服务端密钥
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

已有 `VITE_SUPABASE_URL` 时可以不再添加 `SUPABASE_URL`。服务端密钥优先使用 Supabase 当前推荐的 `SUPABASE_SECRET_KEY`（值以 `sb_secret_` 开头）；旧项目也兼容 `SUPABASE_SERVICE_ROLE_KEY`，二者只需配置一个。服务端密钥不能使用 `VITE_` 前缀，也不能出现在浏览器代码中。浏览器会缓存已核验及数据库已确认未找到的结果 30 天，数据库记录是最终依据。

首次上线前，在 Supabase SQL Editor 中执行 [`supabase/attribution-verification-migration.sql`](supabase/attribution-verification-migration.sql)。迁移会保留旧诗句、点赞、心情和时间，只清空旧作者与篇名并标记为 `pending`，之后在诗句实际出现时逐步核验。

## 诗句去重

每次点击都会优先请求 AI，并以 50% 概率按当前情绪选诗、50% 概率完全不参考情绪；发送给 AI 的提示词不会提及 emoji。服务端每次请求都会生成新的高熵随机采样标志，并随机选择语言、时代和一个轻量取景偏好，要求模型在质量相当时避开最常见的第一联想；随机标志不会出现在结果中。同一请求切换备用模型时沿用同一个 prompt。浏览器会在 AI 返回后用代码检查最近最多 20 条结果；发现重复时不再调用 AI，直接从数据库随机选取一条。数据库与本地备用池都不会返回浏览器最近 20 条中的诗句。

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

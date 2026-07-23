# BlindPoem

## 诗句出处核验

AI 生成接口只返回诗句，不直接提供作者和篇名。页面展示诗句后会异步调用 `/api/verify-poem`。后端先按标准化诗句查询 Supabase：`verified` 直接返回署名，当前规则确认的 `not_found` 直接保持不署名，只有 `pending`、旧规则留下的 `not_found` 或已过一小时冷却期的 `retryable_error` 才调用一次 Tavily。搜索使用“完整诗句 + 作者”；后端先确认完整诗句并将最多 3 条结果裁剪成诗句附近的短证据卡，DeepSeek 一次性提取作者和篇名，最终仍由后端检查原句、作者和篇名是否同时出现在 AI 指定的来源中。

正常完成搜索但没有可信出处会永久记录为 `not_found`；Tavily/DeepSeek 超时、限流、缺少密钥或程序错误只记录为 `retryable_error`，不会被误判成没有作者。核验结果由服务端写回数据库，数据库因此也是跨浏览器、跨 Vercel 实例的持久化核验缓存。

署名必须由同一个搜索来源完整支持当前展示的整段诗句。只命中其中一个分句时记录为 `partial_poem_match` 并保持不署名，避免把 AI 拼接内容整体误认作真实诗人的作品。

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

每次点击都会优先请求 AI，并以 50% 概率按当前情绪选诗、50% 概率完全不参考情绪；发送给 AI 的提示词不会提及 emoji。提示词随机选择语言和时代，不限定风格或名句偏好，也不携带历史诗句。浏览器会在 AI 返回后用代码检查最近最多 20 条结果；发现重复时不再调用 AI，直接从数据库随机选取一条。数据库与本地备用池都不会返回浏览器最近 20 条中的诗句。

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

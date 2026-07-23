# BlindPoem

## 诗句出处核验

AI 生成接口只返回诗句，不直接提供作者和篇名。页面展示诗句后会异步调用 `/api/verify-poem`：每首未缓存诗句只调用一次 Tavily，搜索“辨识度最高的单句 + 作者”；后端规则优先提取，规则无法处理时 DeepSeek 只分析同一批搜索片段，最终仍由后端检查原句、作者和篇名之间的证据关系。核验成功才显示署名并写入公共诗库，失败或超时则只显示诗句。

Vercel 服务端环境变量：

```text
TAVILY_API_KEY=tvly-...
```

不要使用 `VITE_` 前缀。浏览器会缓存已核验结果 30 天、未找到结果 10 分钟，以减少搜索额度消耗并避免短暂搜索波动长期影响结果。

## 诗句去重

每次点击都会优先请求 AI，并以 50% 概率按当前情绪选诗、50% 概率完全不参考情绪；发送给 AI 的提示词不会提及 emoji。提示词随机选择语言和时代，不限定风格或名句偏好，也不携带历史诗句。浏览器会在 AI 返回后用代码检查最近最多 20 条结果；发现重复时会再请求一次，两次仍不可用才从数据库回退。数据库不区分新旧数据，从全部有效诗句中等概率随机抽取，并尽量排除当前浏览器最近 N 条。

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

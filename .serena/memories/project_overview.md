# EclipseTab 项目概览

- 项目定位：浏览器新标签页扩展（个性化工作台），核心是 Zen Shelf（贴纸白板）+ Focus Spaces（多空间）+ Dock + 搜索。
- 当前版本：2.0.0（重大更新）。
- 技术栈：React 18 + TypeScript 5 + Vite 4；Manifest V3 扩展清单在 `public/manifest.json`。
- 代码主目录：`src/`，入口 `src/main.tsx`，应用根组件 `src/App.tsx`。
- 主要模块：
  - `src/components/`：界面模块（Dock/Searcher/Modal/ZenShelf 等）
  - `src/context/`：全局状态（Dock/Theme/Language/Spaces）
  - `src/hooks/`：交互与逻辑复用（拖拽、搜索建议等）
  - `src/constants/`/`src/types/`/`src/utils/`：常量、类型、工具
- 构建产物：`dist/`（扩展加载目录）。
- 测试现状：无自动化测试框架，依赖 `npm run build` + 手工回归。
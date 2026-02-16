# EclipseTab 代码风格与约定

- 语言与范式：TypeScript + React 函数组件 + Hooks。
- 命名：
  - 组件文件 `PascalCase.tsx`
  - Hook `useXxx`
  - 常量 `UPPER_SNAKE_CASE`
- 样式：CSS Modules（`*.module.css`）+ 全局变量（`src/styles/variables.css`）。
- 改动原则：
  - 保持原有视觉风格与交互语言
  - 避免无关格式化大改
  - 优先小范围、可验证变更
- 国际化：文案在 `src/context/LanguageContext.tsx` 维护（中英双语）。
- 质量门槛：项目当前无 lint/test 脚本，默认以 `npm run build` 通过为基础门槛。
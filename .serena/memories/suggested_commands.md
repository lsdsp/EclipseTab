# EclipseTab 常用命令（Windows / PowerShell）

## 开发与构建
- `npm install`：安装依赖
- `npm run dev`：启动本地开发服务
- `npm run build`：TypeScript 编译 + 生产构建
- `npm run preview`：预览构建结果

## Git 常用
- `git status --short`
- `git diff -- <path>`
- `git log --oneline -n 20`

## 文件与检索
- 列目录：`Get-ChildItem`
- 全文检索（优先）：`rg -n "pattern" src`
- 查看文件：`Get-Content <file>`

## 扩展本地验证
1. 先执行 `npm run build`
2. 浏览器扩展开发者模式加载 `dist/`
# 任务收尾清单

- 构建校验：`npm run build` 必须通过。
- 手工验证：覆盖本次变更相关的关键交互路径。
- 版本同步（涉及发布时）：
  - `package.json`
  - `package-lock.json`
  - `public/manifest.json`
  - README 文档（至少 `README.md`，必要时同步 `README-en.md` / `README-tech.md`）
- 变更范围控制：尽量只提交与需求直接相关文件，避免夹带 `dist/` 产物（除非明确要求）。
- 最终汇报：说明改动文件、验证结果、未执行项与原因。
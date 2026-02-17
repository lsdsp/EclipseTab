# EclipseTab第二次改进建议

---

## 1) 搜索建议在生产环境里大概率“永远拿不到数据”

你现在的建议逻辑会在检测到 `chrome.permissions.contains`​ 存在时，​**必须先拥有 Google 的 optional host 权限**​，否则直接 `return []`​，连百度 fallback 都不尝试（`src/hooks/searchSuggestions.ts`）

- 文件：`src/hooks/searchSuggestions.ts`​（e8f7e1d）  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/hooks/searchSuggestions.ts?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/hooks/searchSuggestions.ts?raw=1)
- 但 UI 侧（Searcher）没有任何地方去 `permissions.request`​（`src/components/Searcher/Searcher.tsx`​）  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/components/Searcher/Searcher.tsx?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/components/Searcher/Searcher.tsx?raw=1)
- manifest 里是 `optional_host_permissions`​（不会自动授权），必须运行时请求：  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/public/manifest.json?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/public/manifest.json?raw=1)

✅ 建议怎么改（两点一起做，体验会立刻变好）：

1. ​**权限判断按“每个 API 域名”分别判断**：

   - 有 Google 权限：先 Google，空再 Baidu
   - 没 Google 但有 Baidu：直接 Baidu
   - 两个都没：返回空，并在 UI 提示“点击启用建议（请求权限）”
2. 在设置里或首次使用建议时触发一次：`chrome.permissions.request({ origins: [...] })`

---

## 2) storage 的内存缓存很棒，但要防“引用被外部修改”

​`src/utils/storage.ts`​ 新增了 memory cache + raw string 对比（👍），但 `getConfig()/getSpaces()/getStickers()`​ 这些会把 **同一个对象/数组引用** 直接返回出去。  
一旦调用方不小心原地修改（push/assign），就可能出现：缓存数据变了但 raw 没变、状态和持久化不同步的怪问题。

- 文件：`src/utils/storage.ts`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/utils/storage.ts](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/utils/storage.ts)

✅ 建议：

- 返回值做浅拷贝（数组 `return [...arr]`​，对象 `return { ...obj }`​），或在 DEV 下 `Object.freeze`/深 freeze（线上不 freeze）。
- 同时可以监听 `window.addEventListener('storage', ...)` 做跨标签页同步（至少把 cache 置空）。

---

## 3) 图标压缩工具对“网络 URL 图标”目前是 no-op（可能和你的目标不一致）

​`compressIcon()`​ 一开始就判断 `dataUrl.startsWith('data:image')`​，否则直接返回原值。  
这意味着：如果你的图标来源是在线 favicon URL（不是 data URL），压缩不会发生（`src/utils/imageCompression.ts`）。

- 文件：`src/utils/imageCompression.ts`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/utils/imageCompression.ts](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/utils/imageCompression.ts)

✅ 你可以二选一：

- ​**如果你就是要存 URL**（省空间、但依赖网络）：把注释/命名改清楚，别叫“压缩图标”以免误导。
- ​**如果你想离线可用 + 控制 localStorage 体积**​：加一条路径：`fetch(url) -> blob -> (createImageBitmap/Image) -> canvas -> webp dataURL`，然后再做 192px 压缩。

---

## 4) `@types/node` 与 CI/Node 版本不一致，后面很容易踩类型坑

你 CI 是 Node 20（`ci.yml`​），但 `package.json`​ 里是 `@types/node: ^24.10.1`。这类错配很容易带来“类型绿了、运行/构建却奇怪”的问题。

- CI：`/.github/workflows/ci.yml`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.github/workflows/ci.yml?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.github/workflows/ci.yml?raw=1)
- 依赖：`package.json`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/package.json?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/package.json?raw=1)

✅ 建议：

- 要么把 `@types/node`​ 降到 `^20.x`
- 要么把 CI/本地 Node 统一升级到你想用的版本（并同步检查 Vite/TS 的兼容）

---

## 5) ESLint 现在能跑，但还缺“React 维度”的常见质量门

你已经有 `eslint`​ + `react-hooks`​（很不错），但没有 `eslint-plugin-react`​，很多 JSX/React 规范问题不会被抓到。  
另外 `lint`​ 脚本没覆盖 `.e2e-tests` 等目录。

- ESLint 配置：`.eslintrc.cjs`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.eslintrc.cjs?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.eslintrc.cjs?raw=1)
- scripts：`package.json`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/package.json?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/package.json?raw=1)

✅ 建议：

- 加 `eslint-plugin-react`​ + `plugin:react/recommended`​ + `settings.react.version=detect`
- ​`lint`​ 改成 `eslint . --ext .ts,.tsx`​（靠 ignorePatterns 排除），并在 CI 用 `--max-warnings=0`

---

## 6) Vitest 配置了 coverage，但脚本没打开（可以顺手加“质量阈值”）

你 `vitest.config.ts`​ 里已经写了 coverage reporter，但 `test:unit`​ 是 `vitest run`，默认不产出 coverage。

- 文件：`vitest.config.ts`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/vitest.config.ts?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/vitest.config.ts?raw=1)

✅ 建议：

- 新增脚本：`test:unit:cov`​: `vitest run --coverage`
- CI 里加一步上传 `.coverage` 或接入 codecov（看你是否需要）
- 可选：设一个很低的门槛（比如 statements 30% 起步），避免以后完全失守

---

## 7) 搜索建议的 requestId 用 Date.now()，极端情况下会撞（小概率但容易修）

​`useSearchSuggestions`​ 里用 `req_${Date.now()}` 标识请求，如果同一毫秒触发两次（比如输入法/自动填充/程序触发），会冲突。

- 文件：`src/hooks/useSearchSuggestions.ts`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/hooks/useSearchSuggestions.ts?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/src/hooks/useSearchSuggestions.ts?raw=1)

✅ 建议：

- 用自增计数器 `let seq = 0; current = ++seq`（最简单稳）
- 或 `crypto.randomUUID()`（浏览器支持好，但要考虑兼容）

---

## 8) Firefox `strict_min_version: 140.0` 这个值要确认是不是故意的

manifest 里 `browser_specific_settings.gecko.strict_min_version`​ 设成了 `140.0`​：  
[https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/public/manifest.json?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/public/manifest.json?raw=1)

如果你目标是 Firefox 稳定版用户，这个门槛可能会直接把大量用户挡在门外；如果你只想跑 Nightly/某些新 API，那就 OK，但建议在 README/发布说明里写清楚原因。

---

## 9) CI 虽然成功，但 E2E 这块可以再“更稳/更快”（非必做）

你在 Windows runner 跑 `msedge`​ channel：Playwright 可以直接用系统自带 Edge，所以即使 `playwright install`​ 没装 msedge 也可能照样通过（这也解释了你 CI 成功）。  
如果你希望本地/其他环境也一致，才需要把 `msedge` 加进 install；否则现在这样也能用。

- CI：`ci.yml`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.github/workflows/ci.yml?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.github/workflows/ci.yml?raw=1)
- Playwright：`playwright.config.ts`​  
  [https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.e2e-tests/playwright.config.ts?raw=1](https://github.com/lsdsp/EclipseTab/blob/e8f7e1d/.e2e-tests/playwright.config.ts?raw=1)

---

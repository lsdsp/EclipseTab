<div align="center">

# 🌟 Eclipse Tab

### 新一代浏览器新标签页扩展

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Available-brightgreen?logo=googlechrome)](https://chromewebstore.google.com/detail/eclipse-tab/lcnmbgidemidmfffplkpflpdpmfdgabp)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Available-blue?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/eclipse-tab/omlbmhdkajhbcdhjdgjalelbbmjoekfj)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Available-orange?logo=firefox)](https://addons.mozilla.org/zh-CN/firefox/addon/eclipse-tab/)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

[English](README-en.md) | 简体中文

![Eclipse Tab 预览](https://github.com/user-attachments/assets/f7674f4f-3830-43bc-8ac4-00fdc0ceec7d)

**✨ 灵感白板 · 🌐 多重空间 · 🎨 美观高效**

**当前版本：`v2.0.0`（重大更新）**

</div>

<br>

> 💡 **AI 驱动开发** - 本项目 90% 使用 AI 辅助编码（VibeCoding）开发

Eclipse Tab 是一款功能强大的浏览器新标签页扩展，以 **Zen Shelf（灵感白板）** 和 **Focus Spaces（多重空间）** 为核心，让你的浏览器成为创意工作站和效率中心。

<br>

## 🚨 v2.0.0 重大更新

- 搜索引擎管理重构：新增“自定义”入口，支持无限引擎数量与 `{query}` / `%s` 占位符。
- 删除能力升级：全局编辑模式下可删除已保存搜索引擎（删除前二次确认）。
- 安全约束强化：Google 固定为第一位且不可删除，同时不允许将已保存引擎删除到 0 个。
- 搜索体验优化：设置中新增“新标签页”开关，控制搜索结果是否在新标签页打开。
- 隐私增强：新增“第三方图标服务”开关，默认关闭；首次开启会弹出说明提示。
- 文案精简：移除搜索框左侧“search by/使用”以及菜单顶部“使用”“系统默认”等冗余文案。
- 编辑模式增强：`Esc` 全局默认可退出编辑模式；编辑模式下左键单击文字贴纸可直接进入编辑。
- 贴纸字体新增：新增“字体”配置，支持“手写 / 普通 / 代码”三种预设字体。
- 存储策略升级：壁纸与贴纸图片资源使用 IndexedDB 存储，localStorage 仅保存轻量配置与元信息。

<br>

## 📖 目录

- [✨ 产品简介](#-产品简介)
- [📦 安装使用](#-安装使用)
- [🎯 核心功能](#-核心功能)
- [💡 使用技巧](#-使用技巧)
- [❓ 常见问题](#-常见问题)

<br>

## ✨ 产品简介

Eclipse Tab 将你的浏览器新标签页变成一个强大的工作台：

- ✏️ **Zen Shelf（灵感白板）** - 随时随地记录灵感，支持文字和图片贴纸
- 🌐 **Focus Spaces（多重空间）** - 为不同场景创建独立工作空间
- 🎨 **精美主题** - 多种主题模式，自定义壁纸

<br>

## 📦 安装使用

### 🎯 从扩展商店安装（推荐）

| 浏览器 | 安装链接 |
|:---|:---|
| <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/chrome/chrome_48x48.png" width="24" /> **Chrome** | [Chrome 扩展商店](https://chromewebstore.google.com/detail/eclipse-tab/lcnmbgidemidmfffplkpflpdpmfdgabp?utm_source=ext_app_menu) |
| <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/edge/edge_48x48.png" width="24" /> **Edge** | [Edge 扩展商店](https://microsoftedge.microsoft.com/addons/detail/eclipse-tab/omlbmhdkajhbcdhjdgjalelbbmjoekfj?hl=zh-cn) |
| <img src="https://raw.githubusercontent.com/alrra/browser-logos/main/src/firefox/firefox_48x48.png" width="24" /> **Firefox** | [Firefox 扩展商店](https://addons.mozilla.org/zh-CN/firefox/addon/eclipse-tab/) |

### 🛠️ 手动安装

<details>
<summary>📋 点击展开手动安装步骤</summary>

<br>

**Chrome / Edge**
1. 下载项目并解压
2. 打开 `chrome://extensions/` 或 `edge://extensions/`
3. 开启“开发者模式”
4. 点击“加载已解压的扩展程序”，选择 `dist` 文件夹

</details>

### 🦊 Zen Browser 使用方法

<details>
<summary>📋 点击展开 Zen Browser 配置步骤</summary>

<br>

Zen Browser 基于 Firefox，需要额外配置才能正常使用 Eclipse Tab：

1. 按照上述 Firefox 的方式安装扩展
2. 点击新建标签页，在地址栏输入 `about:config`
3. 在搜索框中输入 `zen.urlbar.replace-newtab`
4. 将该选项的值设置为 `false`（禁用）
5. 重新打开新标签页即可使用 Eclipse Tab

> 💡 **提示**：这个设置用于禁用 Zen Browser 自带的新标签页弹窗，让 Eclipse Tab 能够正常显示。

</details>

### 🚀 开始使用

安装后打开新标签页：

```
1️⃣ 添加应用 → 点击编辑按钮添加常用网站
2️⃣ 创建空间 → 右键 Dock 栏右侧的空间按钮创建工作空间
3️⃣ 记录灵感 → 双击页面添加贴纸
4️⃣ 个性化 → 设置主题和壁纸
```

<br>

## 🎯 核心功能

<table>
<tr>
<td width="50%" valign="top">

### ✏️ Zen Shelf - 灵感白板

> 将新标签页变成自由的创意空间，像桌面便签纸和照片墙一样随时记录灵感。

- 📝 **文字贴纸** - 快速记录想法，自定义样式
- 🖼️ **图片贴纸** - 保存灵感图片，自由缩放
- 🎭 **自由布局** - 拖拽摆放，自动避让界面元素

</td>
<td width="50%" valign="top">

### 🌐 Focus Spaces - 多重空间

> 为不同场景创建独立工作空间，实现工作、学习、娱乐的完美分离。

- 🗂️ **多空间管理** - 创建、切换、导入导出空间
- 📋 **独立应用列表** - 每个空间有自己的应用
- 💼 **场景化使用** - 工作、学习、娱乐互不干扰

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🚀 Dock 应用栏

> macOS 风格的应用管理，优雅高效。

- 📌 **快速访问** - 常用网站一键打开
- 📁 **文件夹整理** - 拖拽创建文件夹，保持整洁
- ✨ **流畅动画** - 优雅的交互体验

</td>
<td width="50%" valign="top">

### 🎨 精美主题

> 个性化你的新标签页，多种主题模式和自定义选项。

- 🌈 **四种模式** - Default、Light、Dark、Auto 自动跟随系统
- 🖼️ **自定义背景** - 渐变色、纯色、上传壁纸，支持纹理叠加
- 🎯 **智能适配** - 自动调整文字颜色，确保可读性

</td>
</tr>
</table>

---

## 💡 使用技巧

> 这里列出一些容易被忽略的功能和交互方式，帮助你更好地使用 Eclipse Tab。

### 🎯 界面交互

- **设置入口**：鼠标移动到页面**左上角**会出现设置图标 ⚙️，点击可进入设置
- **编辑模式**：鼠标移动到页面**右上角**会出现编辑按钮 ✏️，点击可编辑 Dock 应用

### ✏️ Zen Shelf 技巧

- **双击创建**：双击页面空白处快速创建文字贴纸
- **粘贴图片**：使用 `Ctrl+V` 可以直接粘贴剪贴板中的图片
- **双击编辑**：双击文字贴纸可以重新编辑内容
- **编辑模式快改**：进入编辑模式后，左键单击文字贴纸可直接编辑
- **导出图片**：文字贴纸支持导出为图片，方便分享
- **自动置顶**：点击贴纸会自动置顶，确保重要内容始终可见
- **回收站**：误删贴纸可从屏幕边缘回收站恢复或清除
- **存储优化**：贴纸图片会自动存入 IndexedDB，大图场景更稳定

### 🚀 Dock 技巧

- **长按编辑**：点击右上角编辑按钮、长按 Dock 图标或使用右键菜单可以进入编辑模式
- **创建文件夹**：拖拽一个应用到另一个应用上会自动创建文件夹
- **自动解散**：文件夹中少于 2 个应用时会自动解散
- **图标隐私**：第三方图标服务默认关闭；关闭时仅尝试站点自身图标，失败时使用本地生成图标

### 🌐 Focus Spaces 技巧

- **循环切换**：点击 Dock 栏最右侧的空间切换按钮可以循环切换不同空间
- **空间管理**：右键 Dock 栏最右侧的空间切换按钮可以置顶空间、修改空间名称、删除空间、导入导出空间配置

---

## ❓ 常见问题

### 🔒 数据与隐私

**数据存储在哪里？**
- 所有数据存储在本地浏览器中，不会上传云端
- `localStorage`：空间数据、主题配置、搜索引擎、贴纸元信息（位置/样式/assetId）、壁纸元数据（如 `wallpaperId`）
- `IndexedDB`：壁纸二进制数据与壁纸历史、贴纸图片资源（大文件主存储）
- 不会上传到任何云端服务器
- 您的数据完全属于您自己，我们无法访问

**第三方图标服务会上传数据吗？**
- 默认关闭。
- 关闭时仅尝试站点自身图标路径（如 `apple-touch-icon` / `favicon.ico`），失败则使用本地生成图标。
- 开启后才会请求第三方图标服务；首次开启会弹出说明提示，由你确认后生效。
- 开启后，站点域名可能会发送到第三方图标服务，仅用于获取网站图标（favicon）。

**搜索建议需要额外权限吗？**
- 搜索建议权限是可选的。
- 未开启时不影响基础搜索（手动输入后回车搜索仍可正常使用）。

**是否会上传用户数据？**
- 不会。Eclipse Tab 不收集、不上传任何用户数据
- 所有功能完全在本地运行，保证您的隐私安全

**卸载扩展后数据会怎样？**
- 卸载扩展后，浏览器会清除扩展的所有数据
- 建议在卸载前导出空间配置和重要贴纸内容

### 💾 备份与恢复

**如何备份数据？**
- **空间配置**：右键 Dock 栏最右侧的空间切换按钮 → 选择“导出空间”→ 保存 JSON 文件

**如何恢复数据？**
- **空间配置**：右键 Dock 栏最右侧的空间切换按钮 → 选择“导入空间”→ 选择之前导出的 JSON 文件


---

## 📝 关于项目

Eclipse Tab 是一个使用现代 Web 技术构建的浏览器扩展项目，90% 的代码通过 AI 辅助编码（VibeCoding）完成。

**技术栈**
- React 18 + TypeScript
- Vite 构建工具
- CSS Modules

**数据存储**
- 所有数据自动保存到本地
- `localStorage` 保存轻量配置与元信息
- `IndexedDB` 保存壁纸与贴纸图片等大资源，支持大容量本地存储（突破 5MB 限制）

---

## 🙏 致谢

感谢所有使用和支持 Eclipse Tab 的用户！

如果你喜欢这个项目，欢迎：
- ⭐ Star 本项目
- 🐛 提交 Issue 反馈问题
- 💡 分享你的使用体验

---

## 📄 许可证

GNU GPLv3

---

<div align="center">

**Eclipse Tab** - 让每一个新标签页都成为一次愉悦的开始 ✨

Made with ❤️ using AI-assisted coding (VibeCoding)

</div>

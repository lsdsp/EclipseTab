# v2.0.0 重大更新要点（EclipseTab）

- 搜索引擎管理重构：
  - 支持自定义引擎（显示名称 + URL）
  - URL 占位符支持 `{query}` / `%s`
  - 数量不受限
- 删除规则：
  - 全局编辑模式下允许删除已保存引擎（需确认）
  - Google 固定为常量，永远第一位，且不可删除
  - 不允许删到 0 个已保存引擎
- 搜索行为：设置新增“新标签页”开关，控制搜索结果在当前页或新标签页打开。
- 编辑模式：`Esc` 全局默认退出编辑模式（固定行为，不可配置）。
- 搜索框文案精简：移除左侧“search by/使用”等冗余文案。
- 贴纸体验：
  - 编辑模式下左键单击文字贴纸 = 正常模式双击编辑
  - 贴纸新增字体配置：手写/普通/代码
  - 字体映射：
    - 手写：Virgil, HanziPen SC, Cangnanshoujiti, KaiTi, Segoe UI Emoji
    - 普通：Helvetica, Segoe UI Emoji
    - 代码：Cascadia, Segoe UI Emoji
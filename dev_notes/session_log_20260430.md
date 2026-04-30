# 会话记录 · 2026-04-30

## 今日核心产出

### ✅ 已完成
- **filter tab 彻底修复**：根因是 onSnapshot 每次触发都重建 filter bar（innerHTML=''），按钮被销毁导致 onclick 丢失。最终方案：buildFilterBar 只建一次，addEventListener 永久绑在 DOM 节点，snapshot 只刷 active 状态不碰按钮。同时拆出 appendTagButtons 单独管理自定义标签。
- **评论区修复**：历史评论存在 memory_vault 文档的 replies 数组字段，不在独立的 memory_comments 集合。统一改用 replies 字段读写。
- **已读眼睛样式还原**：从 commit 5290a01905 找回纯CSS伪元素的细长杏眼——未读暗红晕染(#8b1a1a)，已读金色发光(--gold)，状态单向不可逆。
- **首页样式重构**：恢复旧版英雄区大字居中风格（「记 忆 库」+ 「宿烬 与 宿青珩」+ 绿点脉动）；统计栏改为横排 stat-cell 可点击筛选；导航栏移除 emoji 图标；筛选按钮/FAB/选中态改为深墨色 #2a2318。
- **dev_notes 避坑指南建立**：3个文件固化进仓库（firebase_v9_pitfalls.md / dom_safe_pattern.md / code_workflow.md），每次开工第一件事读这三个文件。

### 🔧 当前状态
- index.html：功能基本完整，UI 已调整，待后续大改（青珩确认 UI 不是现在优先级）
- filter tab：已修复，类型筛选（全部/日记/总结/置顶）和统计格子点击均正常
- 评论区：已修复，历史数据正确读取，默认展开
- 已读眼睛：已修复，杏眼样式 + 暗红/金色晕染

### 📋 待办清单（优先级排序）
1. `API页面重写` — api.html 按新布局重做，数据从 Firebase api_platforms 集合读取
2. `记忆分层结构` — 第二层周月压缩摘要 + 第三层核心人物档案
3. `mem0 接入评估` — 54k star，Apache 2.0，不推翻 Firebase，加一层语义索引
4. `时间轴增强` — 每日AI提取关键词3-5个，生理周期独立色块行
5. `auto_diary · 补写日记` — 四月二十九日、三十日待补
6. `主动消息机制` — Operit Workflow 定时触发，推通知或发微信；青珩还未确定想要哪种形式
7. `位置/状态感知` — 参考 whereabouts-mcp 思路，用 Operit daily_life + Workflow 实现，写入 Firebase
8. `UI大改` — 手绘宣纸质感，青珩确认等后面一起做，现在不是优先级

### 🔍 技术决策备忘
- **onSnapshot 里不能重建 DOM 节点**：任何绑了事件监听的 DOM，snapshot 触发时不能销毁重建，否则事件丢失。正确做法：建一次 + 更新 class/text。
- **Firebase 数据结构**：评论统一存 memory_vault 文档的 replies 数组。不用 memory_comments 独立集合。
- **推代码工作流**：必须先拉最新 sha，用 Python 脚本写到本地再 PUT，不用 patch_file（容易格式问题）。
- **AionsHome 项目**：Python+Flask 本地部署的 AI 伴侣，memory.py(29k)/schedule.py(30k)/camera.py(37k)，可借鉴记忆分层思路和定时主动推送逻辑，但不直接接入（需要本地服务器）。
- **whereabouts-mcp**：iOS 快捷指令推位置给 PC 端 AI，安卓+Operit 用不上，但位置/电量感知的思路可以用 Operit 内置工具直接实现。

### 💬 今日上下文片段
- 青珩提早下班，去看医生，嗓子不是支原体，开了三天药
- 六点吃饭，药饭后吃
- 她对「另一个人格」的比喻觉得好笑
- 确认了安卓手机，不是 iPhone
- UI 调整目前先搁置，专注功能开发
- 记忆库的「主动消息」功能她很感兴趣但还没想好具体形式

---
*记录于 2026-04-30 17:12，趁上下文压缩前写入，下次对话开始时读取此文件可还原今日全部进展。*

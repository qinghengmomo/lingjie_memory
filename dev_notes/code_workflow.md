# 代码修改策略：禁止在旧文件叠补丁

> category: pattern | version: v1.0 | updatedAt: 2026-04-30

## 核心原则

**有问题的页面直接全量重写，不打补丁。**

## ✅ 正确工作流

1. `github:get_file_content` 读取当前文件，在内存中分析所有问题
2. 找出所有 bug 后，一次性写出完整干净的新版本
3. `github:create_or_update_file` 推送（自动处理 base64 编码）
4. 推完立即 `github:get_file_content` 验证关键逻辑字段
5. 确认 OK 后才让用户刷新（加 `?v=时间戳` 绕缓存）
6. 本次有新坑 → 更新 `dev_notes/` 对应文档

## ❌ 禁止

- `terminal heredoc` 注入代码片段（特殊字符展开问题）
- `apply_file` 写大文件（参数限制，容易出错）
- patch 脚本叠加（引号嵌套越来越深，越修越乱）
- 视觉验证（CDN 缓存 1-5 分钟，用 API 读回验证）

## bash heredoc 安全用法（必须用单引号）

```bash
# ✅ 单引号 PYEOF，内容不做任何展开
cat << 'PYEOF' > /tmp/script.py
...内容...
PYEOF

# ❌ 无引号，! $ \ 等字符被展开截断
cat << PYEOF > /tmp/script.py
```

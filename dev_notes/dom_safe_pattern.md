# innerHTML 安全写法 vs DOM API

> category: pitfall | version: v1.0 | updatedAt: 2026-04-30

## 核心原则：凡是带动态 id 的按钮，禁止拼 innerHTML

```js
// ❌ 引号地狱，HTML 解析直接出错，按钮失效
div.innerHTML = '<button onclick="fn(\'' + id + '\')">' 

// ✅ 正确做法：DOM API 构建，onclick 直接绑函数
const btn = document.createElement('button')
btn.className = 'btn-sm'
btn.textContent = '编辑'
btn.onclick = function() { fn(id) }  // 闭包捕获 id，安全
div.appendChild(btn)
```

## 记忆口诀

- 静态 HTML 结构 → innerHTML 可以
- 含动态数据（尤其是 id）+ onclick → 必须 createElement + addEventListener/onclick

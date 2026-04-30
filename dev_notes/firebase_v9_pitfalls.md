# Firebase v9 Modular SDK 避坑手册

> category: pitfall | version: v1.1 | updatedAt: 2026-04-30

## 坑1：snap.empty 在 v9 不存在

```js
// ❌ v8 写法，v9 modular 里根本没有 .empty 属性
if (snap.empty) { ... }

// ✅ v9 正确写法
if (snap.docs.length === 0) { ... }
```

## 坑2：orderBy 需要 Firestore 复合索引，无索引静默失败

```js
// ❌ 没建索引就用 orderBy，查询静默失败，回调不触发
onSnapshot(query(col, orderBy('createdAt')), cb)

// ✅ 去掉 orderBy，数据拿到后客户端 .sort() 排序
onSnapshot(collection(db, COL), snap => {
  items = snap.docs.map(d => ({id:d.id, ...d.data()}))
  items.sort((a,b) => (a.order||0)-(b.order||0))
  render()
})
```

## 坑3：addDoc 禁止重复 import

```js
// ❌ 重复 import 导致模块冲突
import { addDoc, addDoc as fbAddDoc } from '...'

// ✅ import 一次即可
import { addDoc } from '...'
```

## 坑4：SDK 版本必须统一

```js
// ✅ firebase-app.js 和 firebase-firestore.js 必须同版本
// 统一用 10.12.0，不要混用
```

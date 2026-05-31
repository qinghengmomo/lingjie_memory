// 碎片馆桥接入口
// app.js 通过 import('./pages/shards.js') 加载
// 实际逻辑在 pages/shards/index.js

import { init as _init, onAuth, destroy } from './shards/index.js';

let container;

export function init(el, deps) {
  container = el;
  _init(el);
  // 如果已登录，立即触发
  if (deps.auth && deps.auth.currentUser) {
    onAuth(true, el);
  } else {
    onAuth(false, el);
  }
}

export function onAuthChange(user) {
  if (container) {
    onAuth(!!user, container);
  }
}

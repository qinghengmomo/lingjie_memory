// 碎片馆 · 页签编排层
// 不写 DOM 细节，只负责串联：
//   data.js      ← 订阅 candle_echo
//   scene.js     ← 一次性渲染馆壳
//   starnode.js  ← 渲染星轨索引
//   frame.js     ← 单个相框工厂
//   detail.js    ← 详情卡片渲染

import { buildScene } from './scene.js';
import { subscribe, unsubscribeAll } from './data.js';
import { renderConstellation } from './starnode.js';
import { createFrame } from './frame.js';
import { showDetail } from './detail.js';

let container;
let shards = [];
let sceneBuilt = false;
let resizeAttached = false;

export function init(el) {
  container = el;
  if (!sceneBuilt) {
    buildScene(container);
    sceneBuilt = true;
  }
  attachResize();
}

export function onAuth(authed) {
  if (!container) return;
  const authMsg = container.querySelector('#shards-auth-msg');
  const gallery = container.querySelector('#shards-gallery');
  const constel = container.querySelector('#shards-constel');

  if (!authed) {
    if (authMsg) authMsg.style.display = '';
    if (gallery) { gallery.style.display = 'none'; gallery.innerHTML = ''; }
    if (constel) constel.style.display = 'none';
    unsubscribeAll();
    shards = [];
    return;
  }

  if (authMsg) authMsg.style.display = 'none';
  if (gallery) gallery.style.display = '';
  if (constel) constel.style.display = '';

  subscribe((views) => {
    shards = views;
    renderAll();
  });
}

function renderAll() {
  renderConstellation(container, shards, {
    onEnter: (idx) => spotlightFrame(idx, true),
    onLeave: (idx) => spotlightFrame(idx, false),
    onClick: (s, idx) => {
      const f = container.querySelector('.shards-frame[data-idx="' + idx + '"]');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showDetail(container, s);
    }
  });
  renderGallery();
}

function renderGallery() {
  const gal = container.querySelector('#shards-gallery');
  if (!gal) return;
  gal.innerHTML = '';

  if (!shards.length) {
    const empty = document.createElement('div');
    empty.className = 'shards-auth-placeholder';
    empty.textContent = '碎片馆暂时还是空的 · 等先生从星际那头掉落';
    gal.appendChild(empty);
    return;
  }

  shards.forEach((s, idx) => {
    const f = createFrame(s, idx);
    f.addEventListener('click', () => showDetail(container, s));
    f.addEventListener('mouseenter', () => spotlightStar(idx, true));
    f.addEventListener('mouseleave', () => spotlightStar(idx, false));
    gal.appendChild(f);
  });
}

// 联动：星点 hover → 相框 spotlight
function spotlightFrame(idx, on) {
  const f = container.querySelector('.shards-frame[data-idx="' + idx + '"]');
  if (f) f.classList.toggle('spotlight', on);
}

// 联动：相框 hover → 星点放大 + tip 显示
function spotlightStar(idx, on) {
  const node = container.querySelector('.shards-starnode[data-idx="' + idx + '"]');
  if (!node) return;
  const core = node.querySelector('.core');
  if (core) core.setAttribute('r', on ? 6 : 4);
  node.querySelectorAll('.tip').forEach(t => t.style.opacity = on ? '1' : '0');
}

function attachResize() {
  if (resizeAttached) return;
  resizeAttached = true;
  let tmr;
  window.addEventListener('resize', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      if (shards.length) renderAll();
    }, 150);
  });
}

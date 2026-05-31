// 碎片馆 · 页签入口
// 订阅 Firestore candle_echo collection，渲染星轨索引 + 相框墙

import { buildScene } from './scene.js';
import { db } from '../../app.js';
import { collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let unsubscribe = null;
let shards = [];
let initialized = false;

export function init(container) {
  if (initialized) return;
  initialized = true;
  buildScene(container);
}

export function onAuth(authed, container) {
  const authMsg = container.querySelector('#shards-auth-msg');
  const gallery = container.querySelector('#shards-gallery');
  const constel = container.querySelector('#shards-constel');

  if (!authed) {
    // 未登录：显示占位，隐藏内容
    if (authMsg) authMsg.style.display = '';
    if (gallery) gallery.style.display = 'none';
    if (constel) constel.style.display = 'none';
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    shards = [];
    if (gallery) gallery.innerHTML = '';
    return;
  }

  // 已登录
  if (authMsg) authMsg.style.display = 'none';
  if (gallery) gallery.style.display = '';
  if (constel) constel.style.display = '';

  if (!unsubscribe) {
    try {
      const q = query(collection(db, 'candle_echo'), orderBy('created_at', 'asc'));
      unsubscribe = onSnapshot(q, (snap) => {
        shards = snap.docs.map(d => {
          const data = d.data();
          return {
            no: '#' + String(data.shard_number || '').padStart(3, '0'),
            title: data.title || '无题碎片',
            time: data.era_label || data.time_label || '',
            body: data.content || data.body || ''
          };
        });
        render(container);
      }, (err) => {
        console.error('[shards] listener error', err);
      });
    } catch (e) {
      console.error('[shards] init listener failed', e);
    }
  }
}

export function destroy() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  shards = [];
  initialized = false;
}

// ─── 渲染 ───
function render(container) {
  renderIndex(container);
  renderGallery(container);
}

function computeLayout(n, wrapW) {
  const minPerStar = 80;
  const idealPerStar = 120;
  const naturalW = n * idealPerStar + 80;
  if (naturalW <= wrapW) {
    return { totalW: wrapW, perX: (wrapW - 160) / (Math.max(1, n - 1)), offsetX: 80, scrollable: false };
  } else {
    const per = n > 30 ? minPerStar : idealPerStar;
    const w = n * per + 80;
    return { totalW: w, perX: per, offsetX: 60, scrollable: true };
  }
}

function renderIndex(container) {
  const cstWrap = container.querySelector('#shards-constel');
  const cstInner = container.querySelector('#shards-cstInner');
  const cstSvg = container.querySelector('#shards-cstSvg');
  const cstHint = container.querySelector('#shards-cstHint');
  if (!cstWrap || !cstSvg) return;

  cstSvg.innerHTML = '<defs><radialGradient id="shards-starGlow"><stop offset="0%" stop-color="rgba(255,200,140,0.5)"/><stop offset="50%" stop-color="rgba(216,160,96,0.18)"/><stop offset="100%" stop-color="rgba(216,160,96,0)"/></radialGradient></defs>';

  const wrapW = cstWrap.clientWidth || 800;
  const layout = computeLayout(shards.length, wrapW);
  cstInner.style.width = layout.totalW + 'px';
  cstSvg.setAttribute('viewBox', '0 0 ' + layout.totalW + ' 160');
  cstSvg.setAttribute('width', layout.totalW);
  cstSvg.setAttribute('height', 160);

  cstHint.textContent = layout.scrollable ? '← 滑动浏览星轨 →' : '';
  cstWrap.classList.toggle('scrollable', layout.scrollable);

  const positions = shards.map((s, i) => ({
    x: layout.offsetX + i * layout.perX,
    y: 80 + Math.sin(i * 1.2) * 18
  }));

  // 连线
  for (let i = 0; i < positions.length - 1; i++) {
    const ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('class', 'shards-conn');
    ln.setAttribute('x1', positions[i].x);
    ln.setAttribute('y1', positions[i].y);
    ln.setAttribute('x2', positions[i + 1].x);
    ln.setAttribute('y2', positions[i + 1].y);
    cstSvg.appendChild(ln);
  }

  // 星点
  shards.forEach((s, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'shards-starnode');
    g.setAttribute('data-idx', i);

    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.setAttribute('class', 'hitbox');
    hit.setAttribute('x', positions[i].x - 30);
    hit.setAttribute('y', positions[i].y - 40);
    hit.setAttribute('width', 60);
    hit.setAttribute('height', 80);
    hit.setAttribute('fill', 'transparent');
    g.appendChild(hit);

    const glow = document.createElementNS(SVG_NS, 'circle');
    glow.setAttribute('class', 'glow');
    glow.setAttribute('cx', positions[i].x);
    glow.setAttribute('cy', positions[i].y);
    glow.setAttribute('r', 24);
    g.appendChild(glow);

    const pulseRing = document.createElementNS(SVG_NS, 'circle');
    pulseRing.setAttribute('class', 'pulseRing');
    pulseRing.setAttribute('cx', positions[i].x);
    pulseRing.setAttribute('cy', positions[i].y);
    pulseRing.setAttribute('r', 6);
    pulseRing.setAttribute('fill', 'none');
    pulseRing.style.animationDelay = (-i * 0.5) + 's';
    g.appendChild(pulseRing);

    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'ring');
    ring.setAttribute('cx', positions[i].x);
    ring.setAttribute('cy', positions[i].y);
    ring.setAttribute('r', 9);
    ring.setAttribute('fill', 'none');
    g.appendChild(ring);

    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('class', 'core');
    core.setAttribute('cx', positions[i].x);
    core.setAttribute('cy', positions[i].y);
    core.setAttribute('r', 4);
    core.style.animationDelay = (-i * 0.4) + 's';
    g.appendChild(core);

    // tipN 上方（编号+时间），tipT 下方（标题）
    const tipN = document.createElementNS(SVG_NS, 'text');
    tipN.setAttribute('class', 'tip');
    tipN.setAttribute('x', positions[i].x);
    tipN.setAttribute('y', positions[i].y - 28);
    tipN.textContent = s.no + ' · ' + s.time;
    g.appendChild(tipN);

    const tipT = document.createElementNS(SVG_NS, 'text');
    tipT.setAttribute('class', 'tip');
    tipT.setAttribute('x', positions[i].x);
    tipT.setAttribute('y', positions[i].y + 22);
    tipT.textContent = s.title;
    g.appendChild(tipT);

    g.addEventListener('mouseenter', () => {
      const f = container.querySelector('.shards-frame[data-idx="' + i + '"]');
      if (f) f.classList.add('spotlight');
    });
    g.addEventListener('mouseleave', () => {
      const f = container.querySelector('.shards-frame[data-idx="' + i + '"]');
      if (f) f.classList.remove('spotlight');
    });
    g.addEventListener('click', () => {
      const f = container.querySelector('.shards-frame[data-idx="' + i + '"]');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showDetail(container, s);
    });

    cstSvg.appendChild(g);
  });

  // resize 监听
  if (!cstWrap._resizeAttached) {
    cstWrap._resizeAttached = true;
    let tmr;
    window.addEventListener('resize', () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => renderIndex(container), 150);
    });
  }
}

function renderGallery(container) {
  const gal = container.querySelector('#shards-gallery');
  if (!gal) return;
  gal.innerHTML = '';

  shards.forEach((s, i) => {
    const f = document.createElement('div');
    f.className = 'shards-frame';
    f.dataset.idx = i;
    f.innerHTML = `
      <div class="rope"></div>
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <div class="outer"></div>
      <div class="inner"><div class="shards-shard"></div></div>
      <div class="shards-plate"><span class="num">${s.no}</span>${s.title}</div>
    `;
    f.onclick = () => showDetail(container, s);
    f.addEventListener('mouseenter', () => {
      const node = container.querySelector('.shards-starnode[data-idx="' + i + '"]');
      if (node) {
        const core = node.querySelector('.core');
        if (core) core.setAttribute('r', 6);
        node.querySelectorAll('.tip').forEach(t => t.style.opacity = '1');
      }
    });
    f.addEventListener('mouseleave', () => {
      const node = container.querySelector('.shards-starnode[data-idx="' + i + '"]');
      if (node) {
        const core = node.querySelector('.core');
        if (core) core.setAttribute('r', 4);
        node.querySelectorAll('.tip').forEach(t => t.style.opacity = '0');
      }
    });
    gal.appendChild(f);
  });
}

function showDetail(container, s) {
  const mask = container.querySelector('#shards-mask');
  container.querySelector('#shards-dh').textContent = s.time;
  container.querySelector('#shards-dt').textContent = s.title;
  container.querySelector('#shards-db').textContent = s.body;
  mask.classList.add('show');

  // 关闭事件
  const closeBtn = container.querySelector('#shards-close');
  const closeFn = () => { mask.classList.remove('show'); };
  closeBtn.onclick = closeFn;
  mask.onclick = (e) => { if (e.target === mask) closeFn(); };
}

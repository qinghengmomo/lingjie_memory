// 碎片馆 · 星轨索引（顶部横向时间线）
// 单一职责：根据 shards 数据 + 容器宽度，渲染连线和星点 SVG
// 不处理详情弹窗——通过回调把点击事件传出去

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 数量自适应：
 *   <= 6  → 占满容器，均匀分布
 *   <= 30 → 每颗 120px，超出则横滚
 *   > 30  → 每颗 80px（紧凑模式），横滚
 */
function computeLayout(n, wrapW) {
  const minPerStar = 80;
  const idealPerStar = 120;
  const naturalW = n * idealPerStar + 80;
  if (naturalW <= wrapW) {
    return {
      totalW: wrapW,
      perX: (wrapW - 160) / Math.max(1, n - 1),
      offsetX: 80,
      scrollable: false
    };
  }
  const per = n > 30 ? minPerStar : idealPerStar;
  return {
    totalW: n * per + 80,
    perX: per,
    offsetX: 60,
    scrollable: true
  };
}

/**
 * 渲染星轨索引
 * @param {HTMLElement} container 页面容器
 * @param {Array} shards 碎片数组
 * @param {Object} handlers { onEnter(idx), onLeave(idx), onClick(s, idx) }
 */
export function renderConstellation(container, shards, handlers) {
  const cstWrap = container.querySelector('#shards-constel');
  const cstInner = container.querySelector('#shards-cstInner');
  const cstSvg = container.querySelector('#shards-cstSvg');
  const cstHint = container.querySelector('#shards-cstHint');
  if (!cstWrap || !cstSvg) return;

  cstSvg.innerHTML = '<defs><radialGradient id="shards-starGlow">'
    + '<stop offset="0%" stop-color="rgba(255,200,140,0.5)"/>'
    + '<stop offset="50%" stop-color="rgba(216,160,96,0.18)"/>'
    + '<stop offset="100%" stop-color="rgba(216,160,96,0)"/>'
    + '</radialGradient></defs>';

  const wrapW = cstWrap.clientWidth || 800;
  if (!shards.length) {
    cstInner.style.width = wrapW + 'px';
    return;
  }

  const layout = computeLayout(shards.length, wrapW);
  cstInner.style.width = layout.totalW + 'px';
  cstSvg.setAttribute('viewBox', '0 0 ' + layout.totalW + ' 160');
  cstSvg.setAttribute('width', layout.totalW);
  cstSvg.setAttribute('height', 160);

  if (cstHint) cstHint.textContent = layout.scrollable ? '← 滑动浏览星轨 →' : '';
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
    cstSvg.appendChild(buildStarNode(s, i, positions[i], handlers));
  });
}

function buildStarNode(s, i, pos, handlers) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'shards-starnode');
  g.setAttribute('data-idx', i);

  // hitbox
  const hit = document.createElementNS(SVG_NS, 'rect');
  hit.setAttribute('class', 'hitbox');
  hit.setAttribute('x', pos.x - 30);
  hit.setAttribute('y', pos.y - 40);
  hit.setAttribute('width', 60);
  hit.setAttribute('height', 80);
  hit.setAttribute('fill', 'transparent');
  g.appendChild(hit);

  // glow
  const glow = document.createElementNS(SVG_NS, 'circle');
  glow.setAttribute('class', 'glow');
  glow.setAttribute('cx', pos.x);
  glow.setAttribute('cy', pos.y);
  glow.setAttribute('r', 24);
  g.appendChild(glow);

  // pulseRing 扩散环
  const pulse = document.createElementNS(SVG_NS, 'circle');
  pulse.setAttribute('class', 'pulseRing');
  pulse.setAttribute('cx', pos.x);
  pulse.setAttribute('cy', pos.y);
  pulse.setAttribute('r', 6);
  pulse.setAttribute('fill', 'none');
  pulse.style.animationDelay = (-i * 0.5) + 's';
  g.appendChild(pulse);

  // ring 外圈（不动）
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('class', 'ring');
  ring.setAttribute('cx', pos.x);
  ring.setAttribute('cy', pos.y);
  ring.setAttribute('r', 9);
  ring.setAttribute('fill', 'none');
  g.appendChild(ring);

  // core 呼吸
  const core = document.createElementNS(SVG_NS, 'circle');
  core.setAttribute('class', 'core');
  core.setAttribute('cx', pos.x);
  core.setAttribute('cy', pos.y);
  core.setAttribute('r', 4);
  core.style.animationDelay = (-i * 0.4) + 's';
  g.appendChild(core);

  // tip 上下双行
  const tipUp = document.createElementNS(SVG_NS, 'text');
  tipUp.setAttribute('class', 'tip');
  tipUp.setAttribute('x', pos.x);
  tipUp.setAttribute('y', pos.y - 28);
  tipUp.textContent = s.no + (s.time ? ' · ' + s.time : '');
  g.appendChild(tipUp);

  const tipDown = document.createElementNS(SVG_NS, 'text');
  tipDown.setAttribute('class', 'tip');
  tipDown.setAttribute('x', pos.x);
  tipDown.setAttribute('y', pos.y + 22);
  tipDown.textContent = s.title;
  g.appendChild(tipDown);

  if (handlers) {
    g.addEventListener('mouseenter', () => handlers.onEnter && handlers.onEnter(i));
    g.addEventListener('mouseleave', () => handlers.onLeave && handlers.onLeave(i));
    g.addEventListener('click', () => handlers.onClick && handlers.onClick(s, i));
  }
  return g;
}

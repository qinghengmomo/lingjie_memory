// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/galaxy.js — 记忆星河模块
// 粒子可视化 / 情绪热力图 / 语义搜索 / 记忆浮现
// ═══════════════════════════════════════════════════════

import { db, auth, collection, onSnapshot } from '../app.js';
import { query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let container = null;
let rawMemories = []; // all docs from Firestore
let memories = []; // merged by day
let particles = [];
let canvas, ctx;
let W, H;
let time = 0;
let selectedIdx = -1;
let searchFilter = '';
let animId = null;

// ── 情绪颜色映射 ──
function emotionColor(valence, arousal) {
  if (valence > 0.7 && arousal > 0.6) return '#e8845f'; // 热烈
  if (valence > 0.7) return '#a3be8c'; // 温暖
  if (valence > 0.5 && arousal > 0.5) return '#f0c27f'; // 兴奋
  if (valence > 0.5) return '#88c0d0'; // 平静
  if (arousal > 0.6) return '#bf616a'; // 激烈
  if (valence > 0.3) return '#b48ead'; // 沉思
  return '#4c566a'; // 低调
}

// ── 初始化 ──
export function init(el, ctx_) {
  container = el;
  render();
  loadData();
  // 监听登录状态
  onAuthStateChanged(auth, user => {
    const el = document.getElementById('galaxyAuthHint');
    if (el) {
      el.textContent = user ? '' : '未登录 · 数据可能不完整';
      el.style.display = user ? 'none' : 'block';
    }
  });
}

function render() {
  container.innerHTML = `
    <div class="galaxy-page">
      <canvas class="galaxy-canvas" id="galaxyCanvas"></canvas>
      <div class="galaxy-overlay">
        <div class="galaxy-header">
          <h1 class="galaxy-title">记 忆 星 河</h1>
          <div class="galaxy-stats" id="galaxyStats">加载中...</div>
        </div>
        <div class="galaxy-auth-hint" id="galaxyAuthHint" style="display:none;text-align:center;font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:6px;"></div>
        <div class="galaxy-search">
          <input type="text" class="galaxy-search-input" id="galaxySearch" placeholder="搜索记忆… 试试「生理期」「灵界」「五一」">
        </div>
        <div class="galaxy-main" id="galaxyMain">
          <div class="galaxy-surface" id="galaxySurface">
            <h3><span class="galaxy-surface-dot"></span>此刻浮现</h3>
            <div id="galaxySurfaceList"></div>
          </div>
        </div>
        <div class="galaxy-timeline-wrap">
          <div class="galaxy-timeline-header">
            <span id="galaxyTimeStart"></span>
            <span>情绪热力 · 记忆强度</span>
            <span id="galaxyTimeEnd"></span>
          </div>
          <div class="galaxy-timeline" id="galaxyTimeline"></div>
        </div>
      </div>
      <div class="galaxy-backdrop" id="galaxyBackdrop"></div>
      <div class="galaxy-detail" id="galaxyDetail">
        <div class="galaxy-detail-handle"></div>
        <div class="galaxy-detail-header">
          <span class="galaxy-detail-date" id="gdDate"></span>
          <span class="galaxy-detail-type" id="gdType"></span>
        </div>
        <div class="galaxy-detail-title" id="gdTitle"></div>
        <div class="galaxy-detail-content" id="gdContent"></div>
        <div class="galaxy-detail-tags" id="gdTags"></div>
        <div class="galaxy-detail-strength">
          <span class="galaxy-detail-strength-label">记忆强度</span>
          <div class="galaxy-detail-strength-bar"><div class="galaxy-detail-strength-fill" id="gdStrength"></div></div>
        </div>
      </div>
    </div>
  `;

  canvas = document.getElementById('galaxyCanvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  document.getElementById('galaxySearch').addEventListener('input', e => {
    searchFilter = e.target.value.trim().toLowerCase();
  });

  document.getElementById('galaxyMain').addEventListener('click', handleCanvasClick);
  document.getElementById('galaxyBackdrop').addEventListener('click', hideDetail);

  startAnimation();
}

function resize() {
  if (!canvas) return;
  const parent = canvas.parentElement;
  W = canvas.width = parent.clientWidth || window.innerWidth;
  H = canvas.height = parent.clientHeight || (window.innerHeight - 42);
}

// ── 数据加载 ──
function loadData() {
  const colRef = collection(db, 'memory_vault');
  onSnapshot(colRef, snapshot => {
    rawMemories = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      rawMemories.push({
        id: doc.id,
        title: d.title || '',
        date: d.date || '',
        type: d.type || 'diary',
        content: d.content || '',
        tags: d.tags || [],
        valence: d.emotion_valence || 0.5,
        arousal: d.emotion_arousal || 0.5,
        strength: d.memory_strength || 0.5,
        keywords: d.keywords || [],
        pinned: d.pinned || false
      });
    });
    // 按天合并
    mergeByDay();
    initParticles();
    updateStats();
    updateSurface();
    updateTimeline();
  }, error => {
    console.error('Galaxy loadData error:', error);
    const el = document.getElementById('galaxyStats');
    if (el) el.textContent = '加载失败，请登录后重试';
  });
}

// ── 按天合并 ──
function mergeByDay() {
  const dayMap = {};
  rawMemories.forEach(m => {
    const day = (m.date || '').split(' ')[0];
    if (!day) return;
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(m);
  });

  memories = Object.keys(dayMap).sort((a, b) => b.localeCompare(a)).map(day => {
    const items = dayMap[day];
    // 取content最长的作为主体
    items.sort((a, b) => (b.content || '').length - (a.content || '').length);
    const primary = items[0];
    // 合并所有tags和keywords
    const allTags = [...new Set(items.flatMap(m => m.tags || []))];
    const allKeywords = [...new Set(items.flatMap(m => m.keywords || []))];
    // 情绪取平均
    const avgValence = items.reduce((s, m) => s + m.valence, 0) / items.length;
    const avgArousal = items.reduce((s, m) => s + m.arousal, 0) / items.length;
    // 强度取最大
    const maxStrength = Math.max(...items.map(m => m.strength));
    // 类型标注
    const types = [...new Set(items.map(m => m.type))];
    const typeLabel = types.length > 1 ? '日记+总结' : (types[0] === 'diary' ? '日记' : '总结');

    return {
      id: primary.id,
      day: day,
      title: primary.title || '',
      date: primary.date || day,
      type: typeLabel,
      content: primary.content || '',
      secondaryContent: items.length > 1 ? items[1].content || '' : '',
      tags: allTags,
      keywords: allKeywords,
      valence: Math.round(avgValence * 100) / 100,
      arousal: Math.round(avgArousal * 100) / 100,
      strength: maxStrength,
      pinned: items.some(m => m.pinned),
      itemCount: items.length
    };
  });
}

function initParticles() {
  const n = memories.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  particles = memories.map((m, i) => {
    // 黄金角螺旋分布，确保粒子均匀散布在整个画布
    const r = 0.38 * Math.sqrt((i + 0.5) / n);
    const theta = i * goldenAngle;
    const jitterX = (Math.sin(i * 7.13) * 0.04);
    const jitterY = (Math.cos(i * 11.07) * 0.035);
    return {
      x: 0.5 + r * Math.cos(theta) + jitterX,
      y: 0.45 + r * Math.sin(theta) * 0.8 + jitterY,
      size: 2.5 + m.strength * 4.5,
      baseAlpha: 0.35 + m.strength * 0.55,
      speed: 0.04 + (i % 9) * 0.012,
      phase: (i * 1.618) % (Math.PI * 2),
      color: emotionColor(m.valence, m.arousal)
    };
  });
}

function updateStats() {
  const el = document.getElementById('galaxyStats');
  if (el) {
    el.textContent = `${rawMemories.length} 条记忆 · ${memories.length} 天`;
  }
}

function updateSurface() {
  const list = document.getElementById('galaxySurfaceList');
  if (!list) return;
  const top = [...memories].sort((a, b) => b.strength - a.strength).slice(0, 3);
  list.innerHTML = top.map((m, i) => {
    const snippet = (m.content || '').replace(/[\n\r]/g, ' ').substring(0, 40);
    return `
    <div class="galaxy-surface-item" data-idx="${memories.indexOf(m)}" style="border-color:${emotionColor(m.valence, m.arousal)}">
      <div class="galaxy-surface-date">${m.day.slice(5)} · ${m.type}</div>
      <div class="galaxy-surface-text">${snippet}…</div>
    </div>
  `;
  }).join('');
  list.querySelectorAll('.galaxy-surface-item').forEach(item => {
    item.addEventListener('click', () => showDetail(parseInt(item.dataset.idx)));
  });
}

function updateTimeline() {
  const timeline = document.getElementById('galaxyTimeline');
  const startEl = document.getElementById('galaxyTimeStart');
  const endEl = document.getElementById('galaxyTimeEnd');
  if (!timeline) return;
  if (memories.length === 0) return;

  const sorted = [...memories].sort((a, b) => a.day.localeCompare(b.day));
  startEl.textContent = sorted[0].day.slice(5);
  endEl.textContent = sorted[sorted.length - 1].day.slice(5);

  timeline.innerHTML = sorted.map((m, i) => {
    const color = emotionColor(m.valence, m.arousal);
    const height = 14 + m.strength * 26;
    const showLabel = i % 5 === 0 || i === sorted.length - 1;
    const d = new Date(m.day);
    const label = showLabel ? `${d.getMonth() + 1}/${d.getDate()}` : '';
    return `
      <div class="galaxy-timeline-day" data-idx="${memories.indexOf(m)}">
        <div class="galaxy-timeline-bar" style="height:${height}px;background:${color};opacity:${0.3 + m.strength * 0.6}"></div>
        <div class="galaxy-timeline-label ${showLabel ? 'show' : ''}">${label}</div>
      </div>
    `;
  }).join('');

  timeline.querySelectorAll('.galaxy-timeline-day').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      if (idx >= 0) showDetail(idx);
    });
  });

  setTimeout(() => { timeline.scrollLeft = timeline.scrollWidth; }, 100);
}

// ── 动画 ──
function startAnimation() {
  if (animId) cancelAnimationFrame(animId);
  animate();
}

function animate() {
  if (!ctx || !canvas || W === 0 || H === 0) {
    resize();
    animId = requestAnimationFrame(animate);
    return;
  }
  ctx.fillStyle = 'rgba(6,6,16,0.18)';
  ctx.fillRect(0, 0, W, H);

  // 星尘
  for (let i = 0; i < 80; i++) {
    const x = (Math.sin(i * 127.1 + time * 0.02) * 0.5 + 0.5) * W;
    const y = (Math.cos(i * 311.7 + time * 0.01) * 0.5 + 0.5) * H;
    ctx.beginPath();
    ctx.arc(x, y, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.sin(i + time) * 0.05})`;
    ctx.fill();
  }

  // 粒子
  const positions = [];
  particles.forEach((p, i) => {
    const mem = memories[i];
    if (!mem) return;
    const isFiltered = searchFilter && !matchSearch(mem);
    const alpha = isFiltered ? 0.06 : p.baseAlpha;
    const size = isFiltered ? p.size * 0.4 : p.size;
    const isSelected = selectedIdx === i;
    const pulseSize = isSelected ? size * (1.4 + Math.sin(time * 3) * 0.2) : size;

    const px = p.x * W + Math.sin(time * p.speed + p.phase) * 18;
    const py = p.y * (H * 0.65) + 50 + Math.cos(time * p.speed * 0.7 + p.phase) * 12;
    positions.push({ px, py });

    // 光晕
    const glowR = pulseSize * (isSelected ? 14 : 9);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, glowR);
    grad.addColorStop(0, p.color + Math.floor(alpha * 50).toString(16).padStart(2, '0'));
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(px, py, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 核心
    ctx.beginPath();
    ctx.arc(px, py, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 标签
    if ((size > 4 || isSelected) && !isFiltered) {
      ctx.font = `${isSelected ? 11 : 9}px -apple-system, "PingFang SC", sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${isSelected ? 0.8 : 0.35})`;
      ctx.textAlign = 'center';
      const label = mem.day.slice(5) + ' ' + (mem.content || '').replace(/[\n\r]/g,'').substring(0, 6);
      ctx.fillText(label, px, py + pulseSize + 12);
    }
  });

  // 连线
  for (let i = 0; i < positions.length; i++) {
    if (searchFilter && !matchSearch(memories[i])) continue;
    for (let j = i + 1; j < positions.length; j++) {
      if (searchFilter && !matchSearch(memories[j])) continue;
      const dist = Math.hypot(positions[j].px - positions[i].px, positions[j].py - positions[i].py);
      if (dist < 150) {
        ctx.beginPath();
        ctx.moveTo(positions[i].px, positions[i].py);
        ctx.lineTo(positions[j].px, positions[j].py);
        ctx.strokeStyle = `rgba(255,255,255,${0.03 * (1 - dist / 150)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  time += 0.008;
  animId = requestAnimationFrame(animate);
}

// ── 交互 ──
function matchSearch(mem) {
  if (!searchFilter) return true;
  const q = searchFilter;
  return (mem.title || '').toLowerCase().includes(q) ||
    (mem.keywords || []).some(k => k.includes(q)) ||
    (mem.tags || []).some(t => t.includes(q)) ||
    (mem.content || '').toLowerCase().includes(q) ||
    (mem.day || '').includes(q);
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  let hitIdx = -1;
  particles.forEach((p, i) => {
    const px = p.x * W + Math.sin(time * p.speed + p.phase) * 18;
    const py = p.y * (H * 0.65) + 50 + Math.cos(time * p.speed * 0.7 + p.phase) * 12;
    if (Math.hypot(cx - px, cy - py) < Math.max(p.size * 3, 22)) {
      hitIdx = i;
    }
  });

  if (hitIdx >= 0) showDetail(hitIdx);
  else hideDetail();
}

function showDetail(idx) {
  if (idx < 0 || idx >= memories.length) return;
  selectedIdx = idx;
  const m = memories[idx];
  const p = particles[idx];
  document.getElementById('gdDate').textContent = m.day + (m.itemCount > 1 ? ` (${m.itemCount}条)` : '');
  document.getElementById('gdType').textContent = m.type;
  document.getElementById('gdTitle').textContent = m.title || m.day;
  document.getElementById('gdContent').textContent = (m.content || '').substring(0, 600);
  document.getElementById('gdTags').innerHTML = (m.tags || []).map(t => `<span class="galaxy-tag">${t}</span>`).join('');
  const fill = document.getElementById('gdStrength');
  fill.style.width = (m.strength * 100) + '%';
  fill.style.background = p ? p.color : '#e8845f';
  document.getElementById('galaxyDetail').classList.add('visible');
  document.getElementById('galaxyBackdrop').classList.add('visible');
}

function hideDetail() {
  selectedIdx = -1;
  document.getElementById('galaxyDetail').classList.remove('visible');
  document.getElementById('galaxyBackdrop').classList.remove('visible');
}

// ── 清理 ──
export function destroy() {
  if (animId) cancelAnimationFrame(animId);
  window.removeEventListener('resize', resize);
}

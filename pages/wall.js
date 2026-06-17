// pages/wall.js
// 我们的墚：wall_posts 的唯一前端入口。
// 短句/图片/轻量情��贴进入 wall_posts；正式日记/礼物/硎片不进入本模块。

import { query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const WALL_COLLECTION = 'wall_posts';
const PAGE_LIMIT = 100;

let ctxRef = null;
let currentUser = null;
let unsubscribe = null;
let eventsBound = false;

export function init(container, ctx) {
  ctxRef = ctx || ctxRef;
  const u = ctxRef?.auth?.currentUser || null;
  currentUser = u ? { uid: u.uid, displayName: u.email, role: 'qingheng' } : null;
  bindEvents();
  loadPosts();
}

export function onAuthChange(user) {
  currentUser = user ? { uid: user.uid, displayName: user.email, role: 'qingheng' } : null;
  loadPosts();
}

function wallRef() {
  if (!ctxRef?.db || !ctxRef?.collection) throw new Error('Firestore SDK 未初始化');
  return ctxRef.collection(ctxRef.db, WALL_COLLECTION);
}

function getGrid() { return document.getElementById('wall-grid'); }
function setState(cls, text, sub = '') {
  const grid = getGrid();
  if (!grid) return;
  grid.innerHTML = `<div class="${cls}">${escapeHtml(text)}${sub ? `<br><span>${escapeHtml(sub)}</span>` : ''}</div>`;
}

async function loadPosts() {
  const grid = getGrid();
  if (!grid || !ctxRef?.db) return;
  if (typeof unsubscribe === 'function') { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
  setState('wall-loading', '圇方我们的墚中…');
  try {
    const q = query(wallRef(), orderBy('created_at', 'desc'), limit(PAGE_LIMIT));
    const renderSnap = snap => renderPosts(snap.docs.map(parseDoc).sort((a, b) => b.created_at - a.created_at));
    if (ctxRef?.onSnapshot) {
      unsubscribe = ctxRef.onSnapshot(q, renderSnap, err => {
        console.error('[wall] onSnapshot error:', err);
        setState('wall-loading', '��取��被褏过该舗中来攣毐歧', err?.message || '');
      });
      return;
    }
    renderSnap(await getDocs(q));
  } catch (e) {
    console.error('[wall] loadPosts error:', e);
    setState('wall-loading', '读取失来', e?.message || '');
  }
}

function parseDoc(docSnap) {
  const raw = docSnap.data ? docSnap.data() : {};
  const created = toMillis(raw.created_at ?? raw.createdAt ?? raw.date ?? raw.time);
  return {
    id: docSnap.id,
    content: String(raw.content || raw.text || raw.body || ''),
    image_url: String(raw.image_url || raw.imageUrl || raw.image || ''),
    image_b64: String(raw.image_b64 || raw.imageBase64 || ''),
    mood_tag: String(raw.mood_tag || raw.mood || raw.tag || ''),
    author: String(raw.author || 'qingheng'),
    author_name: String(raw.author_name || raw.authorName || ''),
    created_at: created,
    date_str: String(raw.date_str || raw.dateStr || raw.date || formatDate(created) || '')
  };
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const t = Date.parse(v.replace(/-/g, '/'));
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

function renderPosts(posts) {
  const grid = getGrid();
  if (!grid) return;
  if (!posts.length) return setState('wall-empty', '这面墙还没有内容', '点右上觑 + 贴上第一张小纸条');
  grid.innerHTML = posts.map(p => {
    const hasImg = Boolean(p.image_url || p.image_b64);
    const imgSrc = p.image_url || (p.image_b64 ? `data:image/png;base64,${p.image_b64}` : '');
    const noteClass = hasImg ? (p.content ? 'note' : 'note full-img') : 'note text-only';
    const authorLabel = p.author_name || (p.author === 'sujin' ? '宿点' : '青珩');
    const authorClass = p.author === 'sujin' ? 'author-sujin' : 'author-qingheng';
    return `
      <div class="${noteClass}" data-id="${escapeAttr(p.id)}">
        ${hasImg ? `<img src="${escapeAttr(imgSrc)}" alt="" loading="lazy" class="note-img">` : ''}
        ${p.content ? `<div class="caption">${escapeHtml(p.content).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="meta">
          <span class="meta-left"><span class="${authorClass}">${escapeHtml(authorLabel)}</span><span class="meta-date">${escapeHtml(p.date_str || formatDate(p.created_at))}</span></span>
          <span class="meta-right">${p.mood_tag ? `<span class="mood-tag">${escapeHtml(p.mood_tag)}</span>` : ''}</span>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.note-img').forEach(img => img.addEventListener('click', () => openLightbox(img.src)));
  bindLongPressDelete(grid);
}
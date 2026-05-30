// ════════════════════════════════════════════════════════════
// 灵界记忆库 · pages/gifts/index.js
// 礼物展览馆页签入口（薄荷玻璃花房）
// 数据源：Firestore collection "gift_vault"
// 文档结构：{ id, title, type, theme, room, data, tags, pinned,
//             createdAt, updatedAt, sender, recipient, schema }
// ════════════════════════════════════════════════════════════

import {buildShell, getRoomGrid, getRooms} from './scene.js';
import {renderMiniature, renderDetail} from './themes.js';

let db, auth, collection, onSnapshot, requireAuth;
let container;
let allGifts = [];
let maskEl;

export function init(el, deps){
  container = el;
  db = deps.db;
  auth = deps.auth;
  collection = deps.collection;
  onSnapshot = deps.onSnapshot;
  requireAuth = deps.requireAuth;
  buildShell(container);
  attachMask();
  startListener();
}

export function onAuthChange(user){
  // gift_vault 当前对所有人可读，不依赖登录态
}

function attachMask(){
  // 全局遮罩（避开 page 容器的 overflow）
  if(!document.getElementById('gh-mask')){
    maskEl = document.createElement('div');
    maskEl.id = 'gh-mask';
    maskEl.className = 'gh-mask';
    maskEl.addEventListener('click', function(ev){
      if(ev.target === maskEl) closeDetail();
    });
    document.body.appendChild(maskEl);
  } else {
    maskEl = document.getElementById('gh-mask');
  }
}

function closeDetail(){
  if(!maskEl) return;
  maskEl.classList.remove('gh-show');
  maskEl.innerHTML = '';
}

function openDetail(gift){
  if(!maskEl) return;
  maskEl.innerHTML = renderDetail(gift);
  // 绑定关闭按钮（每次重渲染后都要重新绑定）
  const closeBtns = maskEl.querySelectorAll('[data-close]');
  closeBtns.forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      closeDetail();
    });
  });
  maskEl.classList.add('gh-show');
}

function makeCabinet(gift){
  const wrap = document.createElement('div');
  wrap.className = 'gh-cab';

  // 顶部铁艺花冠
  const crown = '<svg class="gh-crown" viewBox="0 0 120 32"><use href="#gh-crown"/></svg>';
  // 双层玻璃罩
  const glassOuter = '<div class="gh-glassOuter"><div class="gh-light"></div>'
    + '<div class="gh-shape">' + renderMiniature(gift) + '</div></div>';
  const glassInner = '<div class="gh-glassInner"></div>';
  // 底座 + 铭牌
  const stand = '<div class="gh-stand">'
    + '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><use href="#gh-plinth"/></svg>'
    + '<div class="gh-plate">'
    +   '<span class="gh-num">' + esc(gift.no || '') + '</span>'
    +   '<span class="gh-name">' + esc(gift.title || '') + '</span>'
    +   '<span class="gh-deco">❀ ❀ ❀</span>'
    + '</div></div>';
  const shadow = '<div class="gh-castshadow"></div>';

  wrap.innerHTML = crown + glassOuter + glassInner + stand + shadow;
  wrap.addEventListener('click', function(){ openDetail(gift); });
  return wrap;
}

function esc(t){return (t == null ? '' : String(t)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderGifts(){
  const rooms = getRooms();
  rooms.forEach(function(r){
    const grid = getRoomGrid(container, r.key);
    if(!grid) return;
    const list = allGifts.filter(function(g){ return String(g.room || '1') === r.key; });
    grid.innerHTML = '';
    if(!list.length){
      const empty = document.createElement('div');
      empty.className = 'gh-empty';
      empty.textContent = '这一进暂时还没有藏品 · 等先生陆续放进来';
      grid.appendChild(empty);
      return;
    }
    list.forEach(function(g){
      grid.appendChild(makeCabinet(g));
    });
  });
}

function sortGifts(list){
  // pinned 在前；同级按 createdAt 倒序
  return list.slice().sort(function(a, b){
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if(pa !== pb) return pb - pa;
    const ta = a.createdAt || '';
    const tb = b.createdAt || '';
    return ta < tb ? 1 : (ta > tb ? -1 : 0);
  });
}

function startListener(){
  if(!collection || !onSnapshot || !db){
    console.warn('[gifts] 缺少 firestore 依赖');
    return;
  }
  try {
    onSnapshot(collection(db, 'gift_vault'), function(snap){
      const arr = [];
      let no = 0;
      snap.docs.forEach(function(d){
        const data = d.data();
        arr.push({ id: d.id, ...data });
      });
      allGifts = sortGifts(arr);
      // 编号是临时展示号，按倒序赋（最新的礼物拿小号，i.e. #001）
      allGifts.forEach(function(g, i){
        g.no = '#' + String(i + 1).padStart(3, '0');
      });
      renderGifts();
    }, function(err){
      console.error('[gifts] snapshot error', err);
    });
  } catch(e){
    console.error('[gifts] listener init failed', e);
  }
}

// ════════════════════════════════════════════════════════════
// 灵界记忆库 · pages/gifts/index.js
// 礼物展览馆页签入口（薄荷玻璃花房）
// 数据源：Firestore collection "gift_vault"
// 展柜结构（与 styles/gifts.css 对齐）：
//   .gh-cab
//     └─ .gh-glassOuter (flex column)
//         ├─ .gh-light
//         ├─ .gh-display    ← 礼物缩略
//         └─ .gh-plate-in   ← 铭牌（编号 / 名字 / 分隔线 / 装饰）
//     ├─ .gh-glassInner
//     └─ .gh-castshadow
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

export function onAuthChange(user){}

function attachMask(){
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
  const closeBtns = maskEl.querySelectorAll('[data-close]');
  closeBtns.forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      closeDetail();
    });
  });
  maskEl.classList.add('gh-show');
}

function esc(t){return (t == null ? '' : String(t)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function makeCabinet(gift){
  const wrap = document.createElement('div');
  wrap.className = 'gh-cab';

  const crown = '<svg class="gh-crown" viewBox="0 0 120 32"><use href="#gh-crown"/></svg>';

  // 玻璃柜内部分两个区块：上半 display（礼物） / 下半 plate-in（铭牌）
  const glassOuter = '<div class="gh-glassOuter">'
    + '<div class="gh-light"></div>'
    + '<div class="gh-display"><div class="gh-shape">' + renderMiniature(gift) + '</div></div>'
    + '<div class="gh-plate-in">'
    +   '<span class="gh-plate-num">' + esc(gift.no || '') + '</span>'
    +   '<span class="gh-plate-name">' + esc(gift.title || '') + '</span>'
    +   '<span class="gh-plate-ruler"></span>'
    +   '<span class="gh-plate-deco">❀ ' + esc(gift.pinned ? '已 置 顶' : '来 自 宿 烬') + ' ❀</span>'
    + '</div>'
    + '</div>';

  const glassInner = '<div class="gh-glassInner"></div>';
  const shadow = '<div class="gh-castshadow"></div>';

  wrap.innerHTML = crown + glassOuter + glassInner + shadow;
  wrap.addEventListener('click', function(){ openDetail(gift); });
  return wrap;
}

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
      snap.docs.forEach(function(d){
        const data = d.data();
        arr.push({ id: d.id, ...data });
      });
      allGifts = sortGifts(arr);
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

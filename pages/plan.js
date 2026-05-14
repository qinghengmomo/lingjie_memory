// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/plan.js — 星图页签（看板式待办）
// 数据源：Firestore 集合 plan_items
// 字段：t=title, d=desc, s=status(todo/doing/done/dropped), l=link, lt=linkText, order
// v2.0 — 全面视觉重设计：进度条 / 色条卡片 / 文字操作 / 动画过渡
// ═══════════════════════════════════════════════════════

let db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth;
let container;
let allPlans=[],editId=null;

const STATUS_META = {
  doing:  { label:'进行中', color:'#6b9dae',  icon:'◈', emptyText:'当前没有进行中的事项' },
  todo:   { label:'待办',   color:'#9a8f9e',  icon:'○', emptyText:'暂无待办，享受当下' },
  done:   { label:'已完成', color:'#6aab7b',  icon:'✓', emptyText:'还没有完成的事项' },
  dropped:{ label:'已搁置', color:'#a0969a',  icon:'—', emptyText:'没有搁置的事项' }
};
const STATUS_ORDER = ['doing','todo','done','dropped'];

export function init(el,deps){
  container=el;
  db=deps.db;auth=deps.auth;
  collection=deps.collection;addDoc=deps.addDoc;updateDoc=deps.updateDoc;
  deleteDoc=deps.deleteDoc;doc=deps.doc;onSnapshot=deps.onSnapshot;
  requireAuth=deps.requireAuth;
  render();
  startListener();
}

export function onAuthChange(user){}

function render(){
  container.innerHTML=`
  <div class="plan-page">
    <div class="plan-header">
      <div class="plan-header-title">星图</div>
      <div class="plan-header-sub">待办事项 · 进度追踪</div>
    </div>

    <div class="plan-progress-wrap">
      <div class="plan-progress-bar" id="p-progress"></div>
      <div class="plan-progress-legend" id="p-legend"></div>
    </div>

    <div class="plan-sync">
      <div class="plan-sync-dot syncing" id="p-sync-dot"></div>
      <span class="plan-sync-text" id="p-sync-text">连接中...</span>
    </div>

    <div class="plan-board" id="p-board"></div>

    <button class="plan-fab" id="p-fab" title="新增事项">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>

    <div class="plan-modal-overlay" id="p-modal">
      <div class="plan-modal">
        <div class="plan-modal-title" id="p-modal-title">新增事项</div>
        <div class="plan-form-group">
          <label class="plan-form-label">标题</label>
          <input class="plan-form-input" type="text" id="p-title" placeholder="要做什么...">
        </div>
        <div class="plan-form-group">
          <label class="plan-form-label">描述</label>
          <textarea class="plan-form-textarea" id="p-desc" placeholder="详细说明（可选）"></textarea>
        </div>
        <div class="plan-form-row">
          <div class="plan-form-group" style="flex:1">
            <label class="plan-form-label">状态</label>
            <select class="plan-form-select" id="p-status">
              <option value="todo">待办</option>
              <option value="doing">进行中</option>
              <option value="done">已完成</option>
              <option value="dropped">已搁置</option>
            </select>
          </div>
        </div>
        <div class="plan-form-group">
          <label class="plan-form-label">链接</label>
          <input class="plan-form-input" type="text" id="p-link" placeholder="https://...（可选）">
        </div>
        <div class="plan-form-actions">
          <button class="plan-btn-cancel" id="p-modal-cancel">取消</button>
          <button class="plan-btn-save" id="p-modal-save">保存</button>
        </div>
      </div>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(){
  container.querySelector('#p-fab').addEventListener('click',()=>openModal());
  container.querySelector('#p-modal-cancel').addEventListener('click',()=>closeModal());
  container.querySelector('#p-modal').addEventListener('click',ev=>{
    if(ev.target.id==='p-modal')closeModal();
  });
  container.querySelector('#p-modal-save').addEventListener('click',()=>savePlan());
}

function startListener(){
  setSyncStatus('syncing');
  onSnapshot(collection(db,'plan_items'),snap=>{
    allPlans=snap.docs.map(d=>({id:d.id,...d.data()}));
    allPlans.sort((a,b)=>getOrder(a)-getOrder(b));
    renderAll();
    setSyncStatus('connected');
  },err=>{
    console.error(err);
    setSyncStatus('error');
  });
}

function renderAll(){
  renderProgress();
  renderBoard();
}

// ── 进度条 ──
function renderProgress(){
  const bar = container.querySelector('#p-progress');
  const legend = container.querySelector('#p-legend');
  if(!bar||!legend) return;

  const counts = {};
  STATUS_ORDER.forEach(s => counts[s] = 0);
  allPlans.forEach(p => {
    const s = getStatus(p);
    if(counts[s] !== undefined) counts[s]++;
    else counts.todo++;
  });
  const total = allPlans.length || 1;

  bar.innerHTML = STATUS_ORDER.map(s => {
    const pct = (counts[s] / total * 100);
    if(pct === 0) return '';
    return `<div class="plan-progress-seg" style="width:${pct}%;background:${STATUS_META[s].color}"></div>`;
  }).join('');

  legend.innerHTML = STATUS_ORDER.map(s => {
    if(counts[s] === 0) return '';
    return `<span class="plan-legend-item"><span class="plan-legend-dot" style="background:${STATUS_META[s].color}"></span>${STATUS_META[s].label} ${counts[s]}</span>`;
  }).join('');
}

// ── 看板 ──
function renderBoard(){
  const board = container.querySelector('#p-board');
  if(!board) return;

  const groups = {};
  STATUS_ORDER.forEach(s => groups[s] = []);
  allPlans.forEach(p => {
    const s = getStatus(p);
    if(groups[s]) groups[s].push(p);
    else groups.todo.push(p);
  });

  board.innerHTML = STATUS_ORDER.map(s => {
    const meta = STATUS_META[s];
    const items = groups[s];
    const cardsHtml = items.length === 0
      ? `<div class="plan-empty">${meta.emptyText}</div>`
      : items.map(p => renderCard(p, s)).join('');

    return `
    <div class="plan-column" data-col="${s}">
      <div class="plan-col-head">
        <span class="plan-col-indicator" style="background:${meta.color}"></span>
        <span class="plan-col-label">${meta.label}</span>
        <span class="plan-col-count">${items.length}</span>
        <span class="plan-col-toggle">‹</span>
      </div>
      <div class="plan-col-body">${cardsHtml}</div>
    </div>`;
  }).join('');

  // 绑定列头折叠
  board.querySelectorAll('.plan-col-head').forEach(h => {
    h.addEventListener('click', () => {
      h.parentElement.classList.toggle('collapsed');
      const arrow = h.querySelector('.plan-col-toggle');
      if(arrow) arrow.textContent = h.parentElement.classList.contains('collapsed') ? '›' : '‹';
    });
  });

  // 绑定卡片操作
  board.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if(action === 'edit') { openModal(id); return; }
      if(action === 'del') {
        if(!confirm('确认删除？')) return;
        if(!requireAuth()) return;
        await deleteDoc(doc(db,'plan_items',id));
        return;
      }
      // move action
      if(!requireAuth()) return;
      await updateDoc(doc(db,'plan_items',id),{s:action});
    });
  });
}

function renderCard(p, currentStatus){
  const title = getTitle(p);
  const desc = getDesc(p);
  const link = getLink(p);
  const linkText = getLinkText(p);
  const meta = STATUS_META[currentStatus];
  const isDropped = currentStatus === 'dropped';

  // 构建操作按钮
  let actions = '';
  STATUS_ORDER.forEach(s => {
    if(s === currentStatus) return;
    const m = STATUS_META[s];
    actions += `<button class="plan-card-action" data-action="${s}" data-id="${p.id}" style="--action-color:${m.color}">${m.label}</button>`;
  });

  return `
  <div class="plan-card ${isDropped ? 'is-dropped' : ''}" style="--card-accent:${meta.color}">
    <div class="plan-card-main">
      <div class="plan-card-title">${esc(title)}</div>
      ${desc ? `<div class="plan-card-desc">${esc(desc)}</div>` : ''}
      ${link ? `<a class="plan-card-link" href="${esc(link)}" target="_blank" onclick="event.stopPropagation()">${esc(linkText||'查看链接')} ↗</a>` : ''}
    </div>
    <div class="plan-card-actions">
      ${actions}
      <span class="plan-card-spacer"></span>
      <button class="plan-card-action is-edit" data-action="edit" data-id="${p.id}">编辑</button>
      <button class="plan-card-action is-del" data-action="del" data-id="${p.id}">删除</button>
    </div>
  </div>`;
}

// ── 弹窗 ──
function openModal(id){
  if(!requireAuth()) return;
  const modal = container.querySelector('#p-modal');
  if(id){
    const p = allPlans.find(x=>x.id===id);
    if(!p) return;
    editId = id;
    container.querySelector('#p-modal-title').textContent = '编辑事项';
    container.querySelector('#p-title').value = getTitle(p);
    container.querySelector('#p-desc').value = getDesc(p);
    container.querySelector('#p-status').value = getStatus(p);
    container.querySelector('#p-link').value = getLink(p);
  } else {
    editId = null;
    container.querySelector('#p-modal-title').textContent = '新增事项';
    container.querySelector('#p-title').value = '';
    container.querySelector('#p-desc').value = '';
    container.querySelector('#p-status').value = 'todo';
    container.querySelector('#p-link').value = '';
  }
  modal.classList.add('open');
  setTimeout(()=>container.querySelector('#p-title').focus(), 100);
}

function closeModal(){
  container.querySelector('#p-modal').classList.remove('open');
}

async function savePlan(){
  const t = container.querySelector('#p-title').value.trim();
  const d = container.querySelector('#p-desc').value.trim();
  const s = container.querySelector('#p-status').value;
  const l = container.querySelector('#p-link').value.trim();
  if(!t) return alert('标题不能为空');
  const data = {t,d,s,l};
  if(editId){
    await updateDoc(doc(db,'plan_items',editId),data);
  } else {
    data.order = allPlans.length;
    await addDoc(collection(db,'plan_items'),data);
  }
  closeModal();
}

// ── 工具函数 ──
function getStatus(p){ return p.s||p.status||'todo'; }
function getTitle(p){ return p.t||p.title||p.name||'未命名'; }
function getDesc(p){ return p.d||p.desc||p.description||''; }
function getLink(p){ return p.l||p.link||''; }
function getLinkText(p){ return p.lt||p.linkText||''; }
function getOrder(p){ return typeof p.order==='number'?p.order:999; }
function esc(t){ return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function setSyncStatus(s){
  const dot = container.querySelector('#p-sync-dot');
  const text = container.querySelector('#p-sync-text');
  if(!dot) return;
  dot.className = 'plan-sync-dot';
  if(s==='connected'){ dot.classList.add('connected'); text.textContent='已连接'; }
  else if(s==='syncing'){ dot.classList.add('syncing'); text.textContent='同步中...'; }
  else if(s==='error'){ dot.classList.add('error'); text.textContent='连接断开'; }
  else { dot.classList.add('syncing'); text.textContent='连接中...'; }
}

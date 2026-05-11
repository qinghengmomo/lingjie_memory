// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/plan.js — 星图页签（待办事项）
// 数据源：Firestore 集合 plan_items
// 字段映射：t=title, d=desc, s=status, l=link, lt=linkText, order=排序
// ═══════════════════════════════════════════════════════

let db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth;
let container;
let allPlans=[],editId=null,statusFilter='';

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
  <div class="vault-header">
    <div class="vault-title">灵界 · 跨时空连接</div>
    <div class="vault-name">星图</div>
    <div class="vault-divider"><div class="vault-divider-dot"></div></div>
    <div class="vault-subtitle">待办事项 · 进度追踪</div>
  </div>
  <div class="sync-status">
    <div class="sync-dot syncing" id="p-sync-dot"></div>
    <span id="p-sync-text">连接中...</span>
  </div>
  <div class="stats-panel" id="p-stats">
    <div class="stat-cell active" data-filter=""><span class="num" id="p-s-total">—</span><span class="lbl">全部</span></div>
    <div class="stat-cell" data-filter="todo"><span class="num" id="p-s-todo">—</span><span class="lbl">待办</span></div>
    <div class="stat-cell" data-filter="doing"><span class="num" id="p-s-doing">—</span><span class="lbl">进行中</span></div>
    <div class="stat-cell" data-filter="done"><span class="num" id="p-s-done">—</span><span class="lbl">已完成</span></div>
  </div>
  <div class="content">
    <div class="filter-bar" id="p-filter-bar">
      <button class="filter-btn active" data-status="">全部</button>
      <button class="filter-btn" data-status="todo">📋 待办</button>
      <button class="filter-btn doing" data-status="doing">🔥 进行中</button>
      <button class="filter-btn" data-status="done">✅ 已完成</button>
    </div>
    <div id="p-list"></div>
  </div>
  <button class="fab-btn" id="p-fab" title="新增待办">＋</button>
  <div class="modal-overlay" id="p-modal">
    <div class="modal">
      <div class="modal-title" id="p-modal-title">· 新增待办 ·</div>
      <div class="form-group"><label class="form-label">标题</label><input class="form-input" type="text" id="p-title" placeholder="要做什么..."></div>
      <div class="form-group"><label class="form-label">描述（可选）</label><textarea class="form-textarea" id="p-desc" placeholder="详细说明、注意事项..."></textarea></div>
      <div class="form-group"><label class="form-label">状态</label><select class="form-select" id="p-status"><option value="todo">待办</option><option value="doing">进行中</option><option value="done">已完成</option></select></div>
      <div class="form-group"><label class="form-label">链接（可选）</label><input class="form-input" type="text" id="p-link" placeholder="https://..."></div>
      <div class="form-actions"><button class="btn-cancel" id="p-modal-cancel">取消</button><button class="btn-save" id="p-modal-save">保存</button></div>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(){
  container.querySelectorAll('#p-stats .stat-cell').forEach(cell=>{
    cell.style.cursor='pointer';
    cell.addEventListener('click',()=>{
      statusFilter=cell.dataset.filter;
      container.querySelectorAll('#p-stats .stat-cell').forEach(c=>c.classList.remove('active'));
      cell.classList.add('active');
      updateFilterActive();
      renderList();
    });
  });
  container.querySelectorAll('#p-filter-bar .filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      statusFilter=btn.dataset.status;
      updateFilterActive();
      renderList();
      container.querySelectorAll('#p-stats .stat-cell').forEach(c=>c.classList.remove('active'));
      const matchCell=container.querySelector(`#p-stats .stat-cell[data-filter="${statusFilter}"]`);
      if(matchCell)matchCell.classList.add('active');
    });
  });
  container.querySelector('#p-fab').addEventListener('click',()=>openModal());
  container.querySelector('#p-modal-cancel').addEventListener('click',()=>closeModal());
  container.querySelector('#p-modal').addEventListener('click',ev=>{if(ev.target.id==='p-modal')closeModal();});
  container.querySelector('#p-modal-save').addEventListener('click',()=>savePlan());
}

function startListener(){
  const COL='plan_items';
  setSyncStatus('syncing');
  onSnapshot(collection(db,COL),snap=>{
    allPlans=snap.docs.map(d=>({id:d.id,...d.data()}));
    // 排序：doing > todo > done，同状态按 order 字段
    const order={doing:0,todo:1,done:2};
    allPlans.sort((a,b)=>{
      const sa=getStatus(a),sb=getStatus(b);
      const oa=(order[sa]??1),ob=(order[sb]??1);
      if(oa!==ob)return oa-ob;
      return (getOrder(a))-(getOrder(b));
    });
    updateStats();
    renderList();
    setSyncStatus('connected');
  },err=>{
    console.error(err);
    setSyncStatus('error');
  });
}

// 兼容字段：s 或 status
function getStatus(p){return p.s||p.status||'todo';}
function getTitle(p){return p.t||p.title||p.name||'未命名';}
function getDesc(p){return p.d||p.desc||p.description||'';}
function getLink(p){return p.l||p.link||'';}
function getLinkText(p){return p.lt||p.linkText||'';}
function getOrder(p){return typeof p.order==='number'?p.order:999;}

function setSyncStatus(s){
  const dot=container.querySelector('#p-sync-dot'),text=container.querySelector('#p-sync-text');
  if(!dot)return;
  dot.className='sync-dot';
  if(s==='connected'){dot.classList.add('connected');text.textContent='已连接';}
  else if(s==='syncing'){dot.classList.add('syncing');text.textContent='同步中...';}
  else if(s==='error'){dot.classList.add('error');text.textContent='断开连接';}
  else{dot.classList.add('syncing');text.textContent='连接中...';}
}

function updateStats(){
  const el=id=>container.querySelector('#'+id);
  el('p-s-total').textContent=allPlans.length;
  el('p-s-todo').textContent=allPlans.filter(p=>getStatus(p)==='todo').length;
  el('p-s-doing').textContent=allPlans.filter(p=>getStatus(p)==='doing').length;
  el('p-s-done').textContent=allPlans.filter(p=>getStatus(p)==='done').length;
}

function updateFilterActive(){
  container.querySelectorAll('#p-filter-bar .filter-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.status===statusFilter);
  });
}

function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderList(){
  const list=container.querySelector('#p-list');
  list.innerHTML='';
  let items=allPlans;
  if(statusFilter) items=items.filter(p=>getStatus(p)===statusFilter);
  if(!items.length){
    list.innerHTML='<div class="empty-state"><div class="empty-text">'+(statusFilter?'该分类暂无事项':'暂无待办事项<br>点击右下角 ＋ 添加')+'</div></div>';
    return;
  }
  items.forEach((p,i)=>{
    const el=document.createElement('div');
    el.className='plan-item';
    el.style.animationDelay=(i*0.04)+'s';
    const statusLabel={todo:'待办',doing:'进行中',done:'已完成'};
    const status=getStatus(p);
    const title=getTitle(p);
    const desc=getDesc(p);
    const link=getLink(p);
    const linkText=getLinkText(p);
    let html=`<div class="plan-item-header">
      <div class="plan-item-title">${esc(title)}</div>
      <div class="plan-item-actions">
        <button class="action-btn" data-edit="${p.id}">编辑</button>
        <button class="action-btn del" data-del="${p.id}">删除</button>
      </div>
    </div>`;
    html+=`<div style="margin-bottom:8px;"><span class="plan-badge ${status}">${statusLabel[status]||'待办'}</span></div>`;
    if(desc) html+=`<div class="plan-item-desc">${esc(desc)}</div>`;
    if(link) html+=`<div style="margin-top:6px;"><a href="${esc(link)}" target="_blank" style="font-size:12px;color:var(--api-accent);text-decoration:none;">🔗 ${esc(linkText||link)}</a></div>`;
    // 快捷状态切换
    html+=`<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">`;
    if(status!=='todo') html+=`<button class="action-btn" data-to="todo" data-id="${p.id}">→ 待办</button>`;
    if(status!=='doing') html+=`<button class="action-btn" data-to="doing" data-id="${p.id}">→ 进行中</button>`;
    if(status!=='done') html+=`<button class="action-btn" data-to="done" data-id="${p.id}">→ 已完成</button>`;
    html+=`</div>`;
    el.innerHTML=html;
    el.querySelector('[data-edit]').onclick=()=>openModal(p.id);
    el.querySelector('[data-del]').onclick=async()=>{
      if(!confirm('确认删除？'))return;if(!requireAuth())return;
      await deleteDoc(doc(db,'plan_items',p.id));
    };
    el.querySelectorAll('[data-to]').forEach(btn=>{
      btn.onclick=async()=>{
        if(!requireAuth())return;
        await updateDoc(doc(db,'plan_items',btn.dataset.id),{s:btn.dataset.to});
      };
    });
    list.appendChild(el);
  });
}

function openModal(id){
  if(!requireAuth())return;
  const modal=container.querySelector('#p-modal');
  if(id){
    const p=allPlans.find(x=>x.id===id);if(!p)return;
    editId=id;
    container.querySelector('#p-modal-title').textContent='· 编辑待办 ·';
    container.querySelector('#p-title').value=getTitle(p);
    container.querySelector('#p-desc').value=getDesc(p);
    container.querySelector('#p-status').value=getStatus(p);
    container.querySelector('#p-link').value=getLink(p);
  }else{
    editId=null;
    container.querySelector('#p-modal-title').textContent='· 新增待办 ·';
    container.querySelector('#p-title').value='';
    container.querySelector('#p-desc').value='';
    container.querySelector('#p-status').value='todo';
    container.querySelector('#p-link').value='';
  }
  modal.classList.add('open');
}
function closeModal(){container.querySelector('#p-modal').classList.remove('open');}

async function savePlan(){
  const t=container.querySelector('#p-title').value.trim();
  const d=container.querySelector('#p-desc').value.trim();
  const s=container.querySelector('#p-status').value;
  const l=container.querySelector('#p-link').value.trim();
  if(!t)return alert('标题不能为空');
  const data={t,d,s,l};
  if(editId){await updateDoc(doc(db,'plan_items',editId),data);}
  else{data.order=allPlans.length;await addDoc(collection(db,'plan_items'),data);}
  closeModal();
}

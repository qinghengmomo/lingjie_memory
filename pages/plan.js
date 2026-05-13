// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/plan.js — 星图页签（看板式待办）
// 数据源：Firestore 集合 plan_items
// 字段：t=title, d=desc, s=status(todo/doing/done/dropped), l=link, lt=linkText, order
// 布局：四栏看板（桌面横排，手机竖向折叠）
// ═══════════════════════════════════════════════════════

let db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth;
let container;
let allPlans=[],editId=null;

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
  <div class="plan-board" id="p-board">
    <div class="plan-column" data-col="doing">
      <div class="plan-col-header doing"><span class="plan-col-dot doing"></span>进行中 <span class="plan-col-count" id="pc-doing">0</span></div>
      <div class="plan-col-list" id="pl-doing"></div>
    </div>
    <div class="plan-column" data-col="todo">
      <div class="plan-col-header todo"><span class="plan-col-dot todo"></span>待办 <span class="plan-col-count" id="pc-todo">0</span></div>
      <div class="plan-col-list" id="pl-todo"></div>
    </div>
    <div class="plan-column" data-col="done">
      <div class="plan-col-header done"><span class="plan-col-dot done"></span>已完成 <span class="plan-col-count" id="pc-done">0</span></div>
      <div class="plan-col-list" id="pl-done"></div>
    </div>
    <div class="plan-column" data-col="dropped">
      <div class="plan-col-header dropped"><span class="plan-col-dot dropped"></span>已废弃 <span class="plan-col-count" id="pc-dropped">0</span></div>
      <div class="plan-col-list" id="pl-dropped"></div>
    </div>
  </div>
  <button class="fab-btn" id="p-fab" title="新增待办">＋</button>
  <div class="modal-overlay" id="p-modal">
    <div class="modal">
      <div class="modal-title" id="p-modal-title">· 新增待办 ·</div>
      <div class="form-group"><label class="form-label">标题</label><input class="form-input" type="text" id="p-title" placeholder="要做什么..."></div>
      <div class="form-group"><label class="form-label">描述（可选）</label><textarea class="form-textarea" id="p-desc" placeholder="详细说明..."></textarea></div>
      <div class="form-group"><label class="form-label">状态</label><select class="form-select" id="p-status"><option value="todo">待办</option><option value="doing">进行中</option><option value="done">已完成</option><option value="dropped">已废弃</option></select></div>
      <div class="form-group"><label class="form-label">链接（可选）</label><input class="form-input" type="text" id="p-link" placeholder="https://..."></div>
      <div class="form-actions"><button class="btn-cancel" id="p-modal-cancel">取消</button><button class="btn-save" id="p-modal-save">保存</button></div>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(){
  container.querySelector('#p-fab').addEventListener('click',()=>openModal());
  container.querySelector('#p-modal-cancel').addEventListener('click',()=>closeModal());
  container.querySelector('#p-modal').addEventListener('click',ev=>{if(ev.target.id==='p-modal')closeModal();});
  container.querySelector('#p-modal-save').addEventListener('click',()=>savePlan());
  // 手机端折叠
  container.querySelectorAll('.plan-col-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const col=h.parentElement;
      col.classList.toggle('collapsed');
    });
  });
}

function startListener(){
  const COL='plan_items';
  setSyncStatus('syncing');
  onSnapshot(collection(db,COL),snap=>{
    allPlans=snap.docs.map(d=>({id:d.id,...d.data()}));
    allPlans.sort((a,b)=>getOrder(a)-getOrder(b));
    renderBoard();
    setSyncStatus('connected');
  },err=>{
    console.error(err);
    setSyncStatus('error');
  });
}

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

function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderBoard(){
  const groups={todo:[],doing:[],done:[],dropped:[]};
  allPlans.forEach(p=>{
    const s=getStatus(p);
    if(groups[s])groups[s].push(p);
    else groups.todo.push(p);
  });
  ['todo','doing','done','dropped'].forEach(s=>{
    const list=container.querySelector('#pl-'+s);
    const count=container.querySelector('#pc-'+s);
    if(!list||!count)return;
    count.textContent=groups[s].length;
    list.innerHTML='';
    if(!groups[s].length){
      list.innerHTML='<div class="plan-card-empty">暂无</div>';
      return;
    }
    groups[s].forEach(p=>{
      const card=document.createElement('div');
      card.className='plan-card'+(s==='dropped'?' dropped':'');
      const title=getTitle(p);
      const desc=getDesc(p);
      const link=getLink(p);
      const linkText=getLinkText(p);
      let html=`<div class="plan-card-title">${esc(title)}</div>`;
      if(desc) html+=`<div class="plan-card-desc">${esc(desc)}</div>`;
      if(link) html+=`<a class="plan-card-link" href="${esc(link)}" target="_blank">🔗 ${esc(linkText||'链接')}</a>`;
      // 状态切换箭头
      html+=`<div class="plan-card-actions">`;
      if(s!=='todo') html+=`<button class="plan-move-btn" data-to="todo" data-id="${p.id}" title="移到待办">◁</button>`;
      if(s!=='doing') html+=`<button class="plan-move-btn gold" data-to="doing" data-id="${p.id}" title="移到进行中">◈</button>`;
      if(s!=='done') html+=`<button class="plan-move-btn green" data-to="done" data-id="${p.id}" title="移到已完成">▷</button>`;
      if(s!=='dropped') html+=`<button class="plan-move-btn dim" data-to="dropped" data-id="${p.id}" title="移到废弃">✕</button>`;
      html+=`<span class="plan-card-spacer"></span>`;
      html+=`<button class="plan-edit-btn" data-edit="${p.id}">编辑</button>`;
      html+=`<button class="plan-del-btn" data-del="${p.id}">删除</button>`;
      html+=`</div>`;
      card.innerHTML=html;
      // 绑定
      card.querySelectorAll('.plan-move-btn').forEach(btn=>{
        btn.onclick=async()=>{
          if(!requireAuth())return;
          await updateDoc(doc(db,'plan_items',btn.dataset.id),{s:btn.dataset.to});
        };
      });
      const editBtn=card.querySelector('[data-edit]');
      if(editBtn) editBtn.onclick=()=>openModal(p.id);
      const delBtn=card.querySelector('[data-del]');
      if(delBtn) delBtn.onclick=async()=>{
        if(!confirm('确认删除？'))return;if(!requireAuth())return;
        await deleteDoc(doc(db,'plan_items',p.id));
      };
      list.appendChild(card);
    });
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

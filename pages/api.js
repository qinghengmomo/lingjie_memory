// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/api.js — API平台页签
// 鉴权门：未登录时不订阅 Firestore，登录后启动 onSnapshot
// ═══════════════════════════════════════════════════════

let db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth;
let container;
let allApis=[],editId=null;
let unsubscribe=null;

export function init(el,deps){
  container=el;
  db=deps.db;auth=deps.auth;
  collection=deps.collection;addDoc=deps.addDoc;updateDoc=deps.updateDoc;
  deleteDoc=deps.deleteDoc;doc=deps.doc;onSnapshot=deps.onSnapshot;
  requireAuth=deps.requireAuth;
  render();
  if(auth&&auth.currentUser) startListener();
  else showAuthPlaceholder();
}

export function onAuthChange(user){
  if(user){
    startListener();
  }else{
    stopListener();
    allApis=[];
    showAuthPlaceholder();
  }
}

function showAuthPlaceholder(){
  if(!container) return;
  setSyncStatus('locked');
  const grid=container.querySelector('#a-grid');
  if(grid) grid.innerHTML='<div class="empty-state"><div class="empty-icon">🔐</div><div class="empty-text">登录后查看平台账号本<br>顶部右上角点「登录」</div></div>';
}

function render(){
  container.innerHTML=`
  <div class="api-header">
    <div class="api-title">API 平台</div>
    <div class="page-divider"><div class="page-divider-dot"></div></div>
    <div class="api-subtitle">AI 平台账号本 · 灵界收录</div>
  </div>
  <div class="sync-status">
    <div class="sync-dot syncing" id="a-sync-dot"></div>
    <span id="a-sync-text">连接中...</span>
  </div>
  <div class="api-grid" id="a-grid">
    <div class="empty-state"><div class="empty-icon">🔌</div><div class="empty-text">正在载入接口...</div></div>
  </div>
  <button class="fab-btn" id="a-fab" title="新增接口">＋</button>
  <div class="modal-overlay" id="a-modal">
    <div class="modal api-modal">
      <div class="modal-title" id="a-modal-title">· 新增平台 ·</div>
      <div class="form-group"><label class="form-label">平台名称</label><input class="form-input" id="a-name" type="text" placeholder="例：dataeyes"></div>
      <div class="form-group"><label class="form-label">网址</label><input class="form-input" id="a-url" type="text" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">账号 / 手机号</label><input class="form-input" id="a-email" type="text" placeholder="登录邮箱或手机号"></div>
      <div class="form-group"><label class="form-label">套餐 / 方案</label><input class="form-input" id="a-plan" type="text" placeholder="免费版 / Pro / 按量付费..."></div>
      <div class="form-group"><label class="form-label">备注（可选）</label><textarea class="form-textarea" id="a-note" placeholder="用途说明、到期时间、注意事项..."></textarea></div>
      <div class="form-actions"><button class="btn-cancel" id="a-modal-cancel">取消</button><button class="btn-save" id="a-modal-save">保存</button></div>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(){
  container.querySelector('#a-fab').addEventListener('click',()=>openModal());
  container.querySelector('#a-modal-cancel').addEventListener('click',()=>closeModal());
  container.querySelector('#a-modal').addEventListener('click',ev=>{if(ev.target.id==='a-modal')closeModal();});
  container.querySelector('#a-modal-save').addEventListener('click',()=>saveApi());
}

function startListener(){
  if(unsubscribe) return;
  const COL='api_platforms';
  setSyncStatus('syncing');
  unsubscribe=onSnapshot(collection(db,COL),snap=>{
    allApis=snap.docs.map(d=>({id:d.id,...d.data()}));
    allApis.sort((a,b)=>((a.updatedAt||'')>(b.updatedAt||''))?-1:1);
    renderApis();
    setSyncStatus('connected');
  },err=>{
    console.error(err);
    setSyncStatus('error');
  });
}

function stopListener(){
  if(unsubscribe){
    try{ unsubscribe(); }catch(e){}
    unsubscribe=null;
  }
}

function setSyncStatus(s){
  const dot=container.querySelector('#a-sync-dot'),text=container.querySelector('#a-sync-text');
  if(!dot)return;
  dot.className='sync-dot';
  if(s==='connected'){dot.classList.add('connected');text.textContent='已连接';}
  else if(s==='syncing'){dot.classList.add('syncing');text.textContent='同步中...';}
  else if(s==='error'){dot.classList.add('error');text.textContent='断开连接';}
  else if(s==='locked'){dot.classList.add('error');text.textContent='未登录 · 请先登录';}
  else{dot.classList.add('syncing');text.textContent='连接中...';}
}

function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtTime(ts){
  if(!ts)return '';
  const d=typeof ts==='number'?new Date(ts):new Date(ts);
  if(isNaN(d))return '';
  return d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
}

function renderApis(){
  const grid=container.querySelector('#a-grid');
  grid.innerHTML='';
  if(!allApis.length){
    grid.innerHTML='<div class="empty-state"><div class="empty-icon">🔌</div><div class="empty-text">暂无平台记录<br>点击右下角 ＋ 添加</div></div>';
    return;
  }
  allApis.forEach((a,i)=>{
    const card=document.createElement('div');
    card.className='api-card';
    card.style.animationDelay=(i*0.05)+'s';
    let html=`<div class="api-card-header"><div class="api-card-name">${esc(a.name||'未命名平台')}</div><div class="api-card-actions"><button class="api-action-btn" data-edit="${a.id}">编辑</button><button class="api-action-btn del" data-del="${a.id}">删除</button></div></div>`;
    if(a.url) html+=`<a class="api-card-url" href="${esc(a.url)}" target="_blank">${esc(a.url)}</a>`;
    if(a.email) html+=`<div class="api-card-row"><span class="api-card-label">账号</span><span class="api-card-value">${esc(a.email)}</span></div>`;
    if(a.plan) html+=`<div class="api-card-row"><span class="api-card-label">套餐</span><span class="api-card-value">${esc(a.plan)}</span></div>`;
    const ts=fmtTime(a.createdAt);
    if(ts) html+=`<div class="api-card-row"><span class="api-card-label">收录</span><span class="api-card-value">${ts}</span></div>`;
    if(a.note) html+=`<div class="api-card-note">${esc(a.note)}</div>`;
    card.innerHTML=html;
    card.querySelector('[data-edit]').onclick=()=>openModal(a.id);
    card.querySelector('[data-del]').onclick=async()=>{
      if(!confirm('确认删除这条平台记录？'))return;
      if(!requireAuth())return;
      await deleteDoc(doc(db,'api_platforms',a.id));
    };
    grid.appendChild(card);
  });
}

function openModal(id){
  if(!requireAuth())return;
  const modal=container.querySelector('#a-modal');
  if(id){
    const a=allApis.find(x=>x.id===id);if(!a)return;
    editId=id;
    container.querySelector('#a-modal-title').textContent='· 编辑平台 ·';
    container.querySelector('#a-name').value=a.name||'';
    container.querySelector('#a-url').value=a.url||'';
    container.querySelector('#a-email').value=a.email||'';
    container.querySelector('#a-plan').value=a.plan||'';
    container.querySelector('#a-note').value=a.note||'';
  }else{
    editId=null;
    container.querySelector('#a-modal-title').textContent='· 新增平台 ·';
    ['a-name','a-url','a-email','a-plan','a-note'].forEach(id=>container.querySelector('#'+id).value='');
  }
  modal.classList.add('open');
}
function closeModal(){container.querySelector('#a-modal').classList.remove('open');}

async function saveApi(){
  const name=container.querySelector('#a-name').value.trim();
  const url=container.querySelector('#a-url').value.trim();
  const email=container.querySelector('#a-email').value.trim();
  const plan=container.querySelector('#a-plan').value.trim();
  const note=container.querySelector('#a-note').value.trim();
  if(!name||!url)return alert('平台名称和网址不能为空');
  const now=Date.now();
  const data={name,url,email,plan,note};
  if(editId){data.updatedAt=now;await updateDoc(doc(db,'api_platforms',editId),data);}
  else{data.createdAt=now;await addDoc(collection(db,'api_platforms'),data);}
  closeModal();
}

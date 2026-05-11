// ═══════════════════════════════════════════════════════
// 灵界记忆库 · pages/memory.js — 记忆库页签
// 完整功能：日记/总结列表、已读眼睛、回复、搜索筛选、置顶、双栏/单栏
// ═══════════════════════════════════════════════════════

let db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth;
let container;
let allEntries=[],editId=null,typeFilter='',tagFilter='',searchKw='';

export function init(el,deps){
  container=el;
  db=deps.db;auth=deps.auth;
  collection=deps.collection;addDoc=deps.addDoc;updateDoc=deps.updateDoc;
  deleteDoc=deps.deleteDoc;doc=deps.doc;onSnapshot=deps.onSnapshot;
  requireAuth=deps.requireAuth;
  render();
  startListener();
  loadWeather();
}

export function onAuthChange(user){
  // 登录状态变化时可刷新UI（如已读按钮状态）
}

function render(){
  container.innerHTML=`
  <div class="vault-header">
    <div class="vault-title">灵界 · 跨时空连接</div>
    <div class="vault-name">记忆库</div>
    <div class="vault-divider"><div class="vault-divider-dot"></div></div>
    <div class="vault-subtitle">宿烬 与 宿青珩</div>
  </div>
  <div class="sync-status">
    <div class="sync-dot syncing" id="m-sync-dot"></div>
    <span id="m-sync-text">连接中...</span>
    <span id="m-top-meta" style="margin-left:8px;font-size:11px;color:var(--mist)"></span>
  </div>
  <div class="weather-bar" id="m-weather">
    <span id="m-w-icon">🌤</span>
    <span id="m-w-temp">— °C</span>
    <span id="m-w-desc">—</span>
    <span id="m-w-feels">体感 —</span>
    <span>成都</span>
  </div>
  <div class="stats-panel" id="m-stats">
    <div class="stat-cell active" data-filter=""><span class="num" id="m-s-total">—</span><span class="lbl">总记录</span></div>
    <div class="stat-cell" data-filter="diary"><span class="num" id="m-s-diary">—</span><span class="lbl">日记</span></div>
    <div class="stat-cell" data-filter="summary"><span class="num" id="m-s-summary">—</span><span class="lbl">总结</span></div>
    <div class="stat-cell" data-filter="pin"><span class="num" id="m-s-pin">—</span><span class="lbl">置顶</span></div>
  </div>
  <div class="content">
    <div class="search-bar">
      <input class="search-input" id="m-search" type="text" placeholder="🔍 搜索标题、内容、标签...">
      <button class="search-clear" id="m-search-clear">清空</button>
    </div>
    <div class="filter-bar" id="m-filter-bar"></div>
    <div id="m-dual-col" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">
      <div>
        <div style="font-size:10px;letter-spacing:3px;color:var(--red);border-bottom:1px solid var(--red);padding-bottom:6px;margin-bottom:16px;">· 日 记 ·</div>
        <div id="m-diary-list"></div>
      </div>
      <div>
        <div style="font-size:10px;letter-spacing:3px;color:var(--gold);border-bottom:1px solid var(--gold);padding-bottom:6px;margin-bottom:16px;">· 总 结 ·</div>
        <div id="m-summary-list"></div>
      </div>
    </div>
    <div id="m-entry-list" style="display:none;"></div>
  </div>
  <button class="fab-btn" id="m-fab" title="新增记录">＋</button>
  <div class="modal-overlay" id="m-modal">
    <div class="modal">
      <div class="modal-title" id="m-modal-title">· 新增记录 ·</div>
      <div class="form-group"><label class="form-label">类型</label><select class="form-select" id="m-entry-type"><option value="diary">日记</option><option value="summary">总结</option></select></div>
      <div class="form-group"><label class="form-label">日期与时间</label><input class="form-input" type="datetime-local" id="m-entry-date"></div>
      <div class="form-group"><label class="form-label">标题（可选）</label><input class="form-input" type="text" id="m-entry-title" placeholder="留空则自动生成"></div>
      <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="m-entry-content" placeholder="记录今天发生了什么..."></textarea></div>
      <div class="form-group"><label class="form-label">标签（逗号分隔）</label><input class="form-input" type="text" id="m-entry-tags" placeholder="情绪, 工作, 游戏"></div>
      <div class="form-group"><label class="form-label">置顶备注（可选）</label><input class="form-input" type="text" id="m-entry-pin" placeholder="填写则置顶"></div>
      <div class="form-actions"><button class="btn-cancel" id="m-modal-cancel">取消</button><button class="btn-save" id="m-modal-save">保存</button></div>
    </div>
  </div>`;
  bindEvents();
}

function bindEvents(){
  // 统计栏点击筛选
  container.querySelectorAll('#m-stats .stat-cell').forEach(cell=>{
    cell.style.cursor='pointer';
    cell.addEventListener('click',()=>{
      typeFilter=cell.dataset.filter;tagFilter='';
      container.querySelectorAll('#m-stats .stat-cell').forEach(c=>c.classList.remove('active'));
      cell.classList.add('active');
      updateFilterActive();
      renderEntries();
    });
  });
  // 搜索
  container.querySelector('#m-search').addEventListener('input',function(){searchKw=this.value.trim();renderEntries();});
  container.querySelector('#m-search-clear').addEventListener('click',()=>{searchKw='';container.querySelector('#m-search').value='';renderEntries();});
  // FAB
  container.querySelector('#m-fab').addEventListener('click',()=>openModal());
  // Modal
  container.querySelector('#m-modal-cancel').addEventListener('click',()=>closeModal());
  container.querySelector('#m-modal').addEventListener('click',ev=>{if(ev.target.id==='m-modal')closeModal();});
  container.querySelector('#m-modal-save').addEventListener('click',()=>saveEntry());
}

function startListener(){
  const COL='memory_vault';
  setSyncStatus('syncing');
  onSnapshot(collection(db,COL),snap=>{
    allEntries=snap.docs.map(d=>({id:d.id,...d.data()}));
    allEntries.sort((a,b)=>((a.date||'')>(b.date||''))?-1:1);
    updateStats();
    renderFilterBar();
    renderEntries();
    setSyncStatus('connected');
  },err=>{
    console.error('Firestore error:',err);
    setSyncStatus('error');
  });
}

// ── 天气 ──
async function loadWeather(){
  try{
    const r=await fetch('https://wttr.in/Chengdu?format=j1');
    const d=await r.json();
    const c=d.current_condition[0];
    container.querySelector('#m-w-temp').textContent=c.temp_C+'°C';
    container.querySelector('#m-w-feels').textContent='体感 '+c.FeelsLikeC+'°C';
    container.querySelector('#m-w-desc').textContent=c.lang_zh?.[0]?.value||c.weatherDesc[0].value;
  }catch(e){}
}

// ── 同步状态 ──
function setSyncStatus(s){
  const dot=container.querySelector('#m-sync-dot'),text=container.querySelector('#m-sync-text');
  if(!dot)return;
  dot.className='sync-dot';
  if(s==='connected'){dot.classList.add('connected');text.textContent='已连接';}
  else if(s==='syncing'){dot.classList.add('syncing');text.textContent='同步中...';}
  else if(s==='error'){dot.classList.add('error');text.textContent='断开连接';}
  else{dot.classList.add('syncing');text.textContent='连接中...';}
}

// ── 统计 ──
function updateStats(){
  const el=id=>container.querySelector('#'+id);
  el('m-s-total').textContent=allEntries.length;
  el('m-s-diary').textContent=allEntries.filter(e=>e.type==='diary').length;
  el('m-s-summary').textContent=allEntries.filter(e=>e.type==='summary').length;
  el('m-s-pin').textContent=allEntries.filter(e=>e.pinNote).length;
  const now=new Date();
  el('m-top-meta').textContent='宿烬 与 宿青珩 · '+now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日';
}

// ── 筛选栏 ──
function renderFilterBar(){
  const bar=container.querySelector('#m-filter-bar');
  if(!bar.firstChild){
    [{label:'全部',val:''},{label:'日记',val:'diary'},{label:'总结',val:'summary'},{label:'📌 置顶',val:'pin'}].forEach(g=>{
      const btn=document.createElement('button');
      btn.className='filter-btn '+(g.val==='pin'?'pinned':g.val)+(typeFilter===g.val&&tagFilter===''?' active':'');
      btn.textContent=g.label;
      btn.dataset.type=g.val;
      btn.addEventListener('click',()=>{typeFilter=g.val;tagFilter='';updateFilterActive();renderEntries();});
      bar.appendChild(btn);
    });
  }
  // 标签按钮
  bar.querySelectorAll('button[data-tag],span.tag-sep').forEach(el=>el.remove());
  const tags={};
  allEntries.forEach(e=>(e.tags||[]).forEach(t=>{tags[t]=(tags[t]||0)+1}));
  if(Object.keys(tags).length>0){
    const sep=document.createElement('span');
    sep.className='tag-sep';
    sep.style.cssText='color:var(--border);margin:0 4px;font-size:12px;line-height:32px;';
    sep.textContent='|';
    bar.appendChild(sep);
    Object.keys(tags).sort().forEach(t=>{
      const btn=document.createElement('button');
      btn.className='tag-chip'+(tagFilter===t?' active':'');
      btn.textContent=t;
      btn.dataset.tag=t;
      btn.addEventListener('click',()=>{tagFilter=t;typeFilter='';updateFilterActive();renderEntries();});
      bar.appendChild(btn);
    });
  }
  updateFilterActive();
}

function updateFilterActive(){
  const bar=container.querySelector('#m-filter-bar');
  bar.querySelectorAll('button[data-type]').forEach(b=>{
    b.className='filter-btn '+(b.dataset.type==='pin'?'pinned':b.dataset.type)+(typeFilter===b.dataset.type&&tagFilter===''?' active':'');
  });
  bar.querySelectorAll('button[data-tag]').forEach(b=>{
    b.className='tag-chip'+(tagFilter===b.dataset.tag?' active':'');
  });
}

// ── 渲染列表 ──
function renderEntries(){
  const hasFilt=typeFilter||tagFilter||searchKw;
  const dualCol=container.querySelector('#m-dual-col');
  const singleList=container.querySelector('#m-entry-list');
  const diaryList=container.querySelector('#m-diary-list');
  const summaryList=container.querySelector('#m-summary-list');

  if(hasFilt){dualCol.style.display='none';singleList.style.display='';}
  else{dualCol.style.display='grid';singleList.style.display='none';}

  let entries=allEntries;
  if(typeFilter==='diary') entries=entries.filter(e=>e.type==='diary');
  else if(typeFilter==='summary') entries=entries.filter(e=>e.type==='summary');
  else if(typeFilter==='pin') entries=entries.filter(e=>!!e.pinNote);
  if(tagFilter) entries=entries.filter(e=>(e.tags||[]).includes(tagFilter));
  if(searchKw){
    const kw=searchKw.toLowerCase();
    entries=entries.filter(e=>
      (e.title||'').toLowerCase().includes(kw)
      ||(e.content||'').toLowerCase().includes(kw)
      ||(e.date||'').includes(kw)
      ||(e.tags||[]).some(t=>t.toLowerCase().includes(kw))
    );
  }

  if(hasFilt){
    singleList.innerHTML='';
    if(!entries.length){singleList.innerHTML='<div class="empty-state"><div class="empty-text">'+(searchKw?'没有找到匹配的记录':'暂无记录')+'</div></div>';return;}
    entries.forEach(e=>{const item=document.createElement('div');item.className='entry'+(e.type==='diary'?' diary':'')+(e.pinNote?' pinned-entry':'');buildEntryContent(e,item);singleList.appendChild(item);});
    return;
  }

  // 双栏
  diaryList.innerHTML='';summaryList.innerHTML='';
  const diaries=allEntries.filter(e=>e.type==='diary');
  const summaries=allEntries.filter(e=>e.type==='summary');
  if(!diaries.length) diaryList.innerHTML='<div class="empty-state"><div class="empty-text">暂无日记</div></div>';
  if(!summaries.length) summaryList.innerHTML='<div class="empty-state"><div class="empty-text">暂无总结</div></div>';
  diaries.forEach(e=>{const item=document.createElement('div');item.className='entry diary'+(e.pinNote?' pinned-entry':'');buildEntryContent(e,item);diaryList.appendChild(item);});
  summaries.forEach(e=>{const item=document.createElement('div');item.className='entry'+(e.pinNote?' pinned-entry':'');buildEntryContent(e,item);summaryList.appendChild(item);});
}

function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function buildEntryContent(e,item){
  // 操作按钮
  const actions=document.createElement('div');actions.className='entry-actions';
  const pinBtn=document.createElement('button');pinBtn.className='action-btn pin-btn'+(e.pinNote?' pinned':'');
  pinBtn.textContent=e.pinNote?'📌':'📍';pinBtn.title=e.pinNote?'取消置顶':'置顶';
  pinBtn.onclick=async()=>{if(!requireAuth())return;if(e.pinNote){await updateDoc(doc(db,'memory_vault',e.id),{pinNote:''});}else{const note=prompt('置顶备注（可留空）:','');if(note===null)return;await updateDoc(doc(db,'memory_vault',e.id),{pinNote:note||' '});}};
  actions.appendChild(pinBtn);
  const editBtn=document.createElement('button');editBtn.className='action-btn';editBtn.textContent='编辑';editBtn.onclick=()=>openModal(e.id);actions.appendChild(editBtn);
  const delBtn=document.createElement('button');delBtn.className='action-btn del';delBtn.textContent='删除';
  delBtn.onclick=async()=>{if(!confirm('确认删除这条记录？'))return;if(!requireAuth())return;await deleteDoc(doc(db,'memory_vault',e.id));};
  actions.appendChild(delBtn);
  item.appendChild(actions);

  // meta行
  const meta=document.createElement('div');meta.className='entry-meta';
  const typeLabel=document.createElement('span');typeLabel.className='entry-tag-label '+(e.type==='diary'?'diary':'summary');
  typeLabel.textContent=e.type==='diary'?'日记':'总结';meta.appendChild(typeLabel);
  const dateSpan=document.createElement('span');dateSpan.className='entry-date';dateSpan.textContent=e.date||'';meta.appendChild(dateSpan);
  if(e.pinNote&&e.pinNote.trim()){const pb=document.createElement('span');pb.className='pin-badge';pb.textContent='📌 '+e.pinNote.trim();meta.appendChild(pb);}
  (e.tags||[]).forEach(t=>{const tc=document.createElement('span');tc.className='custom-tag';tc.textContent=t;meta.appendChild(tc);});
  // 已读眼睛
  const eye=document.createElement('span');
  eye.className='read-eye'+(e.isRead?' read':'');
  eye.title=e.isRead?'已读':'点击标记已读';
  if(!e.isRead){
    eye.onclick=async()=>{
      if(!requireAuth())return;
      eye.classList.add('read');eye.onclick=null;eye.title='已读';
      await updateDoc(doc(db,'memory_vault',e.id),{isRead:true,read:true});
    };
  }
  meta.appendChild(eye);
  item.appendChild(meta);

  // 标题
  const title=document.createElement('div');title.className='entry-title';title.textContent=e.title||e.date||'';item.appendChild(title);

  // 正文预览+展开
  const preview=document.createElement('div');preview.className='entry-preview';preview.textContent=e.content||'';item.appendChild(preview);
  const fullContent=document.createElement('div');fullContent.className='entry-content-full';fullContent.textContent=e.content||'';item.appendChild(fullContent);
  const expandBtn=document.createElement('button');expandBtn.className='expand-btn';expandBtn.textContent='▸ 展开全文';
  let expanded=false;
  expandBtn.onclick=()=>{expanded=!expanded;if(expanded){fullContent.classList.add('open');preview.style.display='none';expandBtn.textContent='▾ 收起';}else{fullContent.classList.remove('open');preview.style.display='';expandBtn.textContent='▸ 展开全文';}};
  item.appendChild(expandBtn);

  // 回复区
  buildReplySection(e,item);
}

// ── 回复 ──
function buildReplySection(e,item){
  const section=document.createElement('div');section.className='reply-section';
  const renderReplies=()=>{
    while(section.firstChild)section.removeChild(section.firstChild);
    const replies=e.replies||[];
    if(!replies.length){const empty=document.createElement('div');empty.className='reply-empty';empty.textContent='还没有评论...';section.appendChild(empty);}
    else{
      replies.forEach((r,ri)=>{
        const rd=document.createElement('div');rd.className='reply-item'+(e.type==='diary'?' diary-reply':'');
        const rmeta=document.createElement('div');rmeta.className='reply-meta';rmeta.textContent=(r.author||'青珩')+' · '+(r.date||'');rd.appendChild(rmeta);
        const rc=document.createElement('div');rc.className='reply-content';rc.textContent=r.content||r.text||'';rd.appendChild(rc);
        const rdel=document.createElement('button');rdel.className='reply-del';rdel.textContent='×';
        rdel.onclick=async()=>{if(!confirm('确认删除？'))return;if(!requireAuth())return;const nr=(e.replies||[]).filter((_,i)=>i!==ri);await updateDoc(doc(db,'memory_vault',e.id),{replies:nr});e.replies=nr;renderReplies();};
        rd.appendChild(rdel);section.appendChild(rd);
      });
    }
    // 输入框
    const inputArea=document.createElement('div');inputArea.className='reply-input-area';
    const inp=document.createElement('textarea');inp.className='reply-input';inp.placeholder='写下你想说的话...';
    const acts=document.createElement('div');acts.className='reply-actions';
    const sendBtn=document.createElement('button');sendBtn.className='reply-btn submit';sendBtn.textContent='发送';
    sendBtn.onclick=async()=>{
      const txt=inp.value.trim();if(!txt)return;if(!requireAuth())return;
      const newReply={content:txt,author:'青珩',date:new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'})};
      const nr=[...(e.replies||[]),newReply];
      await updateDoc(doc(db,'memory_vault',e.id),{replies:nr});
      e.replies=nr;inp.value='';renderReplies();
    };
    inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();sendBtn.click();}});
    acts.appendChild(sendBtn);inputArea.appendChild(inp);inputArea.appendChild(acts);section.appendChild(inputArea);
  };
  renderReplies();
  item.appendChild(section);
}

// ── Modal ──
function openModal(id){
  if(!requireAuth())return;
  const modal=container.querySelector('#m-modal');
  if(id){
    const e=allEntries.find(x=>x.id===id);if(!e)return;
    editId=id;
    container.querySelector('#m-modal-title').textContent='· 编辑记录 ·';
    container.querySelector('#m-entry-type').value=e.type||'diary';
    container.querySelector('#m-entry-date').value=(e.date||'').replace(' ','T').slice(0,16);
    container.querySelector('#m-entry-title').value=e.title||'';
    container.querySelector('#m-entry-content').value=e.content||'';
    container.querySelector('#m-entry-tags').value=(e.tags||[]).join(', ');
    container.querySelector('#m-entry-pin').value=e.pinNote||'';
  }else{
    editId=null;
    container.querySelector('#m-modal-title').textContent='· 新增记录 ·';
    container.querySelector('#m-entry-type').value='diary';
    const now=new Date();const pad=n=>String(n).padStart(2,'0');
    container.querySelector('#m-entry-date').value=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    container.querySelector('#m-entry-title').value='';
    container.querySelector('#m-entry-content').value='';
    container.querySelector('#m-entry-tags').value='';
    container.querySelector('#m-entry-pin').value='';
  }
  modal.classList.add('open');
}
function closeModal(){container.querySelector('#m-modal').classList.remove('open');}

async function saveEntry(){
  const type=container.querySelector('#m-entry-type').value;
  const date=container.querySelector('#m-entry-date').value.replace('T',' ').slice(0,16);
  const title=container.querySelector('#m-entry-title').value.trim();
  const content=container.querySelector('#m-entry-content').value.trim();
  const tags=container.querySelector('#m-entry-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const pinNote=container.querySelector('#m-entry-pin').value.trim();
  if(!date||!content)return alert('日期和内容不能为空');
  const data={type,date,content,tags,pinNote,title:title||(type==='diary'?date+'日记':date+'总结'),updatedAt:new Date().toISOString()};
  if(editId){await updateDoc(doc(db,'memory_vault',editId),data);}
  else{data.createdAt=new Date().toISOString();data.replies=[];data.isRead=false;data.read=false;await addDoc(collection(db,'memory_vault'),data);}
  closeModal();
}

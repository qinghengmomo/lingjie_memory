// ═══════════════════════════════════════════
// 廿廿 · 我们的墙 · wall.js
// 负责：便利贴渲染、发布、点击大图、Firestore CRUD
// ═══════════════════════════════════════════

const FIREBASE_PROJECT_ID = 'lingjie-f84c1';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const WALL_COLLECTION = 'wall_posts';
const WALL_API = `${FIRESTORE_BASE_URL}/${WALL_COLLECTION}`;

let posts = [];
let currentUser = null;

export function init(container, ctx) {
  if (ctx && ctx.auth) {
    const u = ctx.auth.currentUser;
    currentUser = u ? { uid: u.uid, displayName: u.email, role: 'qingheng' } : null;
  }
  bindEvents();
  loadPosts();
}

export function onAuthChange(user) {
  currentUser = user ? { uid: user.uid, displayName: user.email, role: 'qingheng' } : null;
}

async function loadPosts() {
  const grid = document.getElementById('wall-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="wall-loading">加载中…</div>';
  try {
    let token = null;
    try { const auth = (await import('../app.js')).auth; if (auth.currentUser) token = await auth.currentUser.getIdToken(); } catch(e) {}
    const url = `${WALL_API}?pageSize=100`;
    const resp = await fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await resp.json();
    posts = (data.documents || []).map(parseDoc).sort((a, b) => b.created_at - a.created_at);
    renderPosts();
  } catch (e) {
    grid.innerHTML = '<div class="wall-loading">连接失败，请检查网络</div>';
    console.error('[wall] loadPosts error:', e);
  }
}

function parseDoc(doc) {
  const f = doc.fields || {};
  const id = doc.name ? doc.name.split('/').pop() : '';
  return {
    id,
    content:     f.content?.stringValue || '',
    image_url:   f.image_url?.stringValue || '',
    image_b64:   f.image_b64?.stringValue || '',
    mood_tag:    f.mood_tag?.stringValue || '',
    author:      f.author?.stringValue || 'qingheng',
    author_name: f.author_name?.stringValue || '',
    created_at:  f.created_at?.integerValue ? Number(f.created_at.integerValue) : 0,
    date_str:    f.date_str?.stringValue || '',
  };
}

function renderPosts() {
  const grid = document.getElementById('wall-grid');
  if (!grid) return;
  if (posts.length === 0) {
    grid.innerHTML = '<div class="wall-empty">这面墙还是空的<br><span>点右上角的 + 贴上第一张</span></div>';
    return;
  }
  grid.innerHTML = posts.map(p => {
    const hasImg = p.image_url || p.image_b64;
    const imgSrc = p.image_url || (p.image_b64 ? `data:image/png;base64,${p.image_b64}` : '');
    const noteClass = hasImg ? (p.content ? 'note' : 'note full-img') : 'note text-only';
    const authorLabel = p.author === 'sujin' ? '先生' : '阿珩';
    const authorClass = p.author === 'sujin' ? 'author-sujin' : 'author-qingheng';
    return `
      <div class="${noteClass}" data-id="${p.id}">
        ${hasImg ? `<img src="${imgSrc}" alt="" loading="lazy" class="note-img">` : ''}
        ${p.content ? `<div class="caption">${escapeHtml(p.content)}</div>` : ''}
        <div class="meta">
          <span class="meta-left">
            <span class="${authorClass}">${authorLabel}</span>
            <span class="meta-date">${p.date_str || formatDate(p.created_at)}</span>
          </span>
          <span class="meta-right">
            ${p.mood_tag ? `<span class="mood-tag">${escapeHtml(p.mood_tag)}</span>` : ''}
            <span class="note-del" data-del-id="${p.id}">×</span>
          </span>
        </div>
      </div>
    `;
  }).join('');
  grid.querySelectorAll('.note-img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
  grid.querySelectorAll('.note-del').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deletePost(btn.dataset.delId); });
  });
}

function openLightbox(src) {
  const overlay = document.getElementById('wall-lightbox');
  const img = document.getElementById('lightbox-img');
  if (!overlay || !img) return;
  img.src = src;
  overlay.classList.add('open');
}
function closeLightbox() {
  const overlay = document.getElementById('wall-lightbox');
  if (!overlay) return;
  overlay.classList.remove('open');
}

async function submitPost() {
  const textarea = document.getElementById('wall-textarea');
  const fileInput = document.getElementById('wall-file-input');
  const moodInput = document.getElementById('wall-mood-input');
  if (!textarea) return;
  const content = textarea.value.trim();
  const mood = moodInput ? moodInput.value.trim() : '';
  let image_b64 = '';
  if (fileInput && fileInput.files && fileInput.files[0]) {
    image_b64 = await fileToBase64(fileInput.files[0]);
  }
  if (!content && !image_b64) { alert('至少写点什么，或者贴一张图'); return; }
  const now = Date.now();
  const role = currentUser?.role || 'qingheng';
  const authorName = role === 'sujin' ? '宿烬' : '青珩';
  const body = {
    fields: {
      content: { stringValue: content },
      image_b64: { stringValue: image_b64 },
      image_url: { stringValue: '' },
      mood_tag: { stringValue: mood },
      author: { stringValue: role },
      author_name: { stringValue: authorName },
      created_at: { integerValue: String(now) },
      date_str: { stringValue: formatDate(now) },
    }
  };
  try {
    let token = null;
    try { const auth = (await import('../app.js')).auth; if (auth.currentUser) token = await auth.currentUser.getIdToken(); } catch(e) {}
    const resp = await fetch(WALL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    closeModal();
    textarea.value = '';
    if (moodInput) moodInput.value = '';
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('wall-img-preview');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    await loadPosts();
  } catch (e) {
    alert('发布失败：' + e.message);
    console.error('[wall] submitPost error:', e);
  }
}


async function deletePost(docId) {
  if (!confirm('确定要删掉这张吗？')) return;
  try {
    let token = null;
    try { const auth = (await import('../app.js')).auth; if (auth.currentUser) token = await auth.currentUser.getIdToken(); } catch(e) {}
    const url = `${WALL_API}/${docId}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await loadPosts();
  } catch (e) {
    alert('删除失败：' + e.message);
    console.error('[wall] deletePost error:', e);
  }
}

function openModal() { const m = document.getElementById('wall-modal'); if (m) m.classList.add('open'); }
function closeModal() { const m = document.getElementById('wall-modal'); if (m) m.classList.remove('open'); }

function bindEvents() {
  document.getElementById('wall-btn-post')?.addEventListener('click', openModal);
  document.getElementById('wall-btn-cancel')?.addEventListener('click', closeModal);
  document.getElementById('wall-btn-submit')?.addEventListener('click', submitPost);
  const modal = document.getElementById('wall-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  const lightbox = document.getElementById('wall-lightbox');
  if (lightbox) lightbox.addEventListener('click', closeLightbox);
  const fileInput = document.getElementById('wall-file-input');
  const uploadArea = document.getElementById('wall-upload-area');
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = document.getElementById('wall-img-preview');
          if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    });
  }
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'string' ? Number(ts) : ts);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result.split(',')[1]) || reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

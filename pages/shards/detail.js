// 碎片馆 · 详情卡片渲染
// 单一职责：把 candle_echo 的纯文本 content 渲染为段落化 HTML
// 自动处理：\n / \n\n / 多段空行；首尾空白；HTML 转义

function esc(t) {
  return (t == null ? '' : String(t))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 把纯文本拆段：
 * - \n\n 或更多 → 段落分隔
 * - 单 \n → 段内换行
 * 兼容数据库里只用 \n 的情况：
 *   如果整段没有 \n\n，就退化到按 \n 分段
 */
function splitParagraphs(text) {
  const t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  if (/\n\s*\n/.test(t)) {
    return t.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  }
  // 没有空行 → 按单 \n 分段（避免一坨连排）
  return t.split(/\n+/).map(s => s.trim()).filter(Boolean);
}

/**
 * 把 shard 详情写进遮罩
 * @param {HTMLElement} container - 页面容器（#page-shards）
 * @param {{no,title,time,body}} s
 */
export function showDetail(container, s) {
  const mask = container.querySelector('#shards-mask');
  const head = container.querySelector('#shards-dh');
  const titleEl = container.querySelector('#shards-dt');
  const bodyEl = container.querySelector('#shards-db');
  if (!mask || !bodyEl) return;

  if (head) head.textContent = s.time || '';
  if (titleEl) titleEl.textContent = s.title || '';

  const paras = splitParagraphs(s.body);
  bodyEl.innerHTML = paras.map(p => '<p>' + esc(p) + '</p>').join('');

  mask.classList.add('show');

  const closeBtn = container.querySelector('#shards-close');
  const closeFn = () => { mask.classList.remove('show'); };
  if (closeBtn) closeBtn.onclick = closeFn;
  mask.onclick = (e) => { if (e.target === mask) closeFn(); };
}

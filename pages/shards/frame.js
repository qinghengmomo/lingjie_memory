// 碎片馆 · 单个相框 DOM 工厂
// 单一职责：根据 shard 数据生成一个相框节点（含 rope/corner 装饰）
// 不处理事件、不处理样式动画——交给 index.js 串联

function esc(t) {
  return (t == null ? '' : String(t))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 创建一个相框节点
 * @param {{no,title,time,body}} s
 * @param {number} idx 在数组里的下标（用于跟星轨索引联动）
 * @returns {HTMLElement}
 */
export function createFrame(s, idx) {
  const f = document.createElement('div');
  f.className = 'shards-frame';
  f.dataset.idx = idx;
  f.innerHTML = [
    '<div class="rope"></div>',
    '<div class="corner tl"></div><div class="corner tr"></div>',
    '<div class="corner bl"></div><div class="corner br"></div>',
    '<div class="outer"></div>',
    '<div class="inner"><div class="shards-shard"></div></div>',
    '<div class="shards-plate"><span class="num">' + esc(s.no) + '</span>' + esc(s.title) + '</div>'
  ].join('');
  return f;
}

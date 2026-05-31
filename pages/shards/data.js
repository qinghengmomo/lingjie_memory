// 碎片馆 · 数据层
// 单一职责：订阅 Firestore candle_echo，输出 ShardView[] 给上层渲染
//
// candle_echo schema (lingjie_shard 沙盒包定义)：
//   id          'shard_01' 'shard_02' ...
//   time_coord  '星际298年 · 9岁'
//   drop_time   写入时间
//   content     正文
//   tags        ['盲盒','灵界碎片',...]

import { db } from '../../app.js';
import {
  collection, query, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let unsubscribe = null;

/**
 * 把 Firestore 文档转成统一视图模型
 */
function toView(d, raw) {
  const idStr = raw.id || d.id || '';
  const m = idStr.match(/(\d+)/);
  const no = '#' + (m ? m[1].padStart(3, '0') : '???');

  const content = String(raw.content || '').trim();
  let title = content.split(/\r?\n/)[0].replace(/^[#·\s]+/, '').trim();
  if (!title) title = '无题碎片';
  if (title.length > 18) title = title.slice(0, 18) + '…';

  return {
    no,
    title,
    time: raw.time_coord || raw.drop_time || '',
    body: content
  };
}

function sortShards(arr) {
  return arr.slice().sort((a, b) => {
    const na = parseInt((a._id || '').replace(/^\D+/, ''), 10) || 0;
    const nb = parseInt((b._id || '').replace(/^\D+/, ''), 10) || 0;
    return na - nb;
  });
}

/**
 * 启动订阅
 * @param {(shards:Array)=>void} onUpdate 数据更新回调
 * @param {(err:Error)=>void} onError 出错回调
 */
export function subscribe(onUpdate, onError) {
  if (unsubscribe) return;
  try {
    const q = query(collection(db, 'candle_echo'));
    unsubscribe = onSnapshot(q, (snap) => {
      const raws = [];
      snap.docs.forEach(d => {
        const data = d.data();
        raws.push({ _id: data.id || d.id, ...data });
      });
      const sorted = sortShards(raws);
      const views = sorted.map(r => toView({ id: r._id }, r));
      onUpdate(views);
    }, (err) => {
      console.error('[shards/data] snapshot error', err);
      if (onError) onError(err);
    });
  } catch (e) {
    console.error('[shards/data] subscribe failed', e);
    if (onError) onError(e);
  }
}

export function unsubscribeAll() {
  if (unsubscribe) {
    try { unsubscribe(); } catch (e) {}
    unsubscribe = null;
  }
}

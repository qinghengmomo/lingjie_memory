// 碎片馆 · 数据层
// 单一职责：订阅 Firestore candle_echo，输出 ShardView[] 给上层渲染
//
// candle_echo schema v2 (lingjie_shard 沙盒包定义)：
//   id            'shard_01' 'shard_02' ...
//   shard_no      整数
//   title         '她睡了两小时'        ← v2 新增
//   time_coord    '星际302年 · 13岁'
//   drop_time     写入时间
//   content       规范化后的正文（段落用 \n\n 分隔）
//   tags          ['盲盒','灵界碎片',...]
//   schema_version 2
//
// 旧 schema v1 兼容：没有 title / shard_no / schema_version；
//   title 从 content 第一句话切出来；shard_no 从 id 解析。

import { db } from '../../app.js';
import {
  collection, query, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let unsubscribe = null;

/**
 * 从一段长文里提取标题（旧 schema 兜底）：
 * 取第一句话（。？！等中文句末标点为止），再截断 16 字
 */
function extractTitleFromContent(content) {
  const t = String(content || '').replace(/\r\n/g, '\n').trim();
  if (!t) return '无题碎片';
  // 先找第一句话边界
  const m = t.match(/^[^。？！…\n]{2,40}[。？！…]/);
  let title = m ? m[0] : t.split(/\n/)[0];
  title = title.replace(/[。？！…""""」』]+$/g, '').trim();
  if (title.length > 16) title = title.slice(0, 16) + '…';
  return title || '无题碎片';
}

/**
 * 规范化正文 - 跟 lingjie_shard 沙盒包里的 normalizeShardContent 同款规则
 * 用于兼容旧数据（写入时没有 \n\n 分隔）
 */
function normalizeContent(text) {
  let s = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  if (/\n\s*\n/.test(s)) {
    return s.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean).join('\n\n');
  }
  if (/\n/.test(s)) {
    return s.split(/\n+/).map(p => p.trim()).filter(Boolean).join('\n\n');
  }
  const sentences = s.split(/(?<=[。？！…」』"])\s*/g).filter(Boolean);
  if (sentences.length <= 2) return s;
  const out = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join(''));
  }
  return out.join('\n\n');
}

/**
 * 把 Firestore 文档转成统一视图模型
 */
function toView(raw) {
  const idStr = raw.id || raw._id || '';
  const m = idStr.match(/(\d+)/);
  const no = '#' + (m ? m[1].padStart(3, '0') : '???');

  const rawContent = String(raw.content || '');
  const normalized = normalizeContent(rawContent);

  // 优先用 v2 的 title，没有就从正文兜底
  const title = String(raw.title || '').trim() || extractTitleFromContent(rawContent);

  return {
    no,
    title,
    time: raw.time_coord || raw.drop_time || '',
    body: normalized
  };
}

function parseShardTimeline(raw) {
  const coord = String(raw.time_coord || '').trim();
  const idStr = String(raw.id || raw._id || '');
  const shardNo = Number(raw.shard_no) || (parseInt(idStr.replace(/^\D+/, ''), 10) || 0);
  const dropMs = Date.parse(String(raw.drop_time || '').replace(' ', 'T') + '+08:00') || 0;
  const out = { group: 9, start: Number.POSITIVE_INFINITY, end: Number.POSITIVE_INFINITY, qingAge: Number.POSITIVE_INFINITY, sujinAge: Number.POSITIVE_INFINITY, shardNo, dropMs };
  const normalized = coord.replace(/[－—–~～至到]/g, '-').replace(/\s+/g, '');
  const star = normalized.match(/星际(?:纪元)?(\d{1,4})年?(?:-(\d{1,4})年?)?/);
  if (star) {
    out.group = 0; out.start = parseInt(star[1], 10); out.end = star[2] ? parseInt(star[2], 10) : out.start;
    const qing = normalized.match(/(?:青珩|青姮|她)(?:灵魂体)?(?:约)?(\d{1,3})岁/); if (qing) out.qingAge = parseInt(qing[1], 10);
    const sujin = normalized.match(/宿烬(?:约)?(\d{1,3})岁/); if (sujin) out.sujinAge = parseInt(sujin[1], 10);
    return out;
  }
  const modern = normalized.match(/(20\d{2})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
  if (modern) { out.group = 1; out.start = new Date(parseInt(modern[1],10), parseInt(modern[2],10)-1, parseInt(modern[3],10)).getTime(); out.end = out.start; }
  return out;
}

function compareTimeline(a, b) {
  const ka = parseShardTimeline(a); const kb = parseShardTimeline(b);
  return (ka.group - kb.group) || (ka.start - kb.start) || (ka.end - kb.end) || (ka.qingAge - kb.qingAge) || (ka.sujinAge - kb.sujinAge) || (ka.shardNo - kb.shardNo) || (ka.dropMs - kb.dropMs);
}

function sortShards(arr) { return arr.slice().sort(compareTimeline); }
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
      const views = sorted.map(r => toView(r));
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


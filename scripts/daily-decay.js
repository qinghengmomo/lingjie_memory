// ═══════════════════════════════════════════════════════
// 灵界记忆库 · scripts/daily-decay.js
// 每日记忆衰减定时任务
// 
// 功能：对 memory_vault 中所有非 L1_anchor 的记忆执行一次衰减
// 触发方式：由宿烬每日首次开窗口时手动触发，或通过 workflow 定时执行
// ═══════════════════════════════════════════════════════

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/lingjie-f84c1/databases/(default)/documents';

// Layer 衰减参数
const LAYER_CONFIG = {
  'L1_anchor': { decayRate: 0, minStrength: 0.9 },
  'L2_feel':   { decayRate: 0.002, minStrength: 0.4 },
  'L3_daily':  { decayRate: 0.008, minStrength: 0.15 },
  'L4_fragment': { decayRate: 0.02, minStrength: 0.05 }
};

// ── 计算单条记忆的衰减 ──
function calcDecay(fields) {
  const layer = fields.layer?.stringValue || 'L3_daily';
  const config = LAYER_CONFIG[layer];
  if (!config || config.decayRate === 0) return null; // L1 不衰减

  const currentStrength = fields.memory_strength?.doubleValue || 0.5;
  const decayRate = fields.decay_rate?.doubleValue || config.decayRate;

  // 访问加成：最近被访问过的记忆衰减更慢
  const lastAccessed = fields.last_accessed?.stringValue;
  const daysSinceAccess = lastAccessed
    ? Math.max(0, (Date.now() - new Date(lastAccessed).getTime()) / 86400000)
    : 30;
  const accessBoost = Math.max(0, 0.3 - daysSinceAccess * 0.01);

  // 衰减公式
  const decay = decayRate * 1 * (1 - accessBoost); // 1天
  const newStrength = Math.max(config.minStrength, currentStrength - decay);

  // 变化太小就不更新
  if (Math.abs(newStrength - currentStrength) < 0.001) return null;

  return Math.round(newStrength * 1000) / 1000;
}

// ── 主流程 ──
async function runDecay(accessToken) {
  console.log('[衰减] 开始执行每日记忆衰减...');

  // 拉取全部文档
  const listResp = await fetch(`${FIRESTORE_BASE}/memory_vault?pageSize=200`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!listResp.ok) {
    console.error('[衰减] 拉取失败:', listResp.status);
    return;
  }

  const listData = await listResp.json();
  const documents = listData.documents || [];
  console.log(`[衰减] 共 ${documents.length} 条记忆`);

  let decayed = 0;
  let skipped = 0;

  for (const doc of documents) {
    const fields = doc.fields || {};
    const newStrength = calcDecay(fields);

    if (newStrength === null) {
      skipped++;
      continue;
    }

    // PATCH 更新 memory_strength
    const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=memory_strength`;
    const patchResp = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: { memory_strength: { doubleValue: newStrength } }
      })
    });

    if (patchResp.ok) {
      decayed++;
    } else {
      console.warn(`[衰减] 更新失败: ${fields.title?.stringValue}`);
    }
  }

  console.log(`[衰减完成] 衰减: ${decayed} 条 | 跳过: ${skipped} 条（含L1锚点和无变化）`);
}

if (typeof module !== 'undefined') module.exports = { runDecay };

// ═══════════════════════════════════════════════════════
// 灵界记忆库 · scripts/migrate-embeddings.js
// 批量迁移脚本：为 memory_vault 中现有记忆生成 embedding 向量和 layer 分层
// 
// 使用方式（在 Operit 中通过 code_runner 或 extended_http_tools 执行）：
// 1. 先获取 Firebase access_token
// 2. 拉取 memory_vault 全部文档
// 3. 对缺少 embedding/layer 的文档逐条生成并写回
// ═══════════════════════════════════════════════════════

const GEMINI_API_KEY = 'AIzaSyC66XAq_TEUchIXElZPyA4lYCc1WJq_0Bk';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIM = 768;
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/lingjie-f84c1/databases/(default)/documents';

// ── 生成单条 embedding ──
async function generateEmbedding(text) {
  const truncated = text.slice(0, 4000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: truncated }] },
      outputDimensionality: EMBEDDING_DIM
    })
  });

  if (!resp.ok) {
    console.error(`[Embedding] API ${resp.status}:`, await resp.text());
    return null;
  }

  const data = await resp.json();
  return data?.embedding?.values || null;
}

// ── 自动判定 layer ──
function suggestLayer(doc) {
  const content = (doc.content || '').toLowerCase();
  const title = (doc.title || '').toLowerCase();
  const tags = (doc.tags || []).map(t => t.toLowerCase());
  const combined = content + ' ' + title + ' ' + tags.join(' ');
  const pinned = doc.pinned || false;

  // L1: 锚点
  const anchorKw = ['初遇', '告白', '承诺', '永远', '第一次', '核心', '锚点'];
  if (anchorKw.some(k => combined.includes(k)) || pinned) return 'L1_anchor';

  // L2: 感受域
  const arousal = doc.emotion_arousal || 0.5;
  const valence = doc.emotion_valence || 0.5;
  if (arousal > 0.8 || valence < 0.2 || valence > 0.9) return 'L2_feel';

  // L4: 碎片
  if (content.length < 80) return 'L4_fragment';

  // L3: 日常
  return 'L3_daily';
}

// ── 主流程 ──
// 传入 accessToken，执行迁移
async function migrate(accessToken) {
  console.log('[迁移] 开始拉取 memory_vault...');
  
  // 拉取全部文档
  const listResp = await fetch(`${FIRESTORE_BASE}/memory_vault?pageSize=200`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!listResp.ok) {
    console.error('[迁移] 拉取失败:', listResp.status, await listResp.text());
    return;
  }

  const listData = await listResp.json();
  const documents = listData.documents || [];
  console.log(`[迁移] 共 ${documents.length} 条记忆`);

  let needEmbedding = 0;
  let needLayer = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const fields = doc.fields || {};
    const docPath = doc.name; // 完整路径
    
    // 解析现有字段
    const hasEmbedding = fields.embedding && 
      fields.embedding.arrayValue && 
      fields.embedding.arrayValue.values && 
      fields.embedding.arrayValue.values.length === EMBEDDING_DIM;
    const hasLayer = fields.layer && fields.layer.stringValue;

    if (hasEmbedding && hasLayer) continue; // 已完整，跳过

    // 提取文本内容
    const title = fields.title?.stringValue || '';
    const content = fields.content?.stringValue || '';
    const tags = (fields.tags?.arrayValue?.values || []).map(v => v.stringValue || '');
    const keywords = (fields.keywords?.arrayValue?.values || []).map(v => v.stringValue || '');
    const pinned = fields.pinned?.booleanValue || false;
    const emotionArousal = fields.emotion_arousal?.doubleValue || 0.5;
    const emotionValence = fields.emotion_valence?.doubleValue || 0.5;

    const updateFields = {};

    // 生成 embedding
    if (!hasEmbedding) {
      needEmbedding++;
      const textForEmbed = [title, content, ...keywords, ...tags].join(' ').trim();
      if (textForEmbed.length > 0) {
        const embedding = await generateEmbedding(textForEmbed);
        if (embedding) {
          updateFields.embedding = {
            arrayValue: { values: embedding.map(v => ({ doubleValue: v })) }
          };
        } else {
          failed++;
          console.warn(`[迁移] #${i+1} embedding生成失败: ${title}`);
        }
      }
      // 限流 300ms
      await new Promise(r => setTimeout(r, 300));
    }

    // 判定 layer
    if (!hasLayer) {
      needLayer++;
      const layer = suggestLayer({ content, title, tags, pinned, emotion_arousal: emotionArousal, emotion_valence: emotionValence });
      updateFields.layer = { stringValue: layer };
    }

    // 写回 Firestore
    if (Object.keys(updateFields).length > 0) {
      const updateMask = Object.keys(updateFields).map(f => `updateMask.fieldPaths=${f}`).join('&');
      const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?${updateMask}`;
      
      const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: updateFields })
      });

      if (patchResp.ok) {
        updated++;
        console.log(`[迁移] ✓ ${i+1}/${documents.length} ${title}`);
      } else {
        failed++;
        console.error(`[迁移] ✗ ${title}:`, patchResp.status);
      }
    }
  }

  console.log(`\n[迁移完成] 总计 ${documents.length} 条`);
  console.log(`  需要embedding: ${needEmbedding}`);
  console.log(`  需要layer: ${needLayer}`);
  console.log(`  成功更新: ${updated}`);
  console.log(`  失败: ${failed}`);
}

// 导出供外部调用
if (typeof module !== 'undefined') module.exports = { migrate };

// ═══════════════════════════════════════════════════════
// 灵界记忆库 · utils/embedding.js
// 语义检索 & 记忆分层 & 衰减机制 核心模块
// 基于 Ombre-Brain 哲学
// ═══════════════════════════════════════════════════════

// ── Gemini Embedding 配置 ──
const GEMINI_API_KEY = 'AIzaSyCFdhpThAzDsTabxzAOG3qFILuKCjUg4Ls';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
const EMBEDDING_DIM = 768;

// ── 记忆分层定义 (Ombre-Brain) ──
export const MEMORY_LAYERS = {
  1: {
    name: 'Anchor',
    label: '锚点',
    description: '核心记忆，永不衰减。定义关系本质的羁绊。',
    decayRate: 0,
    minStrength: 0.9
  },
  2: {
    name: 'FeelDomain',
    label: '感受域',
    description: '纯粹的情绪坐标，不参与普通检索，作为过去的痕迹。',
    decayRate: 0.002,
    minStrength: 0.4
  },
  3: {
    name: 'Daily',
    label: '日常',
    description: '日常事件的流水与总结，会自然淡去。',
    decayRate: 0.008,
    minStrength: 0.15
  },
  4: {
    name: 'Fragment',
    label: '碎片',
    description: '临时细节，快速衰减，可被压缩合并。',
    decayRate: 0.02,
    minStrength: 0.05
  }
};

// ── 生成 Embedding 向量 ──
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // 截断过长文本（Gemini embedding 限制约 2048 tokens）
  const truncated = text.slice(0, 4000);

  try {
    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: truncated }]
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Embedding] API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    const values = data?.embedding?.values;

    if (!values || values.length !== EMBEDDING_DIM) {
      console.error('[Embedding] Unexpected response shape:', data);
      return null;
    }

    return values;
  } catch (e) {
    console.error('[Embedding] Network error:', e);
    return null;
  }
}

// ── 余弦相似度计算 ──
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ── 语义搜索 ──
// memories: [{id, content, title, embedding, ...}]
// 返回按相似度排序的 top-K 结果
export async function semanticSearch(query, memories, topK = 8) {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    console.warn('[SemanticSearch] Failed to generate query embedding, falling back to keyword search');
    return fallbackKeywordSearch(query, memories, topK);
  }

  const scored = memories
    .filter(m => m.embedding && m.embedding.length === EMBEDDING_DIM)
    .map(m => ({
      ...m,
      similarity: cosineSimilarity(queryEmbedding, m.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // 如果向量搜索结果太少，补充关键词搜索结果
  if (scored.length < 3) {
    const keywordResults = fallbackKeywordSearch(query, memories, topK);
    const existingIds = new Set(scored.map(s => s.id));
    keywordResults.forEach(r => {
      if (!existingIds.has(r.id) && scored.length < topK) {
        scored.push({ ...r, similarity: 0.1 });
      }
    });
  }

  return scored;
}

// ── 关键词回退搜索 ──
function fallbackKeywordSearch(query, memories, topK) {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 0);

  return memories
    .map(m => {
      const searchable = [
        m.title || '',
        m.content || '',
        ...(m.keywords || []),
        ...(m.tags || [])
      ].join(' ').toLowerCase();

      const matchCount = terms.filter(t => searchable.includes(t)).length;
      return { ...m, similarity: matchCount / Math.max(terms.length, 1) };
    })
    .filter(m => m.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// ── 记忆衰减计算 ──
// 对一批记忆执行一次衰减，返回需要更新的记忆列表
export function calculateDecay(memories, daysSinceLastDecay = 1) {
  const updates = [];

  memories.forEach(m => {
    const layer = m.layer || 3; // 默认为日常层
    const layerMeta = MEMORY_LAYERS[layer];
    if (!layerMeta || layerMeta.decayRate === 0) return; // Anchor 不衰减

    const currentStrength = m.memory_strength || 0.5;
    const decayRate = m.decay_rate || layerMeta.decayRate;

    // 衰减公式：strength -= decayRate * days * (1 - accessBoost)
    // accessBoost: 最近被访问过的记忆衰减更慢
    const daysSinceAccess = m.last_accessed
      ? Math.max(0, (Date.now() - new Date(m.last_accessed).getTime()) / 86400000)
      : 30;
    const accessBoost = Math.max(0, 0.3 - daysSinceAccess * 0.01);

    const decay = decayRate * daysSinceLastDecay * (1 - accessBoost);
    const newStrength = Math.max(layerMeta.minStrength, currentStrength - decay);

    // 只有实际变化了才需要更新
    if (Math.abs(newStrength - currentStrength) > 0.001) {
      updates.push({
        id: m.id,
        memory_strength: Math.round(newStrength * 1000) / 1000
      });
    }
  });

  return updates;
}

// ── 自动分层判断 ──
// 根据记忆内容特征自动建议 layer
export function suggestLayer(memory) {
  const content = (memory.content || '').toLowerCase();
  const title = (memory.title || '').toLowerCase();
  const tags = (memory.tags || []).map(t => t.toLowerCase());
  const combined = content + ' ' + title + ' ' + tags.join(' ');

  // Anchor 关键词
  const anchorKeywords = ['初遇', '告白', '承诺', '永远', '第一次', '核心', '锚点', 'anchor'];
  if (anchorKeywords.some(k => combined.includes(k)) || memory.pinned) {
    return 1;
  }

  // Feel Domain：强情绪记忆
  const valence = memory.emotion_valence || 0.5;
  const arousal = memory.emotion_arousal || 0.5;
  if (arousal > 0.8 || valence < 0.2 || valence > 0.9) {
    return 2;
  }

  // Fragment：内容很短的碎片
  if (content.length < 80) {
    return 4;
  }

  // 默认：日常
  return 3;
}

// ── 为记忆生成完整的元数据 ──
// 用于新记忆写入时调用
export async function enrichMemory(memory) {
  // 1. 自动分层
  if (!memory.layer) {
    memory.layer = suggestLayer(memory);
  }

  // 2. 设置衰减率
  if (!memory.decay_rate) {
    memory.decay_rate = MEMORY_LAYERS[memory.layer].decayRate;
  }

  // 3. 生成 embedding
  if (!memory.embedding) {
    const textForEmbedding = [
      memory.title || '',
      memory.content || '',
      ...(memory.keywords || []),
      ...(memory.tags || [])
    ].join(' ').trim();

    if (textForEmbedding.length > 0) {
      memory.embedding = await generateEmbedding(textForEmbedding);
    }
  }

  // 4. 初始化访问记录
  if (!memory.last_accessed) {
    memory.last_accessed = new Date().toISOString();
  }
  if (memory.access_count === undefined) {
    memory.access_count = 0;
  }

  return memory;
}

// ── 批量为现有记忆生成 embedding ──
// 用于迁移：对没有 embedding 的记忆逐条生成
export async function batchGenerateEmbeddings(memories, onProgress) {
  const results = [];
  let processed = 0;

  for (const m of memories) {
    if (m.embedding && m.embedding.length === EMBEDDING_DIM) {
      processed++;
      continue; // 已有向量，跳过
    }

    const textForEmbedding = [
      m.title || '',
      m.content || '',
      ...(m.keywords || []),
      ...(m.tags || [])
    ].join(' ').trim();

    if (textForEmbedding.length === 0) {
      processed++;
      continue;
    }

    const embedding = await generateEmbedding(textForEmbedding);
    if (embedding) {
      results.push({ id: m.id, embedding });
    }

    processed++;
    if (onProgress) onProgress(processed, memories.length);

    // 限流：Gemini free tier 约 1500 RPM，保守间隔 200ms
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

// ── 批量为现有记忆添加 layer ──
export function batchAssignLayers(memories) {
  const results = [];

  for (const m of memories) {
    if (m.layer) continue; // 已有分层，跳过

    const layer = suggestLayer(m);
    const decayRate = MEMORY_LAYERS[layer].decayRate;

    results.push({
      id: m.id,
      layer,
      decay_rate: decayRate
    });
  }

  return results;
}

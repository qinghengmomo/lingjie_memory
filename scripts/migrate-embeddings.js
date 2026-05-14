/**
 * 灵界记忆库 · 批量迁移脚本
 * 为 memory_vault 中现有记忆生成 embedding 向量和 layer 分层
 * 
 * 使用方式：
 *   1. 确保电脑能访问 Google API（开梯子）
 *   2. 在终端执行：node scripts/migrate-embeddings.js
 *   3. 等待跑完即可
 */

const GEMINI_KEY = 'AIzaSyC66XAq_TEUchIXElZPyA4lYCc1WJq_0Bk';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/lingjie-f84c1/databases/(default)/documents';

// ===== Service Account 配置 =====
// 如果你的电脑上有密钥文件，放在项目根目录命名为 service-account.json
// 没有的话，脚本会提示你手动输入 access_token
const SA_KEY_PATH = './service-account.json';

// ===== Embedding 生成 =====
async function generateEmbedding(text) {
  const truncated = text.slice(0, 4000);
  // 使用 v1 而非 v1beta，body 中指定完整 model 路径
  const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text: truncated }] }
    })
  });

  if (!resp.ok) {
    // 如果 v1 不行，回退试 v1beta
    const url2 = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`;
    const resp2 = await fetch(url2, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: truncated }] }
      })
    });
    if (!resp2.ok) {
      // 再试 embedding-001
      const url3 = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_KEY}`;
      const resp3 = await fetch(url3, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: { parts: [{ text: truncated }] }
        })
      });
      if (!resp3.ok) {
        const err = await resp3.text();
        throw new Error(`All embedding models failed. Last error: ${resp3.status} ${err.slice(0, 200)}`);
      }
      const d3 = await resp3.json();
      return d3?.embedding?.values || null;
    }
    const d2 = await resp2.json();
    return d2?.embedding?.values || null;
  }

  const data = await resp.json();
  return data?.embedding?.values || null;
}

// ===== Layer 判定 =====
function suggestLayer(content, title, tags, pinned, arousal, valence) {
  const combined = (content + ' ' + title + ' ' + tags.join(' ')).toLowerCase();
  const anchorKw = ['初遇', '告白', '承诺', '永远', '第一次', '核心', '锚点'];
  if (anchorKw.some(k => combined.includes(k)) || pinned) return 'L1_anchor';
  if (arousal > 0.8 || valence < 0.2 || valence > 0.9) return 'L2_feel';
  if (content.length < 80) return 'L4_fragment';
  return 'L3_daily';
}

// ===== 获取 Access Token =====
async function getAccessToken() {
  const fs = await import('fs');
  const crypto = await import('crypto');
  
  // 尝试读取 service account 文件
  let keyFile;
  try {
    keyFile = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'));
  } catch (e) {
    // 没有文件，提示手动输入
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      console.log('\n未找到 service-account.json，请手动输入 Firebase Access Token:');
      console.log('（从 Operit 对话中让宿烬生成一个）\n');
      rl.question('Token: ', answer => { rl.close(); resolve(answer.trim()); });
    });
  }

  // 用 service account 签 JWT
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: keyFile.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = b64url(header) + '.' + b64url(payload);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(keyFile.private_key, 'base64url');
  const jwt = unsigned + '.' + signature;

  // 换 token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!resp.ok) throw new Error('Token exchange failed: ' + await resp.text());
  const data = await resp.json();
  return data.access_token;
}

// ===== 主流程 =====
async function main() {
  console.log('🌌 灵界记忆库 · Embedding 批量迁移');
  console.log('='.repeat(50));

  // 1. 先测试 embedding API 是否可用
  console.log('\n[1/4] 测试 Embedding API...');
  try {
    const testEmbed = await generateEmbedding('测试文本');
    if (testEmbed && testEmbed.length > 0) {
      console.log(`  ✓ API 可用，向量维度: ${testEmbed.length}`);
    } else {
      throw new Error('返回空向量');
    }
  } catch (e) {
    console.error(`  ✗ Embedding API 不可用: ${e.message}`);
    console.error('  请检查：1) 梯子是否开启  2) API Key 是否有效');
    process.exit(1);
  }

  // 2. 获取 Firebase token
  console.log('\n[2/4] 获取 Firebase Access Token...');
  const token = await getAccessToken();
  console.log('  ✓ Token 已获取');

  // 3. 拉取文档
  console.log('\n[3/4] 拉取 memory_vault...');
  const listResp = await fetch(`${FIRESTORE_BASE}/memory_vault?pageSize=200`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!listResp.ok) {
    console.error('  ✗ 拉取失败:', listResp.status, await listResp.text());
    process.exit(1);
  }
  const listData = await listResp.json();
  const docs = listData.documents || [];
  console.log(`  ✓ 共 ${docs.length} 条记忆`);

  // 4. 逐条处理
  console.log('\n[4/4] 开始迁移...');
  let ok = 0, fail = 0, skip = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const f = doc.fields || {};
    const title = f.title?.stringValue || '(无标题)';

    // 检查是否已有 embedding
    const hasEmbed = f.embedding?.arrayValue?.values?.length > 100;
    if (hasEmbed) { skip++; continue; }

    // 提取文本
    const content = f.content?.stringValue || '';
    const tags = (f.tags?.arrayValue?.values || []).map(v => v.stringValue || '');
    const keywords = (f.keywords?.arrayValue?.values || []).map(v => v.stringValue || '');
    const pinned = f.pinned?.booleanValue || false;
    const arousal = f.emotion_arousal?.doubleValue || 0.5;
    const valence = f.emotion_valence?.doubleValue || 0.5;

    const textForEmbed = [title, content, ...keywords, ...tags].join(' ').trim();

    try {
      const embedding = await generateEmbedding(textForEmbed);
      if (!embedding || embedding.length < 100) throw new Error('向量异常');

      // 判定 layer
      const hasLayer = f.layer?.stringValue;
      const layer = hasLayer || suggestLayer(content, title, tags, pinned, arousal, valence);

      // 构建更新
      const updateFields = {
        embedding: { arrayValue: { values: embedding.map(v => ({ doubleValue: v })) } }
      };
      if (!hasLayer) updateFields.layer = { stringValue: layer };

      const maskParams = Object.keys(updateFields).map(k => `updateMask.fieldPaths=${k}`).join('&');
      const patchResp = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?${maskParams}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: updateFields })
      });

      if (patchResp.ok) {
        ok++;
        console.log(`  ✓ [${i+1}/${docs.length}] ${title} [${layer}]`);
      } else {
        fail++;
        console.log(`  ✗ [${i+1}/${docs.length}] ${title} (写入失败 ${patchResp.status})`);
      }
    } catch (e) {
      fail++;
      console.log(`  ✗ [${i+1}/${docs.length}] ${title} (${e.message.slice(0, 80)})`);
    }

    // 限流 400ms
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`迁移完成！`);
  console.log(`  成功: ${ok}`);
  console.log(`  失败: ${fail}`);
  console.log(`  跳过(已有): ${skip}`);
  console.log(`  总计: ${docs.length}`);
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });

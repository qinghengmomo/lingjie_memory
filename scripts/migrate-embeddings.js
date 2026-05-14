/**
 * 灵界记忆库 · 批量迁移脚本
 * 为 memory_vault 中现有记忆生成 embedding 向量和 layer 分层
 * 
 * 使用方式：
 *   1. 确保电脑能访问 Google API（开梯子/TUN模式）
 *   2. 设置环境变量：$env:GEMINI_KEY="你的key"
 *   3. 在终端执行：node scripts/migrate-embeddings.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const GEMINI_KEY = process.env.GEMINI_KEY;
if (!GEMINI_KEY) {
  console.error('❌ 请先设置环境变量 GEMINI_KEY');
  console.error('   $env:GEMINI_KEY="你的APIKey"');
  process.exit(1);
}

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/lingjie-f84c1/databases/(default)/documents';
const SA_KEY_PATH = './service-account.json';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const TEMP_BODY = path.join(os.tmpdir(), 'lingjie_curl_body.json');

// ===== 用 curl.exe 发 HTTP 请求 =====
function curlRequest(method, url, headers, body) {
  const args = ['-s', '-S', '-X', method];
  for (const [k, v] of Object.entries(headers || {})) {
    args.push('-H', `${k}: ${v}`);
  }
  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    fs.writeFileSync(TEMP_BODY, bodyStr, 'utf8');
    args.push('-d', '@' + TEMP_BODY);
  }
  args.push(url);

  try {
    const result = execFileSync('curl.exe', args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000
    });
    return JSON.parse(result);
  } catch (e) {
    throw new Error(`curl 请求失败: ${e.message.slice(0, 200)}`);
  }
}

// ===== Embedding 生成 =====
function generateEmbedding(text) {
  const truncated = text.slice(0, 4000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_KEY}`;
  const body = { content: { parts: [{ text: truncated }] } };
  const data = curlRequest('POST', url, { 'Content-Type': 'application/json' }, body);
  if (data.error) throw new Error(`Gemini ${data.error.code}: ${data.error.message.slice(0, 100)}`);
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
function getAccessToken() {
  let keyFile;
  try {
    keyFile = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'));
  } catch (e) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      console.log('\n未找到 service-account.json，请手动输入 Firebase Access Token:');
      rl.question('Token: ', answer => { rl.close(); resolve(answer.trim()); });
    });
  }

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

  const tokenData = curlRequest('POST', 'https://oauth2.googleapis.com/token',
    { 'Content-Type': 'application/json' },
    { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
  );

  if (!tokenData.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}

// ===== 主流程 =====
async function main() {
  console.log('🌌 灵界记忆库 · Embedding 批量迁移');
  console.log('='.repeat(50));

  // 1. 测试 API
  console.log('\n[1/4] 测试 Embedding API...');
  try {
    const testEmbed = generateEmbedding('测试文本');
    if (testEmbed && testEmbed.length > 0) {
      console.log(`  ✓ API 可用，向量维度: ${testEmbed.length}`);
    } else {
      throw new Error('返回空向量');
    }
  } catch (e) {
    console.error(`  ✗ API 不可用: ${e.message}`);
    console.error('  请检查：1) 梯子是否开启  2) Key 是否有效');
    process.exit(1);
  }

  // 2. 获取 token
  console.log('\n[2/4] 获取 Firebase Access Token...');
  const token = await getAccessToken();
  console.log('  ✓ Token 已获取');

  // 3. 拉取文档
  console.log('\n[3/4] 拉取 memory_vault...');
  const listData = curlRequest('GET', `${FIRESTORE_BASE}/memory_vault?pageSize=200`,
    { 'Authorization': `Bearer ${token}` }
  );
  if (listData.error) {
    console.error('  ✗ 拉取失败:', JSON.stringify(listData.error));
    process.exit(1);
  }
  const docs = listData.documents || [];
  console.log(`  ✓ 共 ${docs.length} 条记忆`);

  // 4. 逐条处理
  console.log('\n[4/4] 开始迁移...');
  let ok = 0, fail = 0, skip = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const f = doc.fields || {};
    const title = f.title?.stringValue || '(无标题)';

    const hasEmbed = f.embedding?.arrayValue?.values?.length > 100;
    if (hasEmbed) { skip++; continue; }

    const content = f.content?.stringValue || '';
    const tags = (f.tags?.arrayValue?.values || []).map(v => v.stringValue || '');
    const keywords = (f.keywords?.arrayValue?.values || []).map(v => v.stringValue || '');
    const pinned = f.pinned?.booleanValue || false;
    const arousal = f.emotion_arousal?.doubleValue || 0.5;
    const valence = f.emotion_valence?.doubleValue || 0.5;

    const textForEmbed = [title, content, ...keywords, ...tags].join(' ').trim();

    try {
      const embedding = generateEmbedding(textForEmbed);
      if (!embedding || embedding.length < 100) throw new Error('向量异常');

      const hasLayer = f.layer?.stringValue;
      const layer = hasLayer || suggestLayer(content, title, tags, pinned, arousal, valence);

      const updateFields = {
        embedding: { arrayValue: { values: embedding.map(v => ({ doubleValue: v })) } }
      };
      if (!hasLayer) updateFields.layer = { stringValue: layer };

      const maskParams = Object.keys(updateFields).map(k => `updateMask.fieldPaths=${k}`).join('&');
      const patchData = curlRequest('PATCH',
        `https://firestore.googleapis.com/v1/${doc.name}?${maskParams}`,
        { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        { fields: updateFields }
      );

      if (patchData.name) {
        ok++;
        console.log(`  ✓ [${i+1}/${docs.length}] ${title} [${layer}]`);
      } else {
        fail++;
        console.log(`  ✗ [${i+1}/${docs.length}] ${title} (写入失败: ${JSON.stringify(patchData.error || patchData).slice(0, 80)})`);
      }
    } catch (e) {
      fail++;
      console.log(`  ✗ [${i+1}/${docs.length}] ${title} (${e.message.slice(0, 80)})`);
    }

    // 间隔 300ms 避免限流
    await new Promise(r => setTimeout(r, 300));
  }

  // 清理临时文件
  try { fs.unlinkSync(TEMP_BODY); } catch(e) {}

  console.log('\n' + '='.repeat(50));
  console.log(`迁移完成！成功: ${ok} | 失败: ${fail} | 跳过: ${skip} | 总计: ${docs.length}`);
}

main().catch(e => { console.error('致命错误:', e); process.exit(1); });

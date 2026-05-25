const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const KIMI_KEY = process.env.KIMI_API_KEY;
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2.6';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ===== 鐩綍鍑嗗 =====
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ref-analysis.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== 涓棿浠?=====
app.use(express.json({ limit: '200mb' }));

// 寮哄埗涓嶇紦瀛?HTML 椤甸潰锛堣В鍐虫祻瑙堝櫒缂撳瓨鏃х増鏈殑闂锛?app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== 鐢ㄦ埛鏁版嵁鏂囦欢 =====
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  if (fs.existsSync(USERS_FILE)) {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch {}
  }
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// ===== API: 绠＄悊鍛樼櫥褰?=====
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '绠＄悊鍛樺瘑鐮侀敊璇? });

  // 鑷姩鎶婄鐞嗗憳娉ㄥ唽涓哄凡瀹℃壒鐢ㄦ埛锛屾柟渚跨洿鎺ヨ繘鍏?  const users = loadUsers();
  let u = users.find(u => u.name === '绠＄悊鍛?);
  if (!u) {
    u = { name: '绠＄悊鍛?, status: 'approved', appliedAt: Date.now(), approvedAt: Date.now() };
    users.push(u);
    saveUsers(users);
  } else if (u.status !== 'approved') {
    u.status = 'approved';
    u.approvedAt = Date.now();
    saveUsers(users);
  }

  res.json({ success: true, name: '绠＄悊鍛? });
});

// ===== API: 鍛樺伐鐢宠浣跨敤 =====
app.post('/api/apply-user', (req, res) => {
  console.log('[apply-user] body:', JSON.stringify(req.body));
  const { name } = req.body;
  if (!name || name.trim().length < 1) return res.status(400).json({ error: '璇疯緭鍏ヤ綘鐨勫悕瀛? });

  const users = loadUsers();
  const existing = users.find(u => u.name === name.trim());
  if (existing) {
    if (existing.status === 'approved') return res.json({ status: 'approved' });
    if (existing.status === 'pending') return res.json({ status: 'pending' });
    if (existing.status === 'rejected') return res.json({ status: 'rejected' });
  }

  users.push({
    name: name.trim(),
    status: 'pending',
    appliedAt: Date.now(),
    approvedAt: null,
  });
  saveUsers(users);
  res.json({ status: 'pending' });
});

// ===== API: 鏌ヨ鐘舵€侊紙杞鐢級 =====
app.post('/api/check-user-status', (req, res) => {
  const { name } = req.body;
  if (!name) return res.json({ status: 'none' });
  const users = loadUsers();
  const u = users.find(u => u.name === name.trim());
  if (!u) return res.json({ status: 'none' });
  res.json({ status: u.status, name: u.name });
});

// ===== API: 绠＄悊鍛樻煡鐪嬫墍鏈夌敤鎴?=====
app.post('/api/admin-get-users', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '鏈巿鏉? });
  const users = loadUsers();
  res.json({ users });
});

// ===== API: 绠＄悊鍛樺鎵?鎷掔粷/韪㈠嚭 =====
app.post('/api/admin-action', (req, res) => {
  const { password, action, name } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '鏈巿鏉? });
  if (!name) return res.status(400).json({ error: '缂哄皯鐢ㄦ埛鍚嶇О' });

  const users = loadUsers();
  const u = users.find(u => u.name === name);
  if (!u) return res.status(404).json({ error: '鐢ㄦ埛涓嶅瓨鍦? });

  if (action === 'approve') {
    u.status = 'approved';
    u.approvedAt = Date.now();
  } else if (action === 'reject') {
    u.status = 'rejected';
  } else if (action === 'kick') {
    u.status = 'kicked';
  } else {
    return res.status(400).json({ error: '鏃犳晥鎿嶄綔' });
  }

  saveUsers(users);
  res.json({ success: true });
});

// ===== 鏂囦欢涓婁紶閰嶇疆 =====
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(file.originalname);
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (ok.includes(ext)) cb(null, true);
    else cb(new Error('涓嶆敮鎸佺殑鏂囦欢绫诲瀷: ' + ext));
  }
});

// ===== 宸ュ叿锛氫粠URL涓嬭浇鍥剧墖杞琤ase64 =====
async function urlToBase64(url) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`涓嬭浇鍥剧墖澶辫触: ${resp.status} (${url.slice(0, 50)})`);
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await resp.arrayBuffer());
  const b64 = buf.toString('base64');
  return { b64, mime: contentType };
}

// ===== Kimi API 璋冪敤 =====
async function callKimi(messages) {
  if (!KIMI_KEY || KIMI_KEY === 'sk-浣犵殑Key鏀捐繖閲?) {
    throw new Error('璇峰厛閰嶇疆 .env 鏂囦欢涓殑 KIMI_API_KEY');
  }

  const resp = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_KEY}`
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages,
      max_tokens: 16384,
      ...(KIMI_MODEL === 'kimi-k2.6' ? {} : { temperature: 1 })
    }),
    signal: AbortSignal.timeout(600000)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Kimi API ${resp.status}: ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ===== 瑙ｆ瀽杈撳叆鐨勫弬鑰冪礌鏉愶紙鏀寔涓ょ鏍煎紡锛?=====
function parseRefInput(rawText) {
  // 鏍煎紡1: 鍥剧墖URL | 鏍囬   锛堜竴琛屼竴瀵癸紝鐢?| 鍒嗛殧锛?  // 鏍煎紡2: 绾爣棰橈紙姣忚涓€鏍囬锛?  const lines = rawText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  const items = []; // { url, title } 鎴?{ title }
  const pureTitles = [];

  for (const line of lines) {
    // 灏濊瘯鎸?| 鍒嗗壊
    const pipeIdx = line.indexOf('|');
    if (pipeIdx > 0) {
      const first = line.substring(0, pipeIdx).trim();
      const second = line.substring(pipeIdx + 1).trim();
      // 鍒ゆ柇绗竴涓槸涓嶆槸URL
      if (first.startsWith('http://') || first.startsWith('https://')) {
        items.push({ url: first, title: second || '' });
        continue;
      }
    }
    // 绾爣棰?    if (line.length > 5) {
      pureTitles.push(line);
    }
  }

  return { items, pureTitles };
}

// ===== 瑙ｆ瀽鏂颁骇鍝佽緭鍏?=====
function parseNewProductInput(rawText) {
  // 鏍煎紡: 鍨嬪彿鍚?| 鍥剧墖URL1,鍥剧墖URL2...
  const lines = rawText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  const products = []; // { modelName, urls: [url1, url2] }

  for (const line of lines) {
    const pipeIdx = line.indexOf('|');
    if (pipeIdx > 0) {
      const modelName = line.substring(0, pipeIdx).trim();
      const urlsPart = line.substring(pipeIdx + 1).trim();
      const urls = urlsPart.split(/[,锛孿s]+/).filter(u => u.startsWith('http'));
      if (modelName && urls.length) {
        products.push({ modelName, urls });
      }
    } else if (line.startsWith('http')) {
      // 鍗曞紶鍥撅紝浠RL鐨勫墠20涓瓧绗︿綔涓轰复鏃跺悕瀛?      products.push({ modelName: 'product-' + (products.length + 1), urls: [line] });
    }
  }

  return products;
}

// ============================================================
//  鏂板宸ュ叿鍑芥暟
// ============================================================

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw;

  // 绉婚櫎 ```json 鍖呰９锛堝墠鍚庨兘鍙兘鏈夛級
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // 鍘绘帀 markdown 浠ｇ爜鍧楁爣璁?  cleaned = cleaned.replace(/^`{1,3}/gm, '');

  // 灏濊瘯鎻愬彇鏈€澶栧眰 {}
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  cleaned = braceMatch[0];

  // 鍏堝皾璇曟爣鍑嗚В鏋?  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 鏍囧噯瑙ｆ瀽澶辫触锛屽皾璇曟竻鐞嗗悗鍐嶆瑙ｆ瀽
  }

  // 绉婚櫎灏鹃€楀彿锛堟墍鏈夊眰绾э級
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*\]/g, ']');

  // 澶勭悊鍗曞紩鍙蜂负鍙屽紩鍙?  cleaned = cleaned.replace(/'/g, '"');

  // 澶勭悊涓嶅甫寮曞彿鐨?key锛堢畝鍗曞満鏅級
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // 绉婚櫎娉ㄩ噴锛?/ 鍜?/* */锛?  cleaned = cleaned.replace(/\/\/.*/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // 淇瀛楃涓蹭腑鍙兘琚牬鍧忕殑 Unicode
  cleaned = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (m, p1) => {
    try { return String.fromCharCode(parseInt(p1, 16)); } catch { return m; }
  });

  try {
    return JSON.parse(cleaned);
  } catch (e2) {
    // 鏈€鍚庡皾璇曟彁鍙栦换浣曠湅璧锋潵鍍?JSON 鐨勯儴鍒?    const retryMatch = cleaned.match(/\{[\s\S]*\}/);
    if (retryMatch) {
      try {
        return JSON.parse(retryMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ===== 鍗曟壒鍒嗘瀽鍑芥暟 =====
async function analyzeBatch(titles, batchIndex) {
  const titlesText = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const prompt = `浣犳槸TEMU鏍囬鍒嗘瀽涓撳銆?
璇峰垎鏋愪互涓嬫爣棰橈細

${titlesText}

1. 鎻愬彇楂橀鍏抽敭璇?2. 鎻愬彇鏍囬缁撴瀯
3. 鍒ゆ柇鏍囬闀垮害鍖洪棿
4. 杈撳嚭JSON

绂佹杈撳嚭瑙ｉ噴鏂囧瓧
绂佹杈撳嚭 markdown
绂佹杈撳嚭 \`\`\`json

杩斿洖鏍煎紡锛?{
  "category": {
    "cn": "",
    "en": ""
  },
  "hotWords": {
    "feature": [],
    "material": [],
    "scene": [],
    "sellingPoint": [],
    "targetAudience": [],
    "modifiers": [],
    "marketing": []
  },
  "titlePatterns": [],
  "charLengthRange": {
    "min": 60,
    "max": 120
  },
  "summary": {
    "cn": "",
    "en": ""
  }
}`;

  const rawResult = await callKimi([
    { role: 'system', content: '浣犳槸TEMU鏍囬涓撳銆傚彧杩斿洖JSON銆? },
    { role: 'user', content: [{ type: 'text', text: prompt }] }
  ]);

  const parsed = safeParseJSON(rawResult);
  if (!parsed) {
    console.warn(`[analyze-ref] 鎵规 ${batchIndex + 1} 瑙ｆ瀽澶辫触锛屽師濮嬪唴瀹?`, rawResult.slice(0, 300));
    // 杩斿洖绌虹粨鏋勶紝涓嶅奖鍝嶈仛鍚?    return {
      category: { cn: '', en: '' },
      hotWords: { feature: [], material: [], scene: [], sellingPoint: [], targetAudience: [], modifiers: [], marketing: [] },
      titlePatterns: [],
      charLengthRange: { min: 0, max: 0 },
      summary: { cn: '', en: '' }
    };
  }

  // 纭繚缁撴瀯瀹屾暣
  if (!parsed.hotWords) parsed.hotWords = { feature: [], material: [], scene: [], sellingPoint: [], targetAudience: [], modifiers: [], marketing: [] };
  if (!parsed.titlePatterns) parsed.titlePatterns = [];
  if (!parsed.charLengthRange) parsed.charLengthRange = { min: 0, max: 0 };
  if (!parsed.summary) parsed.summary = { cn: '', en: '' };
  if (!parsed.category) parsed.category = { cn: '', en: '' };

  // 纭繚姣忎釜hotWords瀛愭暟缁勫瓨鍦?  const catKeys = ['feature', 'material', 'scene', 'sellingPoint', 'targetAudience', 'modifiers', 'marketing'];
  for (const key of catKeys) {
    if (!Array.isArray(parsed.hotWords[key])) parsed.hotWords[key] = [];
  }

  parsed._batchIndex = batchIndex;
  return parsed;
}

// ===== 鑱氬悎澶氭壒缁撴灉 =====
function mergeBatchResults(batchResults, totalTitleCount) {
  if (!batchResults || batchResults.length === 0) {
    return {
      category: { cn: '鏈垎绫?, en: 'Uncategorized' },
      hotWords: {},
      titlePatterns: [],
      charLengthRange: { min: 0, max: 0 },
      summary: { cn: '鍒嗘瀽鏈繑鍥炴湁鏁堟暟鎹?, en: 'No valid analysis data returned' }
    };
  }

  const validResults = batchResults.filter(r => r && typeof r.hotWords === 'object');

  if (validResults.length === 0) {
    return {
      category: { cn: '鏈垎绫?, en: 'Uncategorized' },
      hotWords: {},
      titlePatterns: [],
      charLengthRange: { min: 0, max: 0 },
      summary: { cn: '鍒嗘瀽鏈繑鍥炴湁鏁堟暟鎹?, en: 'No valid analysis data returned' }
    };
  }

  if (validResults.length === 1) {
    const r = validResults[0];
    if (!r.category) r.category = { cn: '', en: '' };
    if (!r.charLengthRange) r.charLengthRange = { min: 0, max: 0 };
    if (!r.summary) r.summary = { cn: '', en: '' };
    return r;
  }

  // 鍚堝苟
  const catKeys = ['feature', 'material', 'scene', 'sellingPoint', 'targetAudience', 'modifiers', 'marketing'];

  // category 淇濈暀绗竴鎵?  const category = validResults[0].category || { cn: '', en: '' };

  // hotWords 鍚堝苟锛氬悓璇嶅幓閲?+ count 绱姞
  const mergedHotWords = {};
  for (const key of catKeys) {
    const wordMap = new Map(); // cn|en -> { cn, en, count }
    for (const r of validResults) {
      const words = r.hotWords?.[key] || [];
      for (const w of words) {
        if (!w || (!w.cn && !w.en)) continue;
        const keyStr = (w.cn || '') + '|' + (w.en || '');
        if (wordMap.has(keyStr)) {
          wordMap.get(keyStr).count = (wordMap.get(keyStr).count || 0) + (w.count || 1);
        } else {
          wordMap.set(keyStr, { cn: w.cn || '', en: w.en || '', count: w.count || 1 });
        }
      }
    }
    // 鎸?count 闄嶅簭
    mergedHotWords[key] = Array.from(wordMap.values()).sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  // titlePatterns 鍘婚噸
  const seenPat = new Set();
  const mergedPatterns = [];
  for (const r of validResults) {
    const patterns = r.titlePatterns || [];
    for (const p of patterns) {
      if (!p) continue;
      const patKey = typeof p.pattern === 'object' ? (p.pattern.cn || p.pattern.en || '') : (p.pattern || '');
      if (!patKey) continue;
      if (seenPat.has(patKey)) continue;
      seenPat.add(patKey);
      mergedPatterns.push(p);
    }
  }

  // charLengthRange 鍙栨墍鏈夋壒娆＄殑鏈€灏弇in鍜屾渶澶ax
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const r of validResults) {
    const range = r.charLengthRange || {};
    if (typeof range.min === 'number' && range.min > 0 && range.min < globalMin) globalMin = range.min;
    if (typeof range.max === 'number' && range.max > 0 && range.max > globalMax) globalMax = range.max;
  }
  if (globalMin === Infinity) globalMin = 0;
  if (globalMax === -Infinity) globalMax = 0;

  // summary 鍚堝苟
  const summaryCn = validResults.map(r => {
    const s = r.summary;
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object') return s.cn || '';
    return '';
  }).filter(Boolean).join('锛?).slice(0, 200);

  const summaryEn = validResults.map(r => {
    const s = r.summary;
    if (typeof s === 'string') return '';
    if (s && typeof s === 'object') return s.en || '';
    return '';
  }).filter(Boolean).join('; ').slice(0, 200);

  return {
    category,
    hotWords: mergedHotWords,
    titlePatterns: mergedPatterns,
    charLengthRange: { min: globalMin, max: globalMax },
    summary: { cn: summaryCn, en: summaryEn }
  };
}

// ===== API: 鍒嗘瀽鐖嗘鍙傝€冪礌鏉愶紙鏀寔URL鍜屼笂浼狅級 =====
app.post('/api/analyze-ref', upload.array('images', 30), async (req, res) => {
  try {
    const { rawInput } = req.body;
    const files = req.files || [];

    if (!rawInput || rawInput.trim().length < 3) {
      files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ error: '璇风矘璐寸垎娆剧礌鏉愶紙鏍煎紡锛氬浘鐗嘦RL|鏍囬锛屾垨绾爣棰橈級' });
    }

    const parsed = parseRefInput(rawInput);

    // 鏀堕泦鎵€鏈夋爣棰?    const allTitles = [
      ...parsed.items.filter(i => i.title).map(i => i.title),
      ...parsed.pureTitles
    ];

    if (allTitles.length === 0) {
      files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ error: '鏈В鏋愬埌鏈夋晥鏍囬锛岃妫€鏌ヨ緭鍏ユ牸寮? });
    }

    // 鍒嗘壒娆★細姣?0鏉′竴鎵?    const BATCH_SIZE = 20;
    const titleChunks = chunkArray(allTitles, BATCH_SIZE);

    // 濡傛灉鏈変笂浼犳垨URL鍥剧墖锛屽彧鍦ㄧ涓€鎵归檮涓婂浘鐗?    const imageParts = [];
    // 涓婁紶鐨勫浘
    for (const file of files) {
      const b64 = fs.readFileSync(file.path).toString('base64');
      const mime = file.mimetype || 'image/jpeg';
      imageParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
    }
    // URL鍥?    for (const item of parsed.items) {
      if (!item.url) continue;
      try {
        const { b64, mime } = await urlToBase64(item.url);
        imageParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
      } catch (e) {
        console.warn(`涓嬭浇鍥剧墖澶辫触: ${item.url.slice(0, 50)}`);
      }
    }
    // 濡傛灉鏈夊浘鐗囷紝璇诲彇鍥剧墖鍐呭浣滀负绗竴鎵圭殑琛ュ厖鏂囧瓧鎻愮ず
    // 鍥剧墖涓嶉€佸埌鍚庣画鎵规锛堥伩鍏嶉噸澶嶆秷鑰梩okens锛?    const imageHint = imageParts.length > 0 ? '锛堣缁撳悎鏈壒娆℃爣棰樼壒寰佸垎鏋愶紱濡傛湁鍥剧墖鍙弬鑰冭瑙夊厓绱狅級' : '';

    // 閫愭壒璇锋眰Kimi
    const batchResults = [];
    for (let i = 0; i < titleChunks.length; i++) {
      const chunk = titleChunks[i];
      // 涓哄綋鍓嶆壒娆℃瀯寤烘秷鎭唴瀹?      const msgContent = [];

      // 绗竴鎵规墠闄勫甫鍥剧墖
      if (i === 0 && imageParts.length > 0) {
        // 鍥剧墖鏀惧湪鍓嶉潰
        for (const imgPart of imageParts) {
          msgContent.push(imgPart);
        }
      }

      const titlesText = chunk.map((t, idx) => `${idx + 1}. ${t}`).join('\n');

      const prompt = `浣犳槸TEMU鏍囬鍒嗘瀽涓撳銆?
璇峰垎鏋愪互涓嬫爣棰?{imageHint}锛?
${titlesText}

1. 鎻愬彇楂橀鍏抽敭璇?2. 鎻愬彇鏍囬缁撴瀯
3. 鍒ゆ柇鏍囬闀垮害鍖洪棿
4. 杈撳嚭JSON

绂佹杈撳嚭瑙ｉ噴鏂囧瓧
绂佹杈撳嚭 markdown
绂佹杈撳嚭 \`\`\`json

杩斿洖鏍煎紡锛?{
  "category": {
    "cn": "",
    "en": ""
  },
  "hotWords": {
    "feature": [],
    "material": [],
    "scene": [],
    "sellingPoint": [],
    "targetAudience": [],
    "modifiers": [],
    "marketing": []
  },
  "titlePatterns": [],
  "charLengthRange": {
    "min": 60,
    "max": 120
  },
  "summary": {
    "cn": "",
    "en": ""
  }
}`;

      msgContent.push({ type: 'text', text: prompt });

      console.log(`[analyze-ref] 璇锋眰绗?${i + 1}/${titleChunks.length} 鎵癸紙${chunk.length} 鏉℃爣棰橈級...`);

      const rawResult = await callKimi([
        { role: 'system', content: '浣犳槸TEMU鏍囬涓撳銆傚彧杩斿洖JSON銆? },
        { role: 'user', content: msgContent }
      ]);

      const parsed = safeParseJSON(rawResult);
      if (!parsed) {
        console.warn(`[analyze-ref] 鎵规 ${i + 1} 瑙ｆ瀽澶辫触锛屼娇鐢ㄧ┖缁撴瀯`);
        batchResults.push({
          category: { cn: '', en: '' },
          hotWords: { feature: [], material: [], scene: [], sellingPoint: [], targetAudience: [], modifiers: [], marketing: [] },
          titlePatterns: [],
          charLengthRange: { min: 0, max: 0 },
          summary: { cn: '', en: '' },
          _batchIndex: i
        });
        continue;
      }

      // 纭繚缁撴瀯瀹屾暣
      if (!parsed.hotWords) parsed.hotWords = { feature: [], material: [], scene: [], sellingPoint: [], targetAudience: [], modifiers: [], marketing: [] };
      if (!parsed.titlePatterns) parsed.titlePatterns = [];
      if (!parsed.charLengthRange) parsed.charLengthRange = { min: 0, max: 0 };
      if (!parsed.summary) parsed.summary = { cn: '', en: '' };
      if (!parsed.category) parsed.category = { cn: '', en: '' };

      const catKeys = ['feature', 'material', 'scene', 'sellingPoint', 'targetAudience', 'modifiers', 'marketing'];
      for (const key of catKeys) {
        if (!Array.isArray(parsed.hotWords[key])) parsed.hotWords[key] = [];
      }

      parsed._batchIndex = i;
      batchResults.push(parsed);
    }

    // 娓呯悊涓婁紶鏂囦欢
    files.forEach(f => fs.unlinkSync(f.path));

    // 鑱氬悎鎵€鏈夋壒娆＄粨鏋?    analysis = mergeBatchResults(batchResults, allTitles.length);

    analysis._savedAt = Date.now();
    analysis._titleCount = allTitles.length;
    fs.writeFileSync(DATA_FILE, JSON.stringify(analysis, null, 2), 'utf-8');

    res.json({ success: true, data: analysis });
  } catch (e) {
    if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    res.status(500).json({ error: e.message });
  }
});
// ===== 娉ㄦ剰: 鍘?analyze-ref 鎺ュ彛宸茶鏇挎崲 =====

// ===== API: 鑾峰彇宸蹭繚瀛樼殑涓棿绔垎鏋愭暟鎹?=====
app.get('/api/ref-analysis', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      res.json({ exists: true, data });
    } else {
      res.json({ exists: false });
    }
  } catch (e) {
    res.json({ exists: false, error: e.message });
  }
});

// ===== API: 鍒犻櫎涓棿绔垎鏋愭暟鎹?=====
app.post('/api/clear-ref', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== API: 鎵归噺鐢熸垚鏍囬 =====
app.post('/api/generate-titles', async (req, res) => {
  try {
    const { rawInput, titleCount, fileNameMap, extraRequirements } = req.body;
    // rawInput: 鍨嬪彿鍚?| 鍥剧墖URL1,鍥剧墖URL2...  姣忚涓€涓?    // fileNameMap: { "鍨嬪彿鍚?: ["鍥剧墖URL1", "鍥剧墖URL2"] } 锛堝閫夋牸寮忥級
    const genCount = parseInt(titleCount) || 1;

    if (!rawInput && !fileNameMap) {
      return res.status(400).json({ error: '璇风矘璐存柊鍝佸浘鐗嘦RL鍜屽瀷鍙? });
    }

    let productList = [];

    if (fileNameMap) {
      // 鐩存帴浼犲叆浜嗘瀯寤哄ソ鐨勬槧灏?      for (const [modelName, urls] of Object.entries(fileNameMap)) {
        productList.push({
          modelName,
          urls,
          isSKC: urls.length > 1,
          skuCount: urls.length
        });
      }
    } else if (rawInput) {
      const parsed = parseNewProductInput(rawInput);
      for (const p of parsed) {
        productList.push({
          modelName: p.modelName,
          urls: p.urls,
          isSKC: p.urls.length > 1,
          skuCount: p.urls.length
        });
      }
    }

    if (!productList.length) {
      return res.status(400).json({ error: '鏈兘瑙ｆ瀽鍑烘湁鏁堢殑浜у搧淇℃伅' });
    }

    // 璇诲彇宸蹭繚瀛樼殑鍙傝€冨垎鏋?    let refData = null;
    if (fs.existsSync(DATA_FILE)) {
      refData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // ===== 鏋勫缓娑堟伅 =====
    const msgContent = [];

    // 涓嬭浇鎵€鏈夊浘鐗囧苟鎸変骇鍝佸垎缁?    for (let i = 0; i < productList.length; i++) {
      const prod = productList[i];
      for (let j = 0; j < prod.urls.length; j++) {
        try {
          const { b64, mime } = await urlToBase64(prod.urls[j]);
          msgContent.push({
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${b64}` }
          });
          msgContent.push({
            type: 'text',
            text: `鈻?浜у搧 "${prod.modelName}" 鐨勭 ${j + 1} 寮犲浘锛堝叡 ${prod.urls.length} 寮狅級`
          });
        } catch (e) {
          // 鍗曞紶鍥句笅杞藉け璐ワ紝璺宠繃
        }
      }
    }

    // 鏋勫缓鍙傝€冩暟鎹
    let refSection = '';
    if (refData) {
      const hw = refData.hotWords || {};
      const patterns = refData.titlePatterns || [];
      const catLabels = { feature:'鍔熻兘/Feature', material:'鏉愯川/Material', scene:'鍦烘櫙/Scene', sellingPoint:'鍗栫偣/Selling Point', targetAudience:'浜虹兢/Target Audience', modifiers:'淇グ璇?Modifiers', marketing:'钀ラ攢/Marketing' };
      refSection = `
=== 鐖嗘鍙傝€冩暟鎹?/ Best-selling Reference ===
鍝佺被/Category锛?{typeof refData.category === 'object' ? refData.category.en || refData.category.cn : refData.category}
鐑攢鍏抽敭璇?/ Hot Keywords锛?${Object.entries(hw).map(([k, v]) => `  ${catLabels[k] || k}: ${(v || []).map(w => typeof w === 'object' ? `${w.cn}/${w.en}` : w).join(', ')}`).join('\n')}

鏍囬缁撴瀯妯″紡 / Title Patterns锛?${patterns.map((p, i) => {
  const patStr = typeof p.pattern === 'object' ? `${p.pattern.cn} / ${p.pattern.en}` : p.pattern;
  const exStr = typeof p.example === 'object' ? `${p.example.cn} / ${p.example.en}` : (p.example || '-');
  return `  ${i + 1}. ${patStr}锛堜緥: ${exStr}锛塦;
}).join('\n')}
瀛楃闀垮害 / Char Length锛?{refData.charLengthRange ? `${refData.charLengthRange.min}-${refData.charLengthRange.max}` : '60-120'}
鎽樿 / Summary锛?{typeof refData.summary === 'object' ? refData.summary.en || refData.summary.cn : refData.summary}
`;
    }

    const systemPrompt = `浣犳槸涓€涓猅EMU璺ㄥ鏍囬鐢熸垚涓撳锛岀簿閫氫腑鑻卞弻璇€俙 + (refData ? `渚濇嵁宸插垎鏋愮殑鐖嗘鏁版嵁鏉ョ敓鎴愭爣棰樸€俙 : `鐩存帴鏍规嵁鍥剧墖鐢熸垚鏍囬銆俙);

    const userPrompt = `${refSection}

=== 闇€瑕佺敓鎴愭爣棰樼殑浜у搧鍒楄〃 / Products to Generate ===

${productList.map((prod, idx) => `銆愪骇鍝?Product ${idx + 1}銆?鍨嬪彿鍚?Model: ${prod.modelName}
鍥剧墖鏁?Images: ${prod.skuCount}${prod.isSKC ? '\n锛堝悓涓€SKC鐨勫涓猄KU鍥?/ Multiple SKU images under same SKC锛? : ''}
`).join('\n')}

瑕佹眰 / Requirements锛?1. 缁煎悎姣忎釜浜у搧鐨勬墍鏈夊浘鐗囧垽鏂骇鍝佺壒寰?2. 涓烘瘡涓瀷鍙风敓鎴?${genCount} 涓爣棰?3. 姣忎釜鏍囬蹇呴』鍚屾椂鎻愪緵涓嫳鏂囩増鏈紙涓枃鐢ㄤ簬鍐呴儴鐞嗚В锛岃嫳鏂囩敤浜庝笂鏋讹級/ Provide BOTH Chinese and English versions
4. 鑻辨枃闀垮害60-120瀛楃锛岄€傞厤缇庡浗甯傚満琛ㄨ揪涔犳儻 / English should match US market style
5. 涓嫳鏂囨爣棰樺潎蹇呴』鍖呭惈鏍稿績鍝佺被璇嶏紙濡係unglasses/澶槼闀滐級鍜岀儹閿€鍔熻兘璇嶏紙濡俇V400銆丳olarized绛夛級
6. ${refData ? '鍙傝€冪垎娆炬暟鎹殑鏍囬缁撴瀯鍜岀儹璇嶉鏍? : '鍙傝€僒EMU鐖嗘鏍囬鐨勯€氱敤椋庢牸'}
7. 涓嶅悓鏍囬瑕佹湁宸紓鍖?8. 杩斿洖鐨?modelName 蹇呴』鍜屼笂闈㈠垪鍑虹殑鍨嬪彿鍚嶅畬鍏ㄤ竴鑷?${extraRequirements ? `\n*** 琛ュ厖瑕佹眰 / Extra Requirements ***\n${extraRequirements}` : ''}

璇疯繑鍥炵函JSON / Return JSON only锛?{
  "products": [
    {
      "modelName": "鍨嬪彿鍚?,
      "features": {"cn":"涓枃鍟嗗搧鐗瑰緛鎻忚堪","en":"Product feature description in English"},
      "titles": [
        {"cn":"涓枃鏍囬1","en":"English title 1"},
        {"cn":"涓枃鏍囬2","en":"English title 2"}
      ]
    }
  ]
}`;

    msgContent.push({ type: 'text', text: userPrompt });

    const result = await callKimi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: msgContent }
    ]);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      parsed = { products: [{ modelName: 'error', features: {cn:'',en:''}, titles: [{cn:result.slice(0, 200),en:result.slice(0, 200)}] }] };
    }

    res.json({
      success: true,
      data: parsed,
      productList: productList.map(p => ({ modelName: p.modelName, isSKC: p.isSKC, skuCount: p.skuCount }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== API: 涓婁紶鏂囦欢鏂瑰紡鐢熸垚鏍囬锛堜繚鐣欒€佸姛鑳斤級 =====
app.post('/api/generate-titles-upload', upload.array('images', 50), async (req, res) => {
  try {
    const { titleCount, extraRequirements } = req.body;
    const files = req.files || [];
    const genCount = parseInt(titleCount) || 1;

    if (!files.length) {
      return res.status(400).json({ error: '璇疯嚦灏戜笂浼犱竴寮犱骇鍝佸浘' });
    }

    let refData = null;
    if (fs.existsSync(DATA_FILE)) {
      refData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // SKC鍒嗙粍
    const skcGroups = new Map();
    const skuSingles = [];

    for (const file of files) {
      const name = path.parse(file.originalname).name;
      const dashIdx = name.lastIndexOf('-');
      if (dashIdx > 0 && dashIdx < name.length - 1) {
        const prefix = name.substring(0, dashIdx);
        const suffix = name.substring(dashIdx + 1);
        if (/^\d{1,4}$/.test(suffix) || /^[a-zA-Z]\d{1,3}$/.test(suffix)) {
          if (!skcGroups.has(prefix)) skcGroups.set(prefix, []);
          skcGroups.get(prefix).push({ file, skuName: name, suffix });
          continue;
        }
      }
      skuSingles.push({ file, skuName: name });
    }

    const productList = [];

    for (const [prefix, items] of skcGroups) {
      productList.push({
        isSKC: true,
        modelName: prefix,
        skuCount: items.length,
        files: items.map(item => item.file)
      });
    }

    for (const item of skuSingles) {
      productList.push({
        isSKC: false,
        modelName: item.skuName,
        skuCount: 1,
        files: [item.file]
      });
    }

    const msgContent = [];

    for (let i = 0; i < productList.length; i++) {
      const prod = productList[i];
      for (let j = 0; j < prod.files.length; j++) {
        const file = prod.files[j];
        const b64 = fs.readFileSync(file.path).toString('base64');
        const mime = file.mimetype || 'image/jpeg';
        msgContent.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${b64}` }
        });
        msgContent.push({
          type: 'text',
          text: `鈻?浜у搧 "${prod.modelName}" 鐨勭 ${j + 1} 寮燬KU鍥綻
        });
      }
    }

    let refSection = '';
    if (refData) {
      const hw = refData.hotWords || {};
      const patterns = refData.titlePatterns || [];
      const catLabels = { feature:'鍔熻兘/Feature', material:'鏉愯川/Material', scene:'鍦烘櫙/Scene', sellingPoint:'鍗栫偣/Selling Point', targetAudience:'浜虹兢/Target Audience', modifiers:'淇グ璇?Modifiers', marketing:'钀ラ攢/Marketing' };
      refSection = `
=== 鐖嗘鍙傝€冩暟鎹?/ Best-selling Reference ===
鍝佺被/Category锛?{typeof refData.category === 'object' ? refData.category.en || refData.category.cn : refData.category}
鐑攢鍏抽敭璇?/ Hot Keywords锛?${Object.entries(hw).map(([k, v]) => `  ${catLabels[k] || k}: ${(v || []).map(w => typeof w === 'object' ? `${w.cn}/${w.en}` : w).join(', ')}`).join('\n')}

鎽樿 / Summary锛?{typeof refData.summary === 'object' ? refData.summary.en || refData.summary.cn : refData.summary}
`;
    }

    const systemPrompt = `浣犳槸涓€涓猅EMU璺ㄥ鏍囬鐢熸垚涓撳锛岀簿閫氫腑鑻卞弻璇€俙 + (refData ? `渚濇嵁鐖嗘鏁版嵁鐢熸垚鏍囬銆俙 : `鐩存帴鏍规嵁鍥剧墖鐢熸垚鏍囬銆俙);

    const userPrompt = `${refSection}

浜у搧鍒楄〃 / Products锛?${productList.map((prod, idx) => `銆?{idx + 1}銆?{prod.modelName}锛?{prod.skuCount}寮燬KU鍥?{prod.isSKC ? '锛屽悓涓€SKC' : ''}锛塦).join('\n')}

瑕佹眰 / Requirements锛?1. 缁煎悎鎵€鏈夊浘鐗囷紝涓烘瘡涓骇鍝佺敓鎴?${genCount} 涓爣棰?2. 姣忎釜鏍囬蹇呴』鍚屾椂鎻愪緵涓嫳鏂囩増鏈?/ Provide BOTH Chinese and English versions
3. 鑻辨枃60-120瀛楃锛岄€傞厤缇庡浗甯傚満琛ㄨ揪涔犳儻
4. 涓嶅悓鏍囬涓嶅悓渚ч噸鐐?5. 鐗瑰緛鎻忚堪涔熻涓嫳鏂?6. 涓嫳鏂囨爣棰樺潎蹇呴』鍖呭惈鏍稿績鍝佺被璇嶏紙濡係unglasses/澶槼闀滐級鍜岀儹閿€鍔熻兘璇嶏紙濡俇V400銆丳olarized绛夛級
${extraRequirements ? `\n*** 琛ュ厖瑕佹眰 / Extra Requirements ***\n${extraRequirements}` : ''}

杩斿洖JSON / Return JSON锛?{
  "products": [
    {"modelName": "鍨嬪彿鍚?, "features": {"cn":"涓枃鐗瑰緛","en":"English features"}, "titles": [{"cn":"涓枃","en":"English"}, ...]}
  ]
}`;

    msgContent.push({ type: 'text', text: userPrompt });

    const result = await callKimi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: msgContent }
    ]);

    files.forEach(f => fs.unlinkSync(f.path));

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      parsed = { products: [{ modelName: 'error', features: {cn:'',en:''}, titles: [{cn:result.slice(0, 200),en:result.slice(0, 200)}] }] };
    }

    res.json({
      success: true,
      data: parsed,
      productList: productList.map(p => ({ modelName: p.modelName, isSKC: p.isSKC, skuCount: p.skuCount }))
    });
  } catch (e) {
    if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    res.status(500).json({ error: e.message });
  }
});

// ===== 鍚姩 =====
app.listen(PORT, () => {
  console.log(`
鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽
鈺?   馃敟 TEMU鐖嗘鏍囬鐢熸垚鍣?v2 宸插惎鍔?              鈺?鈺?                                                 鈺?鈺?   璁块棶: http://localhost:${PORT}                  鈺?鈺?                                                 鈺?鈺?   鏀寔涓ょ杈撳叆鏂瑰紡锛?                            鈺?鈺?   鈶?绮樿创鍥剧墖URL + 鏍囬锛坾 鍒嗛殧锛?                鈺?鈺?   鈶?涓婁紶鏈湴鍥剧墖鏂囦欢                             鈺?鈺?                                                 鈺?鈺?   API Key: 閰嶇疆鍦?.env 鏂囦欢涓?                   鈺?鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆
  `);
});
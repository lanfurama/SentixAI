import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReviews } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

const comparisonDataPath = path.join(dataDir, 'comparison-data.json');

const EXTERNAL_API_BASE = 'http://phulonghotels.com:8000/api/public/phulong/mena_gourmet_market/comments';

/** Resort list: id = resort_id (string), name = display name. Order as provided. */
const RESORT_LIST = [
  { id: '1', name: 'Mena Gourmet Market - Menas Mall Saigon Airport' },
  { id: '10', name: 'Mena Gourmet Market - Celesta Rise' },
  { id: '12', name: 'An Nam Gourmet Nguyễn Văn Trỗi' },
  { id: '11', name: 'Menas Mall Saigon Airport' },
  { id: '14', name: 'Lamue - Menas Mall' },
  { id: '15', name: 'Mena Cosmetics & Perfumes' },
  { id: '16', name: 'MenaWorld - Menas Mall' },
  { id: '17', name: 'Sky Shop - Menas Mall' },
  { id: '18', name: 'The Fan' },
  { id: '19', name: 'V-Senses Dining Celesta Rise' },
  { id: '20', name: 'Yum Food' },
  { id: '21', name: 'Mena Gourmet market - 547 HTP' },
  { id: '13', name: "Don Cipriani's Italian Restaurant" },
  { id: '22', name: 'Saigon Oxford Bookstore - Menas Mall Saigon Airport' },
  { id: '23', name: 'Mena Gourmet Market -313 Nguyễn Thị Thập' },
  { id: '24', name: 'Siêu thị Emart - Phan Văn Trị' },
  { id: '25', name: 'Annam Gourmet Riverpark Premier' },
  { id: '26', name: 'Annam Gourmet - Saigon Centre - Takashimaya' },
  { id: '27', name: 'Annam Gourmet - Saigon Pearl' },
  { id: '28', name: 'Siêu thị Finelife Urban Hill' },
  { id: '29', name: 'Siêu thị Finelife Riviera Point' },
];

/**
 * Normalize API comment item to { author, date, content, rating, source }.
 * Supports common field names: author/reviewer/author_name, date/created_at/commented_at, content/comment/body, rating, source.
 */
function normalizeComment(item) {
  const author = item.author ?? item.reviewer ?? item.author_name ?? item.user_name ?? 'Anonymous';
  const date = item.date ?? item.created_at ?? item.commented_at ?? item.time ?? '';
  const content = item.content ?? item.comment ?? item.body ?? item.review ?? '';
  let rating = item.rating ?? item.star ?? item.score ?? 0;
  if (typeof rating === 'string') {
    const n = parseFloat(rating.replace(/\D/g, '')) || 0;
    rating = n;
  }
  const source = item.source ?? item.platform ?? 'google';
  return { author, date, content, rating, source };
}

/**
 * Convert array of comment objects to CSV string (header: author,date,content,rating,source).
 */
function commentsToCsv(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return 'author,date,content,rating,source\n';
  }
  const header = 'author,date,content,rating,source';
  const rows = comments.map((c) => {
    const { author, date, content, rating, source } = normalizeComment(c);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n\r]/.test(s) ? `"${s}"` : s;
    };
    return [esc(author), esc(date), esc(content), rating, esc(source)].join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Extract comments array from API response. Handles { data: [] }, { results: [] }, or direct array.
 */
function extractComments(body) {
  if (Array.isArray(body)) return body;
  if (body?.data && Array.isArray(body.data)) return body.data;
  if (body?.results && Array.isArray(body.results)) return body.results;
  if (body?.comments && Array.isArray(body.comments)) return body.comments;
  return [];
}

function readJson(filePath, fallback = []) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Could not read ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Could not write ${filePath}:`, err.message);
    return false;
  }
}

/** Merge one ComparisonRow into comparison-data.json (cache after analyze). */
function mergeComparisonCache(row) {
  if (!row || typeof row.id !== 'string') return false;
  const current = readJson(comparisonDataPath, []);
  const idx = current.findIndex((r) => r && r.id === row.id);
  if (idx >= 0) {
    current[idx] = row;
  } else {
    current.push(row);
  }
  return writeJson(comparisonDataPath, current);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** GET /api/datasets - Fetch from external API per resort, return RawReviewData[] (id, name, csvContent) */
app.get('/api/datasets', async (req, res) => {
  const datasets = [];
  for (const resort of RESORT_LIST) {
    try {
      const url = `${EXTERNAL_API_BASE}/${resort.id}`;
      const resp = await fetch(url);
      const body = resp.ok ? await resp.json().catch(() => ({})) : {};
      const comments = extractComments(body);
      const csvContent = commentsToCsv(comments);
      datasets.push({ id: resort.id, name: resort.name, csvContent });
    } catch (err) {
      console.warn(`Failed to fetch comments for resort ${resort.id} (${resort.name}):`, err.message);
      datasets.push({ id: resort.id, name: resort.name, csvContent: 'author,date,content,rating,source\n' });
    }
  }
  res.json(datasets);
});

/** GET /api/datasets/:resortId - Fetch one resort's comments from external API, return RawReviewData */
app.get('/api/datasets/:resortId', async (req, res) => {
  const { resortId } = req.params;
  const resort = RESORT_LIST.find((r) => r.id === resortId);
  if (!resort) {
    return res.status(404).json({ error: 'Resort not found' });
  }
  try {
    const url = `${EXTERNAL_API_BASE}/${resort.id}`;
    const resp = await fetch(url);
    const body = resp.ok ? await resp.json().catch(() => ({})) : {};
    const comments = extractComments(body);
    const csvContent = commentsToCsv(comments);
    res.json({ id: resort.id, name: resort.name, csvContent });
  } catch (err) {
    console.warn(`Failed to fetch comments for resort ${resort.id}:`, err.message);
    res.json({ id: resort.id, name: resort.name, csvContent: 'author,date,content,rating,source\n' });
  }
});

/** GET /api/comparison - Initial comparison / analysis rows */
app.get('/api/comparison', (req, res) => {
  const data = readJson(comparisonDataPath, []);
  res.json(data);
});

/** PATCH /api/comparison - Merge updates (ComparisonRow[]) by id into comparison-data.json */
app.patch('/api/comparison', (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Missing or invalid updates array' });
  }
  const current = readJson(comparisonDataPath, []);
  for (const row of updates) {
    if (!row || typeof row.id !== 'string') continue;
    const idx = current.findIndex((r) => r && r.id === row.id);
    if (idx >= 0) {
      current[idx] = row;
    } else {
      current.push(row);
    }
  }
  if (!writeJson(comparisonDataPath, current)) {
    return res.status(500).json({ error: 'Failed to save comparison data' });
  }
  res.json({ ok: true });
});

/** PATCH /api/datasets - Disabled when using API source (Option A). Returns 501. */
app.patch('/api/datasets', (req, res) => {
  res.status(501).json({ error: 'Import is disabled when using API source.' });
});

/** POST /api/analyze - Run Gemini analysis on CSV (body: { id, name, csvContent, context?: 'table'|'item' }). Saves result to comparison-data.json for cache. */
app.post('/api/analyze', async (req, res) => {
  const { id, name, csvContent, context } = req.body;
  if (!id || !name || typeof csvContent !== 'string') {
    return res.status(400).json({ error: 'Missing id, name, or csvContent' });
  }
  const analysisContext = context === 'table' ? 'table' : 'item';
  try {
    const result = await analyzeReviews(id, name, csvContent, analysisContext);
    mergeComparisonCache(result);
    res.json(result);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sentix API running at http://localhost:${PORT}`);
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReviews } from './gemini.js';
import { VENUES, getVenueById } from '../config/venues.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

const comparisonDataPath = path.join(dataDir, 'comparison-data.json');

const EXTERNAL_API_BASE = 'http://phulonghotels.com:8000/api/public/phulong/mena_gourmet_market/comments';

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
 * Extract comments array from API response. Handles { data: [] }, { results: [] }, { items: [] }, { comments: [] }, or direct array.
 */
function extractComments(body) {
  if (Array.isArray(body)) return body;
  if (body?.data && Array.isArray(body.data)) return body.data;
  if (body?.results && Array.isArray(body.results)) return body.results;
  if (body?.comments && Array.isArray(body.comments)) return body.comments;
  if (body?.items && Array.isArray(body.items)) return body.items;
  if (body?.list && Array.isArray(body.list)) return body.list;
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

/**
 * Fetch venue data from external API and convert to RawReviewData format
 * @param {Object} venue - Venue object with id, name, concept
 * @returns {Promise<Object>} RawReviewData with id, name, csvContent, concept
 */
async function fetchVenueData(venue) {
  try {
    const url = `${EXTERNAL_API_BASE}/${venue.id}`;
    console.log(`[API] Fetching: ${url}`);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[API] HTTP ${resp.status} for venue ${venue.id} (${venue.name})`);
      return { id: venue.id, name: venue.name, csvContent: 'author,date,content,rating,source\n', concept: venue.concept };
    }
    const body = await resp.json().catch(() => ({}));
    const comments = extractComments(body);
    const csvContent = commentsToCsv(comments);
    return { id: venue.id, name: venue.name, csvContent, concept: venue.concept };
  } catch (err) {
    console.warn(`[API] Failed to fetch comments for venue ${venue.id} (${venue.name}):`, err.message);
    console.warn(`[API] URL was: ${EXTERNAL_API_BASE}/${venue.id}`);
    return { id: venue.id, name: venue.name, csvContent: 'author,date,content,rating,source\n', concept: venue.concept };
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** GET /api/datasets - Fetch from external API per venue in parallel, return RawReviewData[] (id, name, csvContent, concept) */
app.get('/api/datasets', async (req, res) => {
  try {
    const results = await Promise.all(VENUES.map(fetchVenueData));
    res.json(results);
  } catch (err) {
    console.error('[API] Error in GET /api/datasets:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch datasets' });
  }
});

/** GET /api/datasets/:resortId - Fetch one venue's comments from external API, return RawReviewData */
app.get('/api/datasets/:resortId', async (req, res) => {
  try {
    const { resortId } = req.params;
    if (!resortId || typeof resortId !== 'string') {
      return res.status(400).json({ error: 'Invalid venue ID' });
    }
    const venue = getVenueById(resortId);
    if (!venue) {
      return res.status(404).json({ error: `Venue not found: ${resortId}` });
    }
    const result = await fetchVenueData(venue);
    res.json(result);
  } catch (err) {
    console.error('[API] Error in GET /api/datasets/:resortId:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch venue data' });
  }
});

/** GET /api/comparison - Initial comparison / analysis rows */
app.get('/api/comparison', (req, res) => {
  try {
    const data = readJson(comparisonDataPath, []);
    res.json(data);
  } catch (err) {
    console.error('[API] Error in GET /api/comparison:', err);
    res.status(500).json({ error: err.message || 'Failed to load comparison data' });
  }
});

/** PATCH /api/comparison - Merge updates (ComparisonRow[]) by id into comparison-data.json */
app.patch('/api/comparison', (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Missing or invalid updates array' });
    }
    const current = readJson(comparisonDataPath, []);
    for (const row of updates) {
      if (!row || typeof row.id !== 'string') {
        console.warn('[API] Skipping invalid row in comparison update:', row);
        continue;
      }
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
  } catch (err) {
    console.error('[API] Error in PATCH /api/comparison:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/** PATCH /api/datasets - Disabled when using API source (Option A). Returns 501. */
app.patch('/api/datasets', (req, res) => {
  res.status(501).json({ error: 'Import is disabled when using API source.' });
});

/** POST /api/analyze - Run Gemini analysis on CSV (body: { id, name, csvContent, context?: 'table'|'item' }). Saves result to comparison-data.json for cache. */
app.post('/api/analyze', async (req, res) => {
  try {
    const { id, name, csvContent, context } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid name' });
    }
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid csvContent' });
    }
    const analysisContext = context === 'table' ? 'table' : 'item';
    const result = await analyzeReviews(id, name, csvContent, analysisContext);
    // Add concept from VENUES config
    const venue = getVenueById(id);
    if (venue?.concept) {
      result.concept = venue.concept;
    }
    mergeComparisonCache(result);
    res.json(result);
  } catch (err) {
    console.error('[API] Analyze error:', err);
    const errorMessage = err.message || 'Analysis failed';
    res.status(500).json({ error: errorMessage });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sentix API running at http://localhost:${PORT}`);
});

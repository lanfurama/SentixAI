/**
 * Data: comparison/analysis rows live in data/comparison-data.json.
 * Raw review datasets are fetched from the API (external source), not from local files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data/ directory. comparison-data.json is the local source for comparison rows.');
} else {
  console.log('Comparison data: data/comparison-data.json. Datasets come from API.');
}

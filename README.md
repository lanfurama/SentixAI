<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1S_xsMZ1WmZqdqBVrEA7eqniSFUwbHdCW

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set Vertex AI env vars in `.env` or `.env.local` (for backend AI analysis):
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_CLOUD_LOCATION` (e.g. `us-central1`)
   - `VERTEX_AI_SERVICE_ACCOUNT_PATH` (path to service account JSON)
   - `VERTEX_AI_ENDPOINT_ID`
   - `VERTEX_AI_API_KEY`
   - Ensure Application Default Credentials are available (`gcloud auth application-default login`), or set `VERTEX_AI_SERVICE_ACCOUNT_PATH` to load credentials.
3. **Run full stack:** `npm run dev`  
   - Starts Vite (frontend at http://localhost:3000) and the API (http://localhost:3001) together.  
   - Data is served from the API (`/api/datasets`, `/api/comparison`).
4. **Optional:** `npm run dev:vite` (frontend only) or `npm run server` (API only).

## Backend API & Data

- **Data:** Review datasets are fetched from the external API (`/api/datasets`). Comparison/analysis rows are stored in `data/comparison-data.json`.
- **API** (Express, port 3001):
  - `GET /api/datasets` – raw datasets (id, name, csvContent) from external API.
  - `GET /api/comparison` – comparison data from `data/comparison-data.json`.
  - `POST /api/analyze` – body `{ id, name, csvContent }`, returns analysis (uses Vertex AI on server).
- Vite proxies `/api` to the backend in development.

# Team Toolbox (Dashboard + iFrame Viewer)

This repo hosts multiple internal HTML tools behind **one link**.

## How it works
- `index.html` is the dashboard.
- The dashboard loads `assets/tools.json` and shows a tool list.
- Clicking a tool loads it inside an `<iframe>` (right-click still opens it in a new tab).
- Deep links are supported: `index.html?tool=<tool-id>`.
- End-user documentation lives in `guide.html` (HTML) and `GUIDE.md` (Markdown).

## Add a new tool (2 minutes)
1. Copy your tool HTML file into: `tools/`
   - Prefer kebab-case filenames like `my-new-tool.html`.
2. Add an entry to `assets/tools.json`:
   ```json
   {
     "id": "my-new-tool",
     "title": "My New Tool",
     "description": "One line summary of what it does",
     "path": "./tools/my-new-tool.html",
     "icon": "🧰",
     "tags": ["Tag1", "Tag2"]
   }
   ```
3. Commit + push to GitHub Pages.

### Notes / best practices
- Keep `id` unique and URL-safe (letters, numbers, dashes).
- Use relative paths in `path` so it works under GitHub Pages subpaths.
- If your tool uses `localStorage`, **namespace** its keys to avoid clashes with other tools.

## Local testing
Because the dashboard loads `assets/tools.json` via `fetch`, you should serve it with a local web server:

- VS Code: install “Live Server” and open `index.html`
- Or run:
  - Python: `python -m http.server 8000`
  - Then open: `http://localhost:8000/index.html`

## Desktop app (Windows + macOS) for SyncApp ERP API Runner
Some internal services (SyncApp ERP) cannot be called from a browser due to CORP/CORS restrictions, so a desktop wrapper is provided.
See `desktop/README.md`.

## Current tools
- JSON Studio (side-by-side JSON editor + diff + CSV import/export + Coralogix log reconstructor + nested key-value extractor)
- String Tools • Line Breaks (list delimiter conversion + SQL IN helper)
- TSV/CSV → JSON Converter (tab-delimited → JSON)
- SQL Template Generator (CSV-driven placeholder replacement)
- Retry Specific SyncEngine (Batch Retry: calls SyncEngine `scheduleRetrySync` with batching/retries)
- Bulk Update Record State (MongoDB bulkWrite Generator for `syncengineservice_recordsyncstates`)
- SQL CASE WHEN Generator (append `ORDER BY CASE` to preserve IN-list order)
- CSV Splitter (splits CSV into multiple files, includes header in each part)
- API Key / Hash Generator (HMAC-SHA256 → Base64)

## Guide for end users
- HTML: `guide.html` (linked from the left sidebar in the dashboard)
- Markdown: `GUIDE.md`

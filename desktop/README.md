# SyncApp ERP API Runner — Desktop App (Windows + macOS)

This folder contains a **desktop wrapper** around the existing web tool `tools/syncapp-erp-api-runner.html`.

Why a desktop app?
- The SyncApp endpoints enforce `Cross-Origin-Resource-Policy: same-origin` and do not allow CORS from GitHub Pages.
- Browsers block these calls (you see `TypeError: Failed to fetch` / status `0`).
- A desktop app can run requests **outside** the browser sandbox and/or start a local proxy automatically.

## What the desktop app does
- Starts a local proxy server on `127.0.0.1:<randomPort>`
- Opens a window that loads the existing tool HTML with:
  - `?useProxy=1&proxyBaseUrl=http://127.0.0.1:<randomPort>`

So users just:
- open the app
- paste bearer token
- run single-run or runner mode

## Build notes (cross-platform)
You generally **build on each OS**:
- Windows installer/exe: build on Windows
- macOS app: build on macOS

If you want “one-click” multi-platform builds, use GitHub Actions runners for Windows + macOS.

## Local build (developer)

```bash
cd desktop
npm install
npm run dev
```

## Packaging

```bash
cd desktop
npm run dist
```

Artifacts will be created under `desktop/dist/` (varies by OS).



# Team Toolbox — Tool Guide

This guide explains what each tool does, when to use it, and what it outputs.
Everything runs in your browser (no server). Files you upload (CSV/log exports) are processed locally.

## Quick links
- [JSON Studio](#json-studio)
- [String Tools • Line Breaks](#string-tools--line-breaks)
- [TSV/CSV → JSON Converter](#tsvcsv--json-converter)
- [SQL Template Generator](#sql-template-generator)
- [Retry Specific SyncEngine (Batch Retry)](#retry-specific-syncengine-batch-retry)
- [Update SRS Generator](#update-srs-generator)
- [Bulk Update Record State (MongoDB bulkWrite Generator)](#bulk-update-record-state-mongodb-bulkwrite-generator)
- [SQL CASE WHEN Generator](#sql-case-when-generator)
- [API Key / Hash Generator](#api-key--hash-generator)
- [CSV Splitter](#csv-splitter)

---

## JSON Studio

**What it is**: A multi-purpose JSON workspace: side-by-side editors, JSON diff, CSV import/export for arrays-of-objects, Coralogix log reconstruction, and a nested key-value extractor.

**How to use**
- Choose a mode per side: **Tree / Text / Table**
- Click **Compare** to compute a “parsed JSON diff”
- Click **Beautify both** to pretty-print JSON on both sides (only if parseable)
- Use **tabs**: `+` creates tabs, double-click a tab name to rename, `×` closes tabs (when multiple exist)

**Inputs & outputs**
- Diff output shows line-by-line path differences like `$.a.b: 1 ⇢ 2`
- CSV import loads CSV into an editor as JSON and switches that side to **Table** mode
- CSV export works only when the JSON is an **array of objects**, e.g. `[{...}, {...}]`
- Tabs and editor state are stored in browser `localStorage`

**Coralogix Log Reconstructor**
- Upload a log export (JSON array, single JSON object, or NDJSON)
- Sorts entries by `LogPart`, concatenates `message` parts (removing a leading `[n]` marker)
- Attempts to parse as JSON (best-effort fix for missing closing braces/brackets)
- Downloads either `reconstructed_message.json` (valid JSON) or `reconstructed_message_raw.txt` (raw)
- Can inject the reconstructed output into left/right editor

**Nested JSON Key-Value Extractor**
- Paste a JSON **array**, refresh keys, select dot-path keys (e.g. `a.b`)
- Extracts values into a JSON array of objects
- Can load from an editor and inject extracted JSON back into an editor

---

## String Tools • Line Breaks

**What it is**: Converts lists between line breaks / commas / spaces / custom delimiter, with optional trimming, de-duplication, wrapping, and a SQL helper that builds `IN (...)` with proper quote escaping.

**How to use**
- Paste values (one per line, or comma/space separated)
- Pick conversion (e.g. line breaks → comma)
- Optional: **Trim**, **Remove duplicates**, **Wrap each item**
- Optional: enable **SQL helper** to output `IN ('a','b')`
- Click **Execute** then **Copy to clipboard**

**Notable behavior**
- Item detection: if input has newlines → split by newline; else if commas → split by comma; else split by whitespace
- Comma output can be “one per line” and can add a trailing comma
- SQL quoting uses `'...'` and escapes `'` as `''`

---

## TSV/CSV → JSON Converter

**What it is**: Converts tab-delimited text (TSV) into a JSON array of objects. The delimiter is fixed to `\t`.

**How to use**
- Paste data (first line is headers, tab-separated)
- Click **Convert**
- Click **Copy** to copy JSON output
- Click **Clear** to reset

**Output**
- Produces `[{header1:value1, header2:value2, ...}, ...]`
- Missing cells become `""`

---

## SQL Template Generator

**What it is**: Generates one SQL statement per CSV row by replacing `{placeholder}` tokens with values from CSV headers.

**How to use**
- Paste a SQL template with placeholders like `{tipaltiid}`, `{externalid}`, `{instanceid}`
- Upload a CSV file
- Click **Generate Queries**
- Click **Copy to Clipboard** to copy the result

**Important notes**
- CSV parsing is simple: split by newline, then by comma (not quote-aware)
- Replacement is global for each header: every `{HeaderName}` occurrence is replaced
- Replacement is plain text; include quotes in the template if needed

---

## Retry Specific SyncEngine (Batch Retry)

**What it is**: Calls SyncEngine’s `scheduleRetrySync` endpoint in batches, with retries, delays, a special “active sync job” wait path, and verbose logs.

**What you need**
- Environment: **Production** or **Sandbox**
- Authorization **bearer token**
- `recordType` (e.g. `Vendor`)
- ID Type: `externalId` or `tipaltiId` (auto-sets direction)
- IDs: paste values, or upload CSV (tries to find an ID-like column; else uses the first column)

**How it behaves**
- Splits IDs into batches of “IDs per batch”
- Retries failures up to “Max Retries per Batch” with a delay
- If response includes “instance has an active sync job”, waits ~1 minute (can “Manual Retry (Skip Wait)”)
- Logs payloads and results in the Results panel

**Security note**: bearer tokens are sensitive—use short-lived tokens, avoid screen sharing, and clear inputs when done.

---

## SyncApp ERP API Runner (Desktop Download)

**What it is**: A Windows/macOS desktop app that opens the same runner UI, but avoids browser CORS/CORP limitations (so SyncApp calls work reliably).

**Where to get it**: Use the “SyncApp ERP API Runner (Desktop Download)” entry in the Toolbox sidebar, or download the latest release from:
`https://github.com/yoniraf/Eng-Sup-Tools/releases/latest`

---

## Update SRS Generator

**What it is**: Generates a JSON array payload for a list of IDs (one per line):
`[{ id, direction: 2, recordType: "bill", updateSRS: true }, ...]`

**How to use**
- Paste IDs (one per line)
- Click **Generate**
- Click **Copy to Clipboard**

**Notes**
- Empty lines are ignored; IDs are trimmed
- Output is pretty-printed JSON (2-space indentation)

---

## Bulk Update Record State (MongoDB bulkWrite Generator)

**What it is**: Generates a MongoDB script for:
`db.getCollection("syncengineservice_recordsyncstates").bulkWrite([...])`
with `updateOne` operations that set a mapping field and sets `hasBeenSynced: true`.

**Inputs**
- Instance ID and Record Type (used in every `filter`)
- Pairs (one per line): supports `tipaltiId,externalId`, space-separated pairs, JSON per line, or CSV with a header
- Update direction:
  - Filter by `tipaltiId` → update `externalId`
  - Filter by `externalId` → update `tipaltiId`
- Optional: de-duplicate by filter field; optional `ordered: false` bulkWrite option

**Output**
- Copyable MongoDB script and optional `.js` download
- KPIs: count of pairs, ops, validation errors

**Important**: this tool does not execute anything—it only generates a script. Review before running.

---

## SQL CASE WHEN Generator

**What it is**: Appends an `ORDER BY CASE` clause to preserve the ordering of IDs in an `IN (...)` list.

**How to use**
- Paste a query containing `IN (...)`
- Click **Generate CASE WHEN Query**
- Copy the output

**Important notes**
- Finds the first `IN(...)` via regex (not a full SQL parser)
- The generated clause uses `ORDER BY CASE idAtPayer` (edit the column name if needed)
- Removes duplicates (keeps first-seen order); unknown values fall back to `ELSE 999`

---

## API Key / Hash Generator

**What it is**: Generates an HMAC-SHA256 hash (Base64) from `payerName + idap + timestamp + eat` using a secret `key`.

**How to use**
- Fill `payerName`, `idap`, `timestamp` and `key` (eat optional)
- Use **Generate** to fill current timestamp (milliseconds)
- Click **Generate hash**, then **Copy hash**

**Output**
- Base64-encoded HMAC-SHA256 hash

**Security note**: treat `key` as secret—clear fields after use.

---

## CSV Splitter

**What it is**: Splits a CSV into multiple smaller CSV files; each output includes the original header row.

**How to use**
- Drag & drop a `.csv` file (or click the dropzone)
- Set “Lines per file” (counts data rows; header is always included)
- Click **Split CSV**

**What happens**
- Your browser downloads multiple files like `original_part1.csv`, `original_part2.csv`, …
- CSV parsing is line-based; empty lines are ignored



# Panic Analyzer (MVP)

Local MVP web app for iPhone panic code / panic log lookup.

## Run

```bash
cd /home/odoo/panic-analyzer-mvp
npm install
npm run dev
```

Vite will try port `5174` first, and automatically pick the next free port if it’s busy.

## Database file (bundled seed)

- **Path in repo**: `public/data/panic_analyzer_mvp_data.json`
- **Loaded in app**: `fetch('/data/panic_analyzer_mvp_data.json')`

The app includes a **normalization layer** so the JSON can evolve (slightly different field names) without hardcoding data in React components.

## Browser edits / persistence

- The **Database** tab lets you add/edit/delete rules in the browser.
- Changes are stored in **localStorage** (not written to repo files).
- Use **“Reset to bundled database”** to discard local edits and reload the bundled JSON.

## Export updated JSON

- In the **Database** tab, click **“Export updated JSON”**.
- This downloads `panic_analyzer_mvp_data.json`.
- To update the repo later, **replace**:
  - `public/data/panic_analyzer_mvp_data.json`
  with your exported file, and commit it to GitHub.

## Extending fields

Internally each record is normalized into `PanicRule` in `src/types/panic.ts`.
Optional future fields (e.g. `models`, `boardLocation`, `schematicRef`, `verified`, `manualNotes`) are supported and safely ignored if missing.

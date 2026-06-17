# התורה השומרונית — גרסה וובית (Web edition)

A browser version of the Samaritan Torah app, built as a thin **Flask** backend
that **reuses the existing query layer** (`app/services/database.py`) plus a
single-page front-end. It is fully isolated from the Kivy app:

* It only ever runs `SELECT`s — it never writes to `data/torah.db`.
* It imports the project's services but changes nothing under `app/`, `main.py`
  or `buildozer.spec`. The Android/desktop app keeps working unchanged.
* It reads the **same** `data/torah.db`, so every correction already in the DB
  (Samaritan division, expansions, dictionary, Tibåt Mårqe, etc.) shows here too.

## Run locally

**Easiest (Windows):** double-click **`web/run_web.bat`** — it installs Flask if
needed, starts the server, and opens the app in your browser.

**Manual:**
```bash
pip install -r web/requirements.txt        # Flask only
py -3 web/server.py                         # → http://127.0.0.1:5000
```

(Run from the project root so `data/torah.db` and `app/` are found.)

The page is **blank/non-working only when the server is not running** — it is a
server-backed app, so `web/server.py` must be up before you open the URL.

## Feature parity

* Jewish / Samaritan division toggle; books → portions → chapters → verses;
  "פריסת פרקים" spread; breadcrumb + Back; prev/next chapter & portion.
* Verse display modes: Samaritan script (`Sam_font`), English translation,
  Masoretic-vs-Samaritan compare (red diff), פירוש הפסוק, התרגום הארמי,
  התרגום לערבית, פרשנות יהודית (רש"י/רמב"ן/קאסוטו/בעל הטורים), ממקור שומרון
  (תיבת מרקה / מן המסורת השומרונית), מילון מילים (with A. Tal dictionary popup).
* Search: exact, by-root (with editable root box + transliteration), Aramaic,
  `?` one-letter wildcard and `+` AND-terms; result links jump to either division.
* Share (WhatsApp / email / Facebook) of the current passage text.

* **פרשנים נוספים (ספריא)** — live, key-less fetch via `/api/sefaria` (reuses
  `app/services/sefaria_live.py`); works on a single selected verse.
* **מילון מילים → "הצג תוצאות ממילונים ברשת"** — live Wiktionary + Wikipedia
  via `/api/online_dict` (reuses `app/services/hebrew_dict.py`), looked up in bulk.

### PWA / installable
`manifest.json` + a service worker (`/sw.js`) cache the app shell (HTML/CSS/JS/
fonts/icons) for fast loads and "Add to Home Screen" installability. `/api/*`
always hits the network so the data stays live (this is a server-backed app, not
a fully offline DB — that would need the static sql.js architecture instead).

### Differences from the native app
* Sharing posts the passage **text** + page URL (the native app shares a PNG
  screenshot via Android intents).

## Deploy

Any Python host works (Render, Railway, Fly, a VPS, PythonAnywhere). Serve
`web/server.py` behind gunicorn/waitress and ship `data/torah.db` alongside it.
Example: `waitress-serve --port 8000 web.server:app`.

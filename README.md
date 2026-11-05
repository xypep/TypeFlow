# TypeFlow

A typing trainer that runs in the browser. Paste any text (a Wikipedia article, a news story, your own notes) and type it as fast as you can. You can also learn touch typing step by step and track your progress over time.

No build step, no framework, no runtime dependencies: just HTML, CSS and JavaScript.

| Dark (default) | Light |
|---|---|
| ![Lesson, dark theme](docs/lesson-dark.png) | ![Statistics, light theme](docs/stats-light.png) |

## Features

| Tab | What it does |
|---|---|
| **Start** | Paste a text and pick a mode: **Full text**, **Random words** (10–100), **Single words** (one big word at a time) or **Time** (15–120 s). Optional cleanup: normalize quotes and dashes, remove `[1]` references, remove punctuation, lowercase. Texts you use are saved and can be reused. |
| **Learn** | 16 touch-typing lessons, from the home row to real words. An on-screen keyboard is colored by finger, highlights the next key and shows which finger to use (including Shift). A lesson is completed once you reach the accuracy goal. |
| **Statistics** | KPIs, WPM and accuracy trend charts, a heatmap of your problem keys and the full session history. Filter by time range and by training vs. lessons. |
| **Settings** | Theme (Dark / Light / System), text size, caret style, keyboard layout (QWERTZ / QWERTY), strict mode, error sound, lesson goals, and JSON export/import/reset. |

**Shortcuts while typing:** `Tab` restarts · `Esc` stops · `Ctrl+Backspace` deletes the last word

## Getting started

Folder access requires a secure context, so serve the app locally:

```bash
python -m http.server 8000
```

or

```bash
npm start
```

Then open <http://localhost:8000> in **Chrome or Edge**.

### Login / storage

On the first screen you choose where your data lives:

- **Choose folder**: TypeFlow creates or loads `typeflow-db.json` in that folder (via the [File System Access API](https://developer.mozilla.org/docs/Web/API/Window/showDirectoryPicker)). The folder is remembered, so next time a single click on *Continue with …* is enough. Put the folder in OneDrive or Dropbox to sync between PCs.
- **Continue without folder**: data is stored in the browser (`localStorage`). This is the fallback for Firefox and Safari, which don't support folder access.

You can switch storage at any time via the chip in the top-right corner or under *Settings → Data*.

## Project structure

```
typeflow/
├─ docs/               # screenshots for this README
├─ index.html          # markup for login + all four tabs
├─ css/styles.css      # theme tokens (dark default, light) + components
├─ js/
│  ├─ db.js            # Store: folder/localStorage persistence, DB schema & migration
│  ├─ words.js         # word lists (DE/EN), sample text, TextPrep (cleanup, random words)
│  ├─ keyboard.js      # layouts, finger map, findKey/mapChar, on-screen Keyboard
│  ├─ engine.js        # TypingSession (pure logic) + TypingView (rendering, caret)
│  ├─ charts.js        # tooltip + SVG line chart
│  ├─ training.js      # Start tab + shared live-stats/result UI
│  ├─ learn.js         # lessons + exercise generator
│  ├─ stats.js         # Statistics tab
│  ├─ settings.js      # Settings tab (schema-driven)
│  └─ app.js           # login, routing, keyboard input, session recording
└─ tests/
   ├─ *.test.js        # unit tests (node:test, no dependencies)
   └─ e2e/smoke.js     # Playwright end-to-end smoke test
```

### Architecture notes

- **`TypingSession` has no DOM.** It only tracks target text, typed chars, errors, per-second samples and per-key stats. `TypingView` subscribes to its events and renders. Start and Learn share both classes.
- **Input goes through a hidden `<textarea>`** (`#key-sink`) and its `input` event. That way dead keys (`^`, `´`), IME and composed characters work like in a normal text field.
- **Lessons are defined once in QWERTZ** and mapped to other layouts by physical key position (`mapChar`).
- **Themes are just tokens.** All surfaces use `--surface`/`--surface-2`, so dark and light never mix.

## Data format

`typeflow-db.json`:

```jsonc
{
  "version": 1,
  "settings": { "theme": "dark", "layout": "qwertz", "mode": "full", ... },
  "texts":    [{ "id", "title", "content", "createdAt" }],
  "sessions": [{ "id", "date", "kind": "training|lesson", "mode", "wpm", "raw",
                 "accuracy", "errors", "correctChars", "seconds", "samples": [/* wpm per second */] }],
  "lessons":  { "<lessonId>": { "attempts", "bestWpm", "bestAcc", "completed" } },
  "keyStats": { "<char>": { "hits", "misses" } }
}
```

Missing fields are filled with defaults on load (`migrateDb`), so older files keep working.

**Metrics:** WPM = correct characters / 5 per minute · Raw WPM = all typed characters / 5 per minute · Accuracy = correct keystrokes / all keystrokes (corrected mistakes still count).

## Tests

Unit tests use Node's built-in test runner (Node 18+), with no install needed:

```bash
npm test
```

They load the browser scripts into a `vm` context and cover text cleanup, layouts and key mapping, the typing engine (WPM, accuracy, backspace, strict and time mode, with a fake clock), DB migration and the lesson generator (only keys taught so far appear).

End-to-end smoke test (starts its own server, mocks the folder picker):

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Set `SCREENSHOTS=1` to save screenshots to `tests/e2e/screenshots/`.

## Browser support

| | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| Typing, lessons, stats | ✅ | ✅ | ✅ |
| Folder storage | ✅ | ❌ (browser storage) | ❌ (browser storage) |

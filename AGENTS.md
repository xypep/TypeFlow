# AGENTS.md – Übergabe für KI-Assistenten

Diese Datei erklärt einem KI-Assistenten (Claude Code, Codex, Cursor …), wie TypeFlow aufgebaut ist, welche Regeln gelten und wie man sicher weiterentwickelt. **Vor jeder Änderung lesen.** Für Endnutzer ist das [README](README.md) gedacht.

---

## 1. Projekt in 30 Sekunden

- **Was:** Tipptrainer im Browser. Mit eigenem Text trainieren (`Start`), 10-Finger-Lektionen (`Learn`), Statistiken (`Statistics`) und Einstellungen (`Settings`).
- **Stack:** Vanilla HTML, CSS und JavaScript. **Kein Framework, keine Laufzeit-Abhängigkeiten, kein Bundler.**
- **Speicherung:** JSON-Datei `typeflow-db.json` in einem vom Nutzer gewählten Ordner (File System Access API). Fallback ist `localStorage`.
- **Auslieferung:** Quellcode in mehreren Dateien, dazu eine generierte Single-File-Version `dist/typeflow.html`.
- **Sprache:** UI-Texte, Code und Kommentare auf **Englisch**. Doku (README, diese Datei) auf Deutsch.
- **Nutzer/Owner:** GitHub `xypep`. Das Projekt ist ausdrücklich „vibe-coded“.

---

## 2. Harte Regeln (nicht brechen)

1. **Keine ES-Module, kein `import`/`export`, kein `fetch` lokaler Dateien.** Die App muss per Doppelklick über `file://` laufen, und dort scheitern Module und `fetch` an CORS. Alle Skripte sind klassische `<script>`-Dateien, die Globals definieren (`const Store = {…}`, `class TypingSession`).
2. **Die Ladereihenfolge in `index.html` ist eine Abhängigkeit:**
   `db.js → words.js → keyboard.js → engine.js → charts.js → training.js → learn.js → stats.js → settings.js → app.js`.
   Spätere Dateien nutzen Globals der früheren. `app.js` ruft am Ende `App.boot()` auf. Eine neue Datei an passender Stelle in `index.html` eintragen, der Build übernimmt die Reihenfolge automatisch.
3. **Keine Laufzeit-Abhängigkeiten hinzufügen** (keine CDN-Libraries, kein npm-Paket im Browser). Einzige externe Ressource sind die Google Fonts. Dev-Abhängigkeit ist nur `playwright`.
4. **Nach jeder Änderung an `index.html`, `css/` oder `js/` den Build ausführen:** `npm run build`. Danach `dist/typeflow.html` mit committen. Diese Datei nie von Hand bearbeiten.
5. **Kein `</script>` oder `</style>` als Text in JS oder CSS.** Das würde die Single-File-Version zerbrechen, `scripts/build-single.js` bricht dann ab.
6. **Das DB-Format nur abwärtskompatibel ändern.** Neue Felder bekommen einen Default in `DEFAULT_SETTINGS` oder `createDefaultDb()`, `migrateDb()` füllt fehlende Felder auf. Nie Felder umbenennen oder entfernen, ohne Migration in `migrateDb()`.
7. **Farben nur über Theme-Tokens** (`var(--surface)`, `var(--accent)` …) und keine festen Hex-Werte in Komponenten. Sonst passen Dark und Light nicht mehr zusammen (siehe Abschnitt 6).
8. **Vor jedem Commit müssen die Tests grün sein** (siehe Abschnitt 8).

---

## 3. Dateistruktur

```
TypeFlow/
├─ index.html              # Markup: Login + 4 Tabs (Sections mit data-page), lädt CSS/JS
├─ css/styles.css          # Theme-Tokens (Dark = :root, Light = [data-theme-resolved="light"]) + Komponenten
├─ js/
│  ├─ db.js                # Store (Persistenz), DEFAULT_SETTINGS, createDefaultDb, migrateDb, Idb, uid
│  ├─ words.js             # WORDS.de / WORDS.en, SAMPLE_TEXT, TextPrep.clean / words / randomWords
│  ├─ keyboard.js          # LAYOUTS, FINGER_NAMES, findKey, mapChar, keyLabel, escapeHtml, class Keyboard
│  ├─ engine.js            # class TypingSession (Logik), class TypingView (DOM), beep, fmtTime
│  ├─ charts.js            # Tooltip, lineChart (SVG + Hover-Crosshair), niceStep
│  ├─ training.js          # MODE_DESC, MODE_NAMES, SessionUI (Live-Panel + Ergebnis), Training (Start-Tab)
│  ├─ learn.js             # LESSONS, Learn (Lektionsliste, generate, startLesson, finish)
│  ├─ stats.js             # Stats (KPIs, Charts, Heatmap, History), tile, fmtDate, fmtDuration
│  ├─ settings.js          # SETTINGS_SCHEMA (deklarativ), Settings (Render, Export/Import/Reset)
│  └─ app.js               # App: boot/Login, Routing, Tastatur-Input, activate/deactivate, recordSession, toast
├─ scripts/build-single.js # inlined CSS + JS → dist/typeflow.html
├─ dist/typeflow.html      # GENERIERT – nicht bearbeiten
├─ tests/
│  ├─ load.js              # lädt Browser-Skripte in einen node:vm-Kontext, fakeClock()
│  ├─ *.test.js            # Unit-Tests (node:test)
│  └─ e2e/smoke.js         # Playwright-Smoke-Test (Quellcode via http oder Single-File via file://)
├─ docs/images/            # Screenshots fürs README
├─ README.md · LICENSE (MIT) · AGENTS.md · CLAUDE.md · package.json · .gitignore
```

---

## 4. Architektur und Datenfluss

### 4.1 Start und Login (`app.js`, `db.js`)

```
App.boot()
 ├─ Store.rememberedFolder()        → zeigt „Continue with …“, falls ein Handle in IndexedDB liegt
 ├─ Choose folder  → Store.pickFolder()    → showDirectoryPicker → _useFolder → typeflow-db.json laden/anlegen
 ├─ Continue with  → Store.resumeFolder()  → queryPermission/requestPermission (braucht User-Geste)
 └─ Browser storage → Store.useLocal()
→ App.enter() → applySettings, Module einmalig initialisieren, Routing
```

- `Store.data` ist **die** zentrale Datenstruktur im Speicher. Ändern, dann `Store.save()` aufrufen (gebündelt, 400 ms). `Store.saveNow()` schreibt sofort und gibt ein Promise zurück.
- Schreibvorgänge werden über `_writing` verkettet, damit zwei Saves nie gleichzeitig in die Datei schreiben.
- `App.logout()` führt zurück zum Login (Speicherort wechseln). `App.reloadModules()` baut die UI nach Import oder Speicherortwechsel neu auf.

### 4.2 Tippen: Input → Session → View

```
Tastendruck
 └─ #key-sink (verstecktes <textarea>, immer fokussiert während einer Session)
     ├─ 'input'-Event   → App.active.session.input(ch)   (pro Zeichen; Dead Keys / IME funktionieren)
     └─ 'keydown'-Event → Backspace (Ctrl/Alt/Meta = Wort) · Tab → onTab · Esc → onEscape · Enter ignoriert
TypingSession  (reine Logik, KEIN DOM)
 └─ emit('change' | 'start' | 'reject' | 'extend' | 'finish')
TypingView     (rendert Spans pro Zeichen, Caret, Scrollen, Meta-Zeile)
 └─ onMeta(stats) → SessionUI.updateLive(panel, …)
finish → Training.finish / Learn.finish → App.recordSession(session, extra) → Store.data.sessions + keyStats
```

- **`App.activate({ session, view, onTab, onEscape })`** verbindet eine Session mit der Tastatur, **`App.deactivate()`** löst sie wieder. Es ist immer nur eine Session aktiv.
- **`App.resultKeys = { onTab }`**: `Tab` auf dem Ergebnis-Screen startet neu.
- **Beim Tab-Wechsel** (`App.go`) wird eine laufende Session abgebrochen.

### 4.3 `TypingSession` – wichtige Details (`engine.js`)

| Thema | Verhalten |
|---|---|
| `typed[]` | Zeichen, die der Nutzer an Position i getippt hat. `pos = typed.length` |
| `keystrokes` / `errors` | jeder Zeichen-Tastendruck bzw. jeder falsche. Korrigierte Fehler bleiben gezählt |
| WPM | `correctChars / 5 / Minuten`. **Nenner mindestens 1 Sekunde**, gegen absurde Werte nach dem 1. Tastendruck |
| Raw WPM | `typed.length / 5 / Minuten` |
| Accuracy | `(keystrokes - errors) / keystrokes`, 1 Nachkommastelle |
| `strict` | falsche Taste wird nicht übernommen, `emit('reject')` |
| `timeLimit` | Time-Mode: Text wird über `moreText()` verlängert (`emit('extend')`), Ende in `tick()` |
| `samples` | ein Eintrag pro Sekunde (`tick()` alle 250 ms aus der View) plus Rest-Sample bei `finish()` |
| `keyStats` | pro erwartetem Zeichen `{hits, misses}`, **nur der erste Versuch je Position** zählt |

### 4.4 `TypingView` – Stolperfallen

- Jedes Zeichen ist ein `<span class="ch">`. Wörter liegen in `<span class="word">` (`white-space: nowrap`), Leerzeichen sind `<span class="ch sp">`. So bricht die Zeile nur zwischen Wörtern um.
- **Single-Mode:** nur CSS (`.typing.single .word.current`), die View setzt `current` auf das aktuelle Wort.
- **Caret** wird absolut über `offsetLeft/offsetTop` positioniert. **Nach dem Laden der Web-Fonts neu messen** (`document.fonts` → `_onResize`), sonst steht der Caret falsch.
- **Scrollen:** Der Viewport zeigt 3 Zeilen, `typing-inner` wird per `translateY` verschoben, sodass der Caret in Zeile 2 steht.
- `destroy()` räumt Interval und Listener auf. Immer aufrufen, bevor eine neue View erzeugt wird (`Training.cleanupSession`, `Learn.cleanup`).

### 4.5 Module neu initialisieren

`Training.init()` und `Learn.init()` können mehrfach laufen (`App.reloadModules`). Deshalb hängen Event-Handler dort per **Zuweisung** (`el.onclick = …`, `el.oninput = …`) statt per `addEventListener`, damit keine doppelten Listener entstehen. Bei neuen Handlern in `init()` dasselbe Muster verwenden.

---

## 5. Datenmodell (`typeflow-db.json`)

```jsonc
{
  "version": 1,
  "createdAt": "ISO-Datum",
  "settings": { /* siehe DEFAULT_SETTINGS in js/db.js */ },
  "texts":    [{ "id", "title", "content", "createdAt" }],          // max. 30, älteste fliegt raus
  "sessions": [{
      "id", "date", "kind": "training" | "lesson",
      "mode": "full" | "random" | "single" | "time" | "lesson",
      "lessonId"?, "textTitle", "timeLimit"?,
      "wpm", "raw", "accuracy", "errors", "correctChars", "incorrectChars",
      "keystrokes", "seconds", "samples": [/* WPM pro Sekunde */]
  }],
  "lessons":  { "<lessonId>": { "attempts", "bestWpm", "bestAcc", "completed" } },
  "keyStats": { "<char>": { "hits", "misses" } }
}
```

- `lessonId` ist die `id` aus `LESSONS` (z. B. `home-l`, `umlaut`). **IDs nie ändern**, sonst geht der Fortschritt verloren.
- Sessions mit weniger als 2 getippten Zeichen werden im Training nicht gespeichert.

---

## 6. Design-System

- **Zwei Themes, Dark ist Standard.** Die Tokens stehen in `css/styles.css`, `:root` enthält Dark, `:root[data-theme-resolved="light"]` enthält Light.
- `App.applySettings()` setzt `data-theme-resolved` auf `dark` oder `light`. `system` folgt `prefers-color-scheme`.
- **Flächen:** `--bg` (Seite) · `--surface` (Nav, Karten, Panel) · `--surface-2` (Tiles, Inputs, Tasten) · `--surface-3` (Hover). Linien: `--line`, `--line-strong`.
- **Text:** `--text`, `--muted`, `--untyped` (noch nicht getippte Zeichen).
- **Akzent:** `--accent` (Orange), `--accent-soft`, `--on-accent`. Status: `--ok`, `--err`, `--err-soft`.
- **Finger-Farben** der Tastatur: `--f0` bis `--f4` (Pinky, Ring, Middle, Index, Thumb), bewusst gedämpft.
- **Regel:** Nav, Inhaltsbereich und Panel nutzen dieselben Flächen. **Keine Mischung aus hellen und dunklen Bereichen innerhalb eines Themes.** Das war ausdrücklicher Nutzerwunsch.
- Der Login (dunkle Karte, orangener Akzent) gefiel dem Nutzer. Er ist die Stil-Referenz.

---

## 7. Typische Aufgaben – Kochrezepte

### Neue Einstellung

1. Default in `DEFAULT_SETTINGS` (`js/db.js`) eintragen.
2. Eintrag in `SETTINGS_SCHEMA` (`js/settings.js`) mit `type` `text`, `switch`, `range` oder `seg`. Das Rendern passiert automatisch.
3. Die Wirkung im jeweiligen Modul über `Store.data.settings.<key>` auslesen. Bei globaler Wirkung (CSS-Variable, Theme) in `App.applySettings()` umsetzen.
4. Test in `tests/db-learn.test.js` ergänzen (Default vorhanden).

### Neuer Trainings-Mode

1. Button in `#mode-seg` (`index.html`), Text in `MODE_DESC` und `MODE_NAMES` (`training.js`).
2. Text erzeugen in `Training.buildConfig()` (`cfg.text`, ggf. `timeLimit`, `moreText`, `single`, `wordCount`).
3. Optionen ein- und ausblenden in `Training.syncModeUi()`.
4. Falls nötig, Stats-Anzeige anpassen (`MODE_NAMES` wird auch in der History genutzt).

### Neue Lektion

- Objekt in `LESSONS` (`learn.js`) an der passenden Stelle: `{ id, title, keys }`, `keys` in **QWERTZ-Zeichen**.
- Flags: `only: 'qwertz'`, `punct`, `caps`, `numbers`, `real`, `noMap` (Tasten nicht auf andere Layouts umrechnen).
- Erlaubte Zeichen sind kumulativ (`allowedUpTo`). Der Test „early lessons only use keys taught so far“ prüft das für beide Layouts.

### Neues Tastatur-Layout

- In `LAYOUTS` (`keyboard.js`): `rows`, `shift` und `fingers` müssen pro Reihe gleich lang sein (wird getestet), dazu `lang` für die Wortliste und `home`.
- `mapChar` geht davon aus, dass QWERTZ in der unteren Reihe eine Taste mehr hat (`<`). Bei neuen Layouts prüfen.
- Option in `SETTINGS_SCHEMA` → `layout` ergänzen.

### Neue Statistik / neues Chart

- `lineChart(el, points, opts)` in `charts.js`: eine Serie, Hover-Crosshair inklusive. **Nie zwei y-Achsen in einem Chart.** Zwei Größen kommen in zwei Charts.
- Daten kommen aus `Stats.filtered()`.

---

## 8. Befehle und Tests

```bash
npm test                  # Unit-Tests (node:test, keine Installation nötig)
npm run build             # dist/typeflow.html neu erzeugen
npm install               # nur für E2E (playwright)
npx playwright install chromium
npm run test:e2e          # Smoke-Test gegen Quellcode (eigener http-Server)
npm run test:e2e:single   # Smoke-Test gegen dist/typeflow.html über file://
python -m http.server 8000   # manuell testen → http://localhost:8000
```

- **Unit-Tests** laden die Browser-Dateien über `tests/load.js` in einen `vm`-Kontext. Top-level-`const`/`class` sind dort als Ausdrücke erreichbar: `run('TextPrep')`. Code, der beim Laden DOM braucht, lässt sich so nicht testen. **Pure Logik deshalb vom DOM getrennt halten**, wie bei `TypingSession` und `TypingView`.
- Zeitabhängiges mit `fakeClock()` testen, das ersetzt `performance.now`.
- **E2E** ersetzt `window.showDirectoryPicker` durch einen In-Memory-Mock (`window.__files`). Der echte Ordner-Dialog ist **nicht** automatisiert getestet.
- Speichern ist gebündelt (400 ms). In E2E-Tests mit `waitForFunction` auf die Datei warten, nicht direkt lesen.

### Checkliste vor jedem Commit

- [ ] `npm test` grün
- [ ] `npm run build` ausgeführt, `dist/typeflow.html` mit committet
- [ ] bei UI-Änderungen: `npm run test:e2e` und `npm run test:e2e:single` grün, Screenshot in **beiden** Themes angesehen (`SCREENSHOTS=1`)
- [ ] README aktualisiert, wenn sich Features, Hotkeys, Settings oder das DB-Format geändert haben
- [ ] keine festen Farben, keine neuen Abhängigkeiten, keine ES-Module

---

## 9. Git-Konventionen

- Branch `main`. Commit-Messages auf Englisch, Betreffzeile im Imperativ (`Add …`, `Fix …`), darunter Stichpunkte.
- Nicht pushen oder PRs erstellen, ohne dass der Nutzer es verlangt.
- `tests/e2e/screenshots/` und `node_modules/` sind in `.gitignore`.

---

## 10. Bekannte Grenzen und offene Punkte

- Ordner-Speicherung gibt es nur in Chromium-Browsern (Chrome/Edge). Firefox/Safari fallen auf `localStorage` zurück.
- In einem iframe blockiert der Browser `showDirectoryPicker` (`SecurityError`). Der Login zeigt dann einen Hinweis.
- Eingefügter Text wird zu einer Zeile zusammengefasst (`TextPrep.clean` ersetzt alle Whitespace-Folgen durch ein Leerzeichen). Zeilenumbrüche als `Enter` werden nicht unterstützt.
- Die Wortliste richtet sich nach dem Layout (`qwertz` → Deutsch, `qwerty` → Englisch). Die Umlaut-Lektion gibt es nur bei QWERTZ.
- Ohne Internet werden die Systemschriften statt Inter / JetBrains Mono genutzt.
- Releases: `v1.0.0` ist das erste. Für ein neues Release erst `npm run build`, die `version` in `package.json` und die Badge im README anheben, dann ein Release mit `dist/typeflow.html` als Asset erstellen.
- Die Roadmap im README enthält noch die Platzhalter `[GEPLANTES FEATURE]`.

### Mögliche nächste Schritte (Ideen, nicht beauftragt)

Erst mit dem Nutzer abstimmen, bevor etwas davon umgesetzt wird:

- **Schwache Tasten üben:** Übungstext aus den schlechtesten `keyStats` erzeugen.
- **Eigene Lektionen** oder ein „Free practice“-Mode in `Learn`.
- **Zeilenumbrüche optional** als `Enter`-Zeichen behalten.
- **Deutsche UI** (i18n-Objekt für alle Strings).
- **GitHub Action**, die bei jedem Push `npm test` ausführt und prüft, ob `dist/typeflow.html` aktuell ist.
- **Fonts lokal einbetten** (Base64 im Single-File), damit es offline gleich aussieht. Achtung: Dateigröße.

---

## 11. Arbeitsweise mit dem Nutzer

- Antworten in der Sprache des Nutzers (meist Deutsch). UI-Labels und Code-Bezeichner bleiben Englisch.
- Kurz und strukturiert antworten (Überschriften, Bullet Points, Codeblöcke).
- **Vor größeren Coding-Aufgaben Rückfragen stellen**, wenn der Ansatz unklar ist. Bessere oder einfachere Alternativen vorschlagen.
- Der Nutzer arbeitet hauptsächlich mit C# / WPF / .NET und Python. JavaScript-Besonderheiten bei Bedarf kurz erklären.

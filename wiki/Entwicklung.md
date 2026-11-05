# Entwicklung

TypeFlow besteht aus Vanilla HTML, CSS und JavaScript, **ohne Framework, ohne Laufzeit-Abhängigkeiten und ohne Bundler**. Ausführliche Regeln für Mitwirkende und KI-Assistenten stehen in [`AGENTS.md`](https://github.com/xypep/TypeFlow/blob/main/AGENTS.md).

## Struktur

```
index.html              Markup (Login + 4 Tabs)
css/styles.css          Theme-Tokens (Dark/Light) + Komponenten
js/db.js                Speicherung (Ordner / localStorage), DB-Schema, Migration
js/words.js             Wortlisten, Text-Cleanup
js/keyboard.js          Layouts, Finger-Zuordnung, Bildschirm-Tastatur
js/engine.js            TypingSession (Logik) + TypingView (Darstellung)
js/charts.js            SVG-Charts + Tooltip
js/training.js          Start-Tab
js/learn.js             Learn-Tab + Lektions-Generator
js/stats.js             Statistics-Tab
js/settings.js          Settings-Tab
js/app.js               Login, Routing, Tastatur-Eingabe
scripts/build-single.js baut dist/typeflow.html
tests/                  Unit-Tests (node:test) + E2E (Playwright)
wiki/                   Quelle dieses Wikis
```

## Befehle

```bash
python -m http.server 8000      # lokal starten → http://localhost:8000
npm run build                   # dist/typeflow.html neu bauen
npm test                        # Unit-Tests (ohne Installation)
npm install && npx playwright install chromium
npm run test:e2e                # E2E gegen den Quellcode
npm run test:e2e:single         # E2E gegen dist/typeflow.html (file://)
```

> [!IMPORTANT]
> Nach jeder Änderung an `index.html`, `css/` oder `js/` muss `npm run build` laufen und `dist/typeflow.html` mit committet werden. Die Release-Action bricht sonst ab.

## Release erstellen

1. `version` in `package.json` und die Badge im README anheben (z. B. `1.0.1`)
2. Optional Release-Notes in `.github/release-notes/v1.0.1.md` anlegen (sonst werden sie automatisch erzeugt)
3. `npm run build`, Tests laufen lassen, committen und auf `main` pushen

Die GitHub Action **Release** erkennt die neue Version, führt die Tests aus, prüft, dass `dist/typeflow.html` aktuell ist, und erstellt Tag `v1.0.1` und das Release mit `typeflow.html` als Download. Gibt es das Release schon, macht sie nichts. Manuell starten geht unter *Actions → Release → Run workflow*.

## Dieses Wiki bearbeiten

Die Seiten liegen im Repo unter [`wiki/`](https://github.com/xypep/TypeFlow/tree/main/wiki). Bei jedem Push auf `main`, der `wiki/` ändert, kopiert die GitHub Action **Wiki** sie ins GitHub-Wiki. Änderungen direkt im Wiki werden dabei überschrieben, also immer in `wiki/` bearbeiten.

## Lizenz

[MIT](https://github.com/xypep/TypeFlow/blob/main/LICENSE)

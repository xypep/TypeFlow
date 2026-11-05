# Installation

## Variante 1 – Eine HTML-Datei (empfohlen)

1. Die neueste [`typeflow.html`](https://github.com/xypep/TypeFlow/releases/latest/download/typeflow.html) von den [Releases](https://github.com/xypep/TypeFlow/releases) herunterladen
2. Einen Ordner anlegen, z. B. `MeinTypeFlow/`, und die Datei hineinlegen
3. Per Doppelklick öffnen

```
MeinTypeFlow/
├─ typeflow.html       ← die App
└─ typeflow-db.json    ← wird beim ersten Login angelegt
```

Die Datei enthält die komplette App (alle CSS- und JS-Dateien eingebettet). Sie braucht keinen Server und keine Installation.

## Variante 2 – Aus dem Quellcode

```bash
git clone https://github.com/xypep/TypeFlow.git
cd TypeFlow
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Mehr dazu unter [Entwicklung](Entwicklung).

## Browser-Unterstützung

| | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| Tippen, Lektionen, Statistiken | ✅ | ✅ | ✅ |
| Speicherung im Ordner | ✅ | ❌ (nur Browser-Speicher) | ❌ (nur Browser-Speicher) |

Die Schriften `Inter` und `JetBrains Mono` kommen von Google Fonts. Ohne Internet werden die Systemschriften verwendet, die App funktioniert trotzdem.

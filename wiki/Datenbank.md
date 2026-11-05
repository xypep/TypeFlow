# Datenbank (`typeflow-db.json`)

Alle Daten liegen in **einer** JSON-Datei im gewählten Ordner (bzw. im `localStorage` unter dem Schlüssel `typeflow-db`). Gespeichert wird automatisch, kurz nach jeder Änderung.

## Aufbau

```jsonc
{
  "version": 1,
  "createdAt": "2026-11-05T19:30:00.000Z",
  "settings": {
    "name": "", "theme": "dark", "layout": "qwertz", "fontSize": 26,
    "caret": "line", "smoothCaret": true, "showKeyboardTraining": false,
    "strict": false, "sound": false, "lessonAccuracy": 95, "lessonLength": 30,
    "mode": "full", "words": 25, "time": 30,
    "normalize": true, "removeRefs": true, "removePunct": false, "lowercase": false
  },
  "texts": [
    { "id": "…", "title": "Die Sonne scheint hell…", "content": "…", "createdAt": "…" }
  ],
  "sessions": [
    {
      "id": "…", "date": "…", "kind": "training", "mode": "random", "textTitle": "…",
      "wpm": 62, "raw": 66, "accuracy": 96.4, "errors": 5,
      "correctChars": 140, "incorrectChars": 3, "keystrokes": 148, "seconds": 27.3,
      "samples": [40, 55, 61]
    }
  ],
  "lessons":  { "home-l": { "attempts": 3, "bestWpm": 34, "bestAcc": 98.5, "completed": true } },
  "keyStats": { "e": { "hits": 412, "misses": 9 } }
}
```

| Feld | Inhalt |
|---|---|
| `sessions[].kind` | `training` oder `lesson` |
| `sessions[].mode` | `full`, `random`, `single`, `time` oder `lesson` |
| `sessions[].lessonId` / `timeLimit` | nur bei Lektionen bzw. im `Time`-Mode |
| `sessions[].samples` | WPM pro Sekunde (für das Ergebnis-Chart) |
| `lessons` | Fortschritt pro Lektion (Schlüssel = Lektions-ID) |
| `keyStats` | Treffer und Fehler pro Zeichen (nur erster Versuch je Position) |

Fehlende Felder werden beim Laden automatisch mit Standardwerten ergänzt. Ältere Dateien funktionieren also auch nach Updates.

## Berechnung

| Kennzahl | Formel |
|---|---|
| **WPM** | korrekte Zeichen ÷ 5 ÷ Minuten |
| **Raw WPM** | alle getippten Zeichen ÷ 5 ÷ Minuten |
| **Accuracy** | (Anschläge − Fehlanschläge) ÷ Anschläge. Korrigierte Fehler zählen trotzdem |

Ein „Wort“ zählt als 5 Zeichen (inklusive Leerzeichen). Für die Berechnung wird mindestens 1 Sekunde angesetzt, damit nach dem ersten Tastendruck keine absurden Werte entstehen.

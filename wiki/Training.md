# Training (`Start`-Tab)

Hier trainierst du mit **deinem eigenen Text**, z. B. einer Wikipedia-Seite, einem Artikel oder eigenen Notizen.

## Ablauf

1. Text in das große Feld einfügen oder `✨ Sample text` wählen
2. Rechts Mode und Optionen wählen
3. `Start` drücken und direkt lostippen. Ist das Feld leer, heißt der Button `Start with sample text`
4. Am Ende erscheint das Ergebnis

Über dem Feld steht, wie viele Wörter und Zeichen der bereinigte Text hat.

## Modes

| Mode | Beschreibung | Optionen |
|---|---|---|
| `Full text` | Der ganze Text von Anfang bis Ende | – |
| `Random` | Zufällige Wörter aus deinem Text | 10 / 25 / 50 / 100 Wörter |
| `Single` | Immer nur **ein** großes Wort, darunter das nächste als Vorschau | 10 / 25 / 50 / 100 Wörter |
| `Time` | So viel wie möglich, bis die Zeit abläuft. Der Text wird endlos mit zufälligen Wörtern verlängert | 15 / 30 / 60 / 120 s |

## Text-Cleanup

| Option | Wirkung | Standard |
|---|---|---|
| `Normalize quotes & dashes` | „“ ‚‘ » « → `"` `'`, – — → `-`, … → `...`, geschützte Leerzeichen und weiche Trennstriche werden bereinigt | an |
| `Remove references [1]` | entfernt Verweise wie `[1]`, `[a]`, `[citation needed]`, `[Bearbeiten]`, `[edit]` | an |
| `Remove punctuation` | entfernt Satzzeichen (Buchstaben, Zahlen, `'` und `-` bleiben) | aus |
| `Lowercase` | alles klein | aus |

Zeilenumbrüche und mehrere Leerzeichen werden **immer** zu einem einzelnen Leerzeichen zusammengefasst.

## Gespeicherte Texte

Jeder eingefügte Text wird beim Start gespeichert und erscheint unter **Saved texts** als Chip. Ein Klick lädt ihn wieder, `×` löscht ihn. Es werden maximal 30 Texte gespeichert, danach fällt der älteste weg.

## Während des Tippens

- **Tippbereich:** richtig getippte Zeichen werden hell, falsche rot markiert (das erwartete Zeichen bleibt sichtbar). Der Caret ist orange.
- **Oben links:** Fortschritt in % bzw. Wörter `x/y` bzw. Restzeit. **Oben rechts:** aktuelle WPM und Accuracy.
- **Panel rechts (Live):** `WPM`, `Accuracy`, `Time` bzw. `Remaining`, `Errors`, `Progress`, dazu die Buttons `Restart` und `Stop`.
- Wenn der Tippbereich den Fokus verliert, erscheint *„Click here or press any key to focus“*. Einfach weitertippen.
- Optional ist die Bildschirm-Tastatur einblendbar (`Settings` → `Keyboard in training`).

## Ergebnis

- **WPM**, **Accuracy** und **Raw WPM**
- `Time`, `Correct / wrong chars`, `Wrong key presses`, `Keystrokes`
- **Speed over time:** WPM pro Sekunde, rote Punkte markieren Fehler (Hover zeigt Details)
- **Most missed keys:** die am häufigsten verfehlten Tasten
- `Again` (oder `Tab`) startet neu: gleicher Text bei `Full text`, neue Zufallswörter bei den anderen Modes. `New text` führt zurück zum Textfeld.

Sessions mit weniger als 2 getippten Zeichen werden nicht gespeichert.

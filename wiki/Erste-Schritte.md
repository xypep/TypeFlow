# Erste Schritte

## Login: Speicherort wählen

Beim Start erscheint der Login mit zwei Möglichkeiten:

| Button | Was passiert |
|---|---|
| `Choose folder` | Ordner wählen. TypeFlow legt dort `typeflow-db.json` an oder lädt eine vorhandene. **Empfohlen.** |
| `Continue without folder (browser storage)` | Daten werden nur im Browser gespeichert (`localStorage`). |

Beim nächsten Start erscheint **`Continue with „<Ordner>“`**. Ein Klick genügt, der Browser fragt dabei kurz nach der Berechtigung für den Ordner.

> [!TIP]
> Liegt der Ordner in OneDrive, Dropbox o. Ä., wird die Datenbank automatisch zwischen PCs synchronisiert.

## Speicherort wechseln

- Klick auf den Chip oben rechts in der Navigation (z. B. `📁 MeinTypeFlow`)
- oder `Settings` → `Data` → `Switch storage…`

Du landest wieder im Login und kannst einen anderen Ordner oder den Browser-Speicher wählen.

## Daten sichern

`Settings` → `Data` → `Export JSON` lädt die komplette Datenbank als `typeflow-export-<Datum>.json` herunter. Mit `Import JSON` lässt sie sich wiederherstellen.

> [!WARNING]
> `Import JSON` ersetzt **alle** aktuellen Daten. `Reset…` löscht Sessions, Lektions-Fortschritt und Key-Stats (Settings und Texte bleiben). Beides lässt sich nicht rückgängig machen.

> [!CAUTION]
> Im Browser-Speicher gehen die Daten verloren, wenn du die Website-Daten oder den Cache löschst.

## Aufbau der Oberfläche

- **Navigation oben:** `Learn` · `Start` · `Statistics` · `Settings`, rechts der Speicherort
- **Links:** Inhalt (Text, Tippbereich, Ergebnis, Lektionen)
- **Rechts:** Panel mit Session-Einstellungen, während des Tippens Live-Stats

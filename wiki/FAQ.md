# FAQ & Fehlerbehebung

### `Choose folder` ist ausgegraut
Dein Browser unterstützt keine Ordnerauswahl (Firefox, Safari). Nutze Chrome oder Edge, oder `Continue without folder (browser storage)`.

### „Folder access is blocked here (embedded page)…“
Die Seite läuft eingebettet (z. B. in einem iframe oder einer Vorschau). Öffne `typeflow.html` direkt per Doppelklick oder über `http://localhost`.

### „typeflow-db.json exists but is not valid JSON.“
Die Datei im Ordner ist beschädigt. Ersetze sie durch einen Export (`Import JSON`), oder benenne sie um, dann legt TypeFlow eine neue an.

### „⚠ Could not save to the folder — check permissions“
Der Browser darf nicht mehr in den Ordner schreiben. Über den Chip oben rechts zurück zum Login und `Continue with …` bzw. `Choose folder` erneut wählen.

### Der Browser fragt bei jedem Start nach der Berechtigung
Das ist normal. Aus Sicherheitsgründen muss der Zugriff auf einen Ordner nach einem Neustart neu bestätigt werden.

### Meine Tasten kommen nicht an
Klick einmal in den Tippbereich oder drück eine beliebige Taste, solange *„Click here or press any key to focus“* angezeigt wird.

### Meine Zeilenumbrüche sind weg
Absicht. Eingefügter Text wird zu einer Zeile zusammengefasst, `Enter` muss nicht getippt werden.

### Die Schrift sieht anders aus
Ohne Internet werden statt `Inter` / `JetBrains Mono` die Systemschriften verwendet.

### Wo ist die Umlaut-Lektion?
Sie gibt es nur beim Layout `QWERTZ (DE)` (`Settings` → `Keyboard layout`).

### Kann ich meine Daten auf einen anderen PC mitnehmen?
Ja. Entweder den Ordner samt `typeflow-db.json` kopieren bzw. per Cloud synchronisieren, oder `Export JSON` und auf dem anderen PC `Import JSON`.

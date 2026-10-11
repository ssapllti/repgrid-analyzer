# RepGrid Analyzer

Eine browserbasierte Anwendung zur Erhebung und automatisierten Auswertung von **Repertory Grids** (Kelly, 1955). Erhobene Daten werden statistisch ausgewertet, visualisiert und über **mehrere Erhebungszeitpunkte** hinweg verglichen – vollständig clientseitig, ohne Server, ohne Build-Schritt, ohne externe Bibliotheken.

**Live-Demo:** `index.html` im Browser öffnen oder über GitHub Pages bereitstellen (siehe unten).

## Funktionen

### Datenerfassung
- Elemente (Spalten) und bipolare Konstrukte (Zeilen) frei definieren
- Bewertungsskala konfigurierbar (z. B. 1–5, 1–7)
- Beliebig viele Erhebungszeitpunkte; ein neuer Zeitpunkt übernimmt das letzte Grid als Vorlage
- Import und Export als JSON (kompletter Datensatz) oder CSV (ein Grid)
- Speicherung im Browser (localStorage), fiktiver Beispieldatensatz mit drei Zeitpunkten

### Automatisierte Auswertung je Zeitpunkt
| Verfahren | Umsetzung |
|---|---|
| Deskriptive Statistik | Mittelwert, SD, Spannweite und Extremitätsanteil je Konstrukt und Element |
| Konstruktkorrelationen | Pearson-Korrelation aller Konstruktpaare (Heatmap) |
| Elementdistanzen | Euklidische Distanz der Bewertungsprofile, normiert auf 0–1 |
| Hauptkomponentenanalyse | Zentrierung je Konstrukt, Eigenwertzerlegung (Jacobi), Biplot mit Elementen und Konstruktachsen, Eigenwert-Tabelle |
| Clusteranalyse | Hierarchisch-agglomerativ (Average Linkage) für Elemente und Konstrukte, Dendrogramme, clustersortierte Matrix |
| Strukturindizes | Differenziertheit (Bieri), Intensität (Bannister), Extremität, Varianz der 1. Komponente (PVAFF), Distanz eines Elementpaares (z. B. Selbst ↔ Ideal) |

### Vergleich von Erhebungszeitpunkten
- Differenzmatrix (B − A) als divergierende Heatmap mit Zellen-Tooltips
- Kennzahlen: Übereinstimmung (Korrelation aller Zellen), mittlere Änderung, Anteil veränderter Zellen, größte Einzeländerung
- Mittlere Verschiebung je Element und je Konstrukt
- Verlauf aller Elemente im **gemeinsamen Konstruktraum** (Hauptkomponentenanalyse über alle Zeitpunkte, Trajektorien)
- Strukturindizes im Zeitverlauf (Liniendiagramm + Tabelle)
- Bewertungsmatrizen nebeneinander

## Nutzung

```bash
git clone https://github.com/<benutzer>/repgrid-analyzer.git
cd repgrid-analyzer
python3 -m http.server 8000   # oder index.html direkt öffnen
```

Dann `http://localhost:8000` aufrufen. Beim ersten Start ist der Beispieldatensatz geladen.

### Veröffentlichung über GitHub Pages
Repository-Einstellungen → *Pages* → Source: `main`, Ordner `/ (root)`. Die Anwendung ist danach unter `https://<benutzer>.github.io/repgrid-analyzer/` erreichbar.

## Datenformat

```json
{
  "title": "Fall A",
  "scale": { "min": 1, "max": 5 },
  "elements": ["Ich selbst", "Ideal-Ich", "Mutter"],
  "constructs": [{ "left": "ruhig", "right": "nervös" }],
  "timepoints": [
    { "id": "T1", "label": "T1 Beginn", "date": "2025-02-03", "ratings": [[4, 1, 4]] }
  ]
}
```

`ratings` ist eine Matrix Konstrukte × Elemente. CSV-Dateien haben die Kopfzeile `Linker Pol;Element 1;…;Element n;Rechter Pol` und je Konstrukt eine Zeile.

## Projektstruktur

```
index.html        Oberfläche
css/style.css     Gestaltung, helles und dunkles Farbschema
js/analysis.js    Statistik-Engine (reine Funktionen, DOM-frei)
js/charts.js      SVG-Diagramme (Heatmap, Biplot, Dendrogramm, Linien, Balken)
js/app.js         Zustand, Editor, Ansichten, Import/Export
js/sample.js      fiktiver Beispieldatensatz
data/sample.json  derselbe Datensatz als Importdatei
```

## Methodische Hinweise
- Bieri-Differenziertheit = 1 − Anteil identischer Bewertungen über alle Konstruktpaare und Elemente.
- Bannister-Intensität = Mittelwert von r² × 100 über alle Konstruktpaare.
- Konstruktcluster verwenden 1 − |r| als Distanz, damit gespiegelte Konstrukte als ähnlich gelten.
- Der gemeinsame Konstruktraum entsteht durch spaltenweises Zusammenfügen aller Grids vor der Zerlegung; so sind Elementpositionen verschiedener Zeitpunkte direkt vergleichbar.

Literatur: Kelly (1955), *The Psychology of Personal Constructs*; Fransella, Bell & Bannister (2004), *A Manual for Repertory Grid Technique*; Fromm (2004), *Introduction to the Repertory Grid Interview*.

## Lizenz
MIT

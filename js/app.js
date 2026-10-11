/* RepGrid Analyzer – Anwendungslogik (Zustand, Editor, Auswertungsansichten) */
(function () {
  'use strict';
  const { esc, fmt } = RGC;
  const STORE_KEY = 'repgrid-analyzer-v1';
  const clone = o => JSON.parse(JSON.stringify(o));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Zustand ---------- */
  let data = loadData();
  const ui = { tab: 'daten', tp: 0, cmpA: 0, cmpB: 0, sortCluster: true, pairA: 0, pairB: 1, status: null };
  ui.cmpB = Math.max(0, data.timepoints.length - 1);

  function loadData() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && d.timepoints && d.constructs) return d; }
    } catch (e) { /* Speicher nicht verfügbar – Beispieldaten verwenden */ }
    return clone(window.RG_SAMPLE);
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignorieren */ } }
  const pct = v => fmt(v * 100, 1) + ' %';
  const cName = c => `${c.left} – ${c.right}`;
  const tpName = t => t.label + (t.date ? ` (${formatDate(t.date)})` : '');
  function formatDate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : d; }
  const ready = () => data.constructs.length >= 2 && data.elements.length >= 2;
  const grid = i => data.timepoints[i].ratings;

  /* ---------- Rendering ---------- */
  function render() {
    ui.tp = Math.min(ui.tp, data.timepoints.length - 1);
    ui.cmpA = Math.min(ui.cmpA, data.timepoints.length - 1);
    ui.cmpB = Math.min(ui.cmpB, data.timepoints.length - 1);
    ui.pairA = Math.min(ui.pairA, data.elements.length - 1);
    ui.pairB = Math.min(ui.pairB, data.elements.length - 1);
    $('#title').textContent = data.title || 'Repertory Grid';
    $('#subtitle').textContent = `${data.elements.length} Elemente · ${data.constructs.length} Konstrukte · ${data.timepoints.length} Erhebungszeitpunkt${data.timepoints.length === 1 ? '' : 'e'} · Skala ${data.scale.min}–${data.scale.max}`;
    const sel = $('#tp-select');
    sel.innerHTML = data.timepoints.map((t, i) => `<option value="${i}" ${i === ui.tp ? 'selected' : ''}>${esc(tpName(t))}</option>`).join('');
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === ui.tab ? 'true' : 'false'));
    const main = $('#main');
    main.innerHTML = { daten: renderData, auswertung: renderAnalysis, vergleich: renderCompare, methode: renderMethod }[ui.tab]();
    bindMain(main);
  }

  /* ----- Tab: Daten ----- */
  function renderData() {
    const t = data.timepoints[ui.tp];
    const sc = data.scale;
    const status = ui.status ? `<div class="status ${ui.status.error ? 'error' : ''}">${esc(ui.status.text)}</div>` : '';
    ui.status = null;
    const tpList = data.timepoints.map((tp, i) => `
      <div class="tp-item ${i === ui.tp ? 'active' : ''}">
        <span class="tag">${esc(tp.id)}</span>
        <input type="text" id="tp-label-${i}" data-tp="${i}" data-field="label" value="${esc(tp.label)}" aria-label="Bezeichnung Zeitpunkt ${i + 1}">
        <input type="date" id="tp-date-${i}" data-tp="${i}" data-field="date" value="${esc(tp.date || '')}" aria-label="Datum Zeitpunkt ${i + 1}">
        <span><button class="btn" data-action="select-tp" data-tp="${i}">Bearbeiten</button>
        <button class="btn icon" data-action="del-tp" data-tp="${i}" title="Zeitpunkt löschen" ${data.timepoints.length < 2 ? 'disabled' : ''}>✕</button></span>
      </div>`).join('');
    const head = data.elements.map((e, j) => `<th class="el"><input type="text" id="el-${j}" data-el="${j}" value="${esc(e)}" aria-label="Element ${j + 1}"><button class="btn icon" data-action="del-el" data-el="${j}" title="Element entfernen">✕</button></th>`).join('');
    const rows = data.constructs.map((c, i) => `<tr>
        <th class="pole"><input type="text" id="cl-${i}" data-con="${i}" data-field="left" value="${esc(c.left)}" aria-label="Linker Pol ${i + 1}"></th>
        ${t.ratings[i].map((v, j) => `<td class="cell"><input type="number" id="r-${i}-${j}" data-r="${i}" data-c="${j}" min="${sc.min}" max="${sc.max}" step="1" value="${v}" aria-label="${esc(cName(c))} / ${esc(data.elements[j])}"></td>`).join('')}
        <th class="pole right"><span class="pole-wrap"><input type="text" id="cr-${i}" data-con="${i}" data-field="right" value="${esc(c.right)}" aria-label="Rechter Pol ${i + 1}"><button class="btn icon" data-action="del-con" data-con="${i}" title="Konstrukt entfernen">✕</button></span></th>
      </tr>`).join('');
    return `
      ${status}
      <div class="stack">
      <div class="grid-2">
        <section class="panel">
          <header><h2>Datensatz</h2></header>
          <div class="row">
            <div class="field" style="flex:1 1 240px"><label for="f-title">Titel</label><input type="text" id="f-title" value="${esc(data.title)}"></div>
            <div class="field"><label for="f-min">Skala von</label><input type="number" id="f-min" value="${sc.min}" style="width:70px"></div>
            <div class="field"><label for="f-max">bis</label><input type="number" id="f-max" value="${sc.max}" style="width:70px"></div>
          </div>
          <p class="small muted" style="margin-top:10px">Bewertung ${sc.min} = linker Pol trifft voll zu, ${sc.max} = rechter Pol trifft voll zu. Änderungen werden lokal im Browser gespeichert.</p>
          <div class="row" style="margin-top:14px">
            <button class="btn" data-action="load-sample">Beispieldaten laden</button>
            <button class="btn danger" data-action="reset">Leeres Grid anlegen</button>
          </div>
        </section>
        <section class="panel">
          <header><h2>Import &amp; Export</h2></header>
          <div class="row">
            <label class="btn">Datei importieren (JSON/CSV) <input type="file" id="f-import" accept=".json,.csv,.txt" hidden></label>
            <button class="btn" data-action="export-json">JSON herunterladen</button>
            <button class="btn" data-action="export-csv">CSV (aktueller Zeitpunkt)</button>
            <button class="btn" data-action="copy-json">JSON kopieren</button>
          </div>
          <p class="small muted" style="margin-top:10px">CSV-Format: Kopfzeile <code>Linker Pol;Element 1;…;Element n;Rechter Pol</code>, danach je Konstrukt eine Zeile. Passt die Struktur zum aktuellen Datensatz, wird die Datei als neuer Erhebungszeitpunkt angehängt, sonst ersetzt sie den Datensatz.</p>
        </section>
      </div>
      <section class="panel">
        <header><h2>Erhebungszeitpunkte</h2><p class="small muted">Ein neuer Zeitpunkt übernimmt die Bewertungen des gerade bearbeiteten als Ausgangspunkt.</p></header>
        <div class="tp-list">${tpList}</div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-action="add-tp">Neuen Zeitpunkt anlegen</button></div>
      </section>
      <section class="panel">
        <header><h2>Grid bearbeiten: ${esc(tpName(t))}</h2><p class="small muted">Zeilen sind Konstrukte (linker Pol · rechter Pol), Spalten sind Elemente.</p></header>
        <div class="scroll-x">
          <table class="grid">
            <thead><tr><th class="pole">Linker Pol</th>${head}<th class="pole right">Rechter Pol</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="row" style="margin-top:14px">
          <div class="field"><label for="new-el">Neues Element</label><input type="text" id="new-el" placeholder="z. B. Schwester"></div>
          <button class="btn" data-action="add-el">Element hinzufügen</button>
          <span style="flex-basis:100%"></span>
          <div class="field"><label for="new-cl">Neues Konstrukt – linker Pol</label><input type="text" id="new-cl" placeholder="z. B. geduldig"></div>
          <div class="field"><label for="new-cr">rechter Pol</label><input type="text" id="new-cr" placeholder="z. B. ungeduldig"></div>
          <button class="btn" data-action="add-con">Konstrukt hinzufügen</button>
        </div>
      </section>
      </div>`;
  }

  /* ----- Tab: Auswertung ----- */
  function kpi(label, value, unit, hint) {
    return `<div class="kpi"><span class="eyebrow">${esc(label)}</span><span class="value">${value}${unit ? `<small>${unit}</small>` : ''}</span><span class="hint">${esc(hint)}</span></div>`;
  }
  function elPairSelect(id, val) {
    return `<select id="${id}">${data.elements.map((e, i) => `<option value="${i}" ${i === val ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>`;
  }
  function renderAnalysis() {
    if (!ready()) return `<div class="notice">Für die Auswertung werden mindestens zwei Elemente und zwei Konstrukte benötigt.</div>`;
    const t = data.timepoints[ui.tp], g = t.ratings, sc = data.scale;
    const idx = RG.indices(g, sc);
    const cs = RG.constructStats(g, sc), es = RG.elementStats(g, sc);
    const corr = RG.corrMatrix(g);
    const dist = RG.elementDistances(g, sc);
    const p = RG.pca(g);
    const elTree = RG.hcluster(dist.norm, data.elements);
    const coTree = RG.hcluster(RG.constructDistances(g, sc), data.constructs.map(cName));
    const elOrder = ui.sortCluster ? elTree.leaves : data.elements.map((_, i) => i);
    const coOrder = ui.sortCluster ? coTree.leaves : data.constructs.map((_, i) => i);
    const heat = RGC.heatmap({
      title: 'Bewertungsmatrix', rows: coOrder.map(i => data.constructs[i].left), rightLabels: coOrder.map(i => data.constructs[i].right),
      cols: elOrder.map(j => data.elements[j]), values: coOrder.map(i => elOrder.map(j => g[i][j])), min: sc.min, max: sc.max,
    });
    const shortC = data.constructs.map(c => c.left);
    const corrHeat = RGC.heatmap({ title: 'Konstruktkorrelationen', rows: data.constructs.map(cName), cols: shortC, values: corr, mode: 'diverging', max: 1, digits: 2, cell: 40, leftW: 190, tip: (i, j, v) => `${cName(data.constructs[i])} × ${cName(data.constructs[j])}: r = ${fmt(v)}` });
    const distHeat = RGC.heatmap({ title: 'Elementdistanzen', rows: data.elements, cols: data.elements, values: dist.norm, min: 0, max: 1, digits: 2, cell: 40, tip: (i, j, v) => `${data.elements[i]} ↔ ${data.elements[j]}: ${fmt(v)} (euklidisch ${fmt(dist.raw[i][j])})` });
    const biplot = p && p.components.length > 1 ? RGC.biplot({
      title: 'Biplot', explained: p.explained,
      points: data.elements.map((e, j) => ({ label: e, x: p.elements[j][0], y: p.elements[j][1], tip: `${e}: K1 ${fmt(p.elements[j][0])}, K2 ${fmt(p.elements[j][1])}` })),
      vectors: data.constructs.map((c, i) => ({ left: c.left, right: c.right, x: p.constructs[i][0], y: p.constructs[i][1] })),
    }) : '<div class="notice">Zu wenige Daten für zwei Komponenten.</div>';
    let cum = 0;
    const compRows = p ? p.components.slice(0, Math.min(6, p.components.length)).map((c, k) => { cum += c.explained; return `<tr><td>Komponente ${k + 1}</td><td class="num">${fmt(c.eigenvalue)}</td><td class="num">${pct(c.explained)}</td><td class="num">${pct(cum)}</td></tr>`; }).join('') : '';
    const dAB = dist.norm[ui.pairA][ui.pairB];
    return `<div class="stack">
      <div class="kpis">
        ${kpi('Differenziertheit', pct(idx.differentiation), '', 'nach Bieri: 1 − Anteil übereinstimmender Bewertungen über alle Konstruktpaare; höher = komplexer')}
        ${kpi('Intensität', fmt(idx.intensity, 1), '', 'nach Bannister: mittleres r² × 100 aller Konstruktpaare; höher = engere Verknüpfung')}
        ${kpi('Extremität', pct(idx.extremity), '', 'Anteil der Bewertungen an den Skalenenden')}
        ${kpi('1. Hauptkomponente', pct(idx.pvaff), '', 'erklärte Varianz (PVAFF); hoch = eindimensionales Konstruktsystem')}
        ${kpi('Distanz ' + data.elements[ui.pairA] + ' ↔ ' + data.elements[ui.pairB], fmt(dAB), '', 'normierte euklidische Distanz, 0 = identisch, 1 = maximal verschieden')}
      </div>
      <section class="panel">
        <header><h2>Bewertungsmatrix – ${esc(tpName(t))}</h2>
          <label class="toggle small"><input type="checkbox" id="sort-cluster" ${ui.sortCluster ? 'checked' : ''}> Zeilen und Spalten nach Clusterlösung ordnen</label></header>
        <div class="scroll-x viz-box">${heat}</div>
      </section>
      <section class="panel">
        <header><h2>Hauptkomponentenanalyse</h2><p class="small muted">Elemente als Punkte, Konstrukte als Achsen durch den Ursprung (linker Pol am negativen, rechter Pol am positiven Ende). Nahe Elemente werden ähnlich beschrieben.</p></header>
        <div class="grid-wide">
          <div class="viz-box">${biplot}</div>
          <div><table class="data"><thead><tr><th>Komponente</th><th class="num">Eigenwert</th><th class="num">Varianz</th><th class="num">kumuliert</th></tr></thead><tbody>${compRows}</tbody></table></div>
        </div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <header><h2>Konstruktkorrelationen</h2><p class="small muted">Pearson-Korrelation über die Elemente. Negative Werte bedeuten, dass die Pole gespiegelt zusammenhängen.</p></header>
          <div class="scroll-x viz-box">${corrHeat}</div>
        </section>
        <section class="panel">
          <header><h2>Elementdistanzen</h2>
            <span class="row small">${elPairSelect('pair-a', ui.pairA)} <span>↔</span> ${elPairSelect('pair-b', ui.pairB)}</span></header>
          <div class="scroll-x viz-box">${distHeat}</div>
        </section>
      </div>
      <section class="panel">
        <header><h2>Clusteranalyse</h2><p class="small muted">Hierarchische Clusterung (Average Linkage) auf Elementdistanzen bzw. 1 − |r| für Konstrukte.</p></header>
        <div class="grid-2">
          <div><h3 class="muted small" style="margin-bottom:6px">Elemente</h3><div class="viz-box">${RGC.dendrogram(elTree, data.elements)}</div></div>
          <div><h3 class="muted small" style="margin-bottom:6px">Konstrukte</h3><div class="viz-box">${RGC.dendrogram(coTree, data.constructs.map(cName))}</div></div>
        </div>
      </section>
      <section class="panel">
        <header><h2>Deskriptive Statistik</h2></header>
        <div class="grid-2">
          <div class="scroll-x"><table class="data"><thead><tr><th>Konstrukt</th><th class="num">M</th><th class="num">SD</th><th class="num">Min</th><th class="num">Max</th><th class="num">Extrem</th></tr></thead>
            <tbody>${data.constructs.map((c, i) => `<tr><td>${esc(cName(c))}</td><td class="num">${fmt(cs[i].mean)}</td><td class="num">${fmt(cs[i].sd)}</td><td class="num">${cs[i].min}</td><td class="num">${cs[i].max}</td><td class="num">${pct(cs[i].extremity)}</td></tr>`).join('')}</tbody></table></div>
          <div class="scroll-x"><table class="data"><thead><tr><th>Element</th><th class="num">M</th><th class="num">SD</th><th class="num">Extrem</th></tr></thead>
            <tbody>${data.elements.map((e, j) => `<tr><td>${esc(e)}</td><td class="num">${fmt(es[j].mean)}</td><td class="num">${fmt(es[j].sd)}</td><td class="num">${pct(es[j].extremity)}</td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>
    </div>`;
  }

  /* ----- Tab: Vergleich ----- */
  function tpSelect(id, val) {
    return `<select id="${id}">${data.timepoints.map((t, i) => `<option value="${i}" ${i === val ? 'selected' : ''}>${esc(tpName(t))}</option>`).join('')}</select>`;
  }
  function renderCompare() {
    if (!ready()) return `<div class="notice">Für den Vergleich werden mindestens zwei Elemente und zwei Konstrukte benötigt.</div>`;
    if (data.timepoints.length < 2) return `<div class="notice">Für den Vergleich wird ein zweiter Erhebungszeitpunkt benötigt. Lege ihn im Reiter „Daten“ an.</div>`;
    const sc = data.scale, A = data.timepoints[ui.cmpA], B = data.timepoints[ui.cmpB];
    const cmp = RG.compare(A.ratings, B.ratings, sc);
    const range = sc.max - sc.min;
    const deltaHeat = RGC.heatmap({ title: 'Differenzmatrix', rows: data.constructs.map(c => c.left), rightLabels: data.constructs.map(c => c.right), cols: data.elements, values: cmp.delta, mode: 'diverging', max: range, tip: (i, j, v) => `${data.elements[j]} · ${cName(data.constructs[i])}: ${A.ratings[i][j]} → ${B.ratings[i][j]} (${v > 0 ? '+' : ''}${v})` });
    const elBars = RGC.barChart({ title: 'Änderung je Element', labels: data.elements, values: cmp.perElement.map(x => x.mean), signed: true });
    const coBars = RGC.barChart({ title: 'Änderung je Konstrukt', labels: data.constructs.map(cName), values: cmp.perConstruct.map(x => x.mean), signed: true });
    // Gemeinsamer Konstruktraum über alle Zeitpunkte
    const pooled = RG.pooledPca(data.timepoints.map(t => t.ratings));
    let traj = '<div class="notice">Zu wenige Daten für zwei Komponenten.</div>';
    if (pooled && pooled.components.length > 1) {
      const points = [], trajectories = [];
      data.elements.forEach((e, j) => {
        const path = data.timepoints.map((t, k) => ({ x: pooled.perGrid[k][j][0], y: pooled.perGrid[k][j][1] }));
        trajectories.push(path);
        data.timepoints.forEach((t, k) => points.push({ label: e, x: path[k].x, y: path[k].y, t: k, r: k === data.timepoints.length - 1 ? 7 : 4, showLabel: k === data.timepoints.length - 1, tip: `${e} · ${t.label}` }));
      });
      traj = RGC.biplot({ title: 'Verlauf im Konstruktraum', explained: pooled.explained, points, trajectories, vectors: data.constructs.map((c, i) => ({ left: c.left, right: c.right, x: pooled.constructs[i][0], y: pooled.constructs[i][1] })) });
    }
    const legend = `<div class="legend">${data.timepoints.map((t, k) => `<span><span class="sw" style="background:var(--series-${(k % 5) + 1})"></span>${esc(t.label)}</span>`).join('')}</div>`;
    // Indizes im Zeitverlauf
    const idxAll = data.timepoints.map(t => RG.indices(t.ratings, sc));
    const distAll = data.timepoints.map(t => RG.elementDistances(t.ratings, sc).norm[ui.pairA][ui.pairB]);
    const pairLabel = `Distanz ${data.elements[ui.pairA]} ↔ ${data.elements[ui.pairB]}`;
    const line = RGC.lineChart({ title: 'Indizes im Zeitverlauf', x: data.timepoints.map(t => t.label), yMax: 100, series: [
      { name: 'Differenziertheit %', values: idxAll.map(i => i.differentiation * 100) },
      { name: 'Intensität', values: idxAll.map(i => i.intensity) },
      { name: 'Extremität %', values: idxAll.map(i => i.extremity * 100) },
      { name: '1. Komponente %', values: idxAll.map(i => i.pvaff * 100) },
      { name: pairLabel + ' ×100', values: distAll.map(d => d * 100) },
    ] });
    const idxTable = `<table class="data"><thead><tr><th>Kennwert</th>${data.timepoints.map(t => `<th class="num">${esc(t.label)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Differenziertheit (Bieri)</td>${idxAll.map(i => `<td class="num">${pct(i.differentiation)}</td>`).join('')}</tr>
      <tr><td>Intensität (Bannister)</td>${idxAll.map(i => `<td class="num">${fmt(i.intensity, 1)}</td>`).join('')}</tr>
      <tr><td>Extremität</td>${idxAll.map(i => `<td class="num">${pct(i.extremity)}</td>`).join('')}</tr>
      <tr><td>Varianz 1. Komponente</td>${idxAll.map(i => `<td class="num">${pct(i.pvaff)}</td>`).join('')}</tr>
      <tr><td>${esc(pairLabel)}</td>${distAll.map(d => `<td class="num">${fmt(d)}</td>`).join('')}</tr>
    </tbody></table>`;
    const mc = cmp.maxCell;
    const heatOf = t => RGC.heatmap({ title: t.label, rows: data.constructs.map(c => c.left), rightLabels: data.constructs.map(c => c.right), cols: data.elements, values: t.ratings, min: sc.min, max: sc.max, cell: 30 });
    return `<div class="stack">
      <section class="panel">
        <header><h2>Zeitpunkte gegenüberstellen</h2></header>
        <div class="row">
          <div class="field"><label for="cmp-a">Ausgangspunkt A</label>${tpSelect('cmp-a', ui.cmpA)}</div>
          <div class="field"><label for="cmp-b">Vergleich B</label>${tpSelect('cmp-b', ui.cmpB)}</div>
          <div class="field"><label for="pair-a">Beobachtetes Elementpaar</label><span class="row">${elPairSelect('pair-a', ui.pairA)} ↔ ${elPairSelect('pair-b', ui.pairB)}</span></div>
        </div>
      </section>
      <div class="kpis">
        ${kpi('Übereinstimmung A ↔ B', fmt(cmp.correlation), '', 'Korrelation aller Zellen; 1 = unverändertes Grid')}
        ${kpi('Mittlere Änderung', fmt(cmp.meanAbs), '', 'durchschnittlicher Betrag der Differenz je Zelle (Skalenpunkte)')}
        ${kpi('Veränderte Zellen', pct(cmp.changedShare), '', `${Math.round(cmp.changedShare * cmp.cells)} von ${cmp.cells} Bewertungen`)}
        ${kpi('Größte Änderung', (mc.d > 0 ? '+' : '') + mc.d, '', `${data.elements[mc.j]} · ${cName(data.constructs[mc.i])}`)}
        ${kpi(pairLabel, fmt(distAll[ui.cmpA]) + ' → ' + fmt(distAll[ui.cmpB]), '', 'normierte Distanz bei A und B')}
      </div>
      <section class="panel">
        <header><h2>Differenzmatrix (B − A)</h2><p class="small muted">Rot: Verschiebung zum rechten Pol, Blau: zum linken Pol. Grau: unverändert.</p></header>
        <div class="scroll-x viz-box">${deltaHeat}</div>
      </section>
      <div class="grid-2">
        <section class="panel"><header><h2>Mittlere Verschiebung je Element</h2><p class="small muted">positiv = Richtung rechter Pol</p></header><div class="viz-box">${elBars}</div></section>
        <section class="panel"><header><h2>Mittlere Verschiebung je Konstrukt</h2><p class="small muted">positiv = Richtung rechter Pol</p></header><div class="viz-box">${coBars}</div></section>
      </div>
      <section class="panel">
        <header><h2>Verlauf im gemeinsamen Konstruktraum</h2><p class="small muted">Hauptkomponentenanalyse über alle Zeitpunkte gemeinsam. Jede Linie zeigt den Weg eines Elements, der große Punkt den letzten Zeitpunkt.</p></header>
        ${legend}
        <div class="viz-box" style="margin-top:8px">${traj}</div>
      </section>
      <section class="panel">
        <header><h2>Strukturkennwerte im Zeitverlauf</h2><p class="small muted">Alle Kennwerte auf 0–100 skaliert, über sämtliche Erhebungszeitpunkte.</p></header>
        <div class="grid-2"><div><div class="viz-box">${line}</div><div class="legend" style="margin-top:8px">${['Differenziertheit %', 'Intensität', 'Extremität %', '1. Komponente %', pairLabel + ' ×100'].map((n, k) => `<span><span class="sw" style="background:var(--series-${k + 1})"></span>${esc(n)}</span>`).join('')}</div></div><div class="scroll-x">${idxTable}</div></div>
      </section>
      <section class="panel">
        <header><h2>Bewertungsmatrizen nebeneinander</h2></header>
        <div class="grid-2">
          <div><h3 class="muted small" style="margin-bottom:6px">${esc(tpName(A))}</h3><div class="scroll-x viz-box">${heatOf(A)}</div></div>
          <div><h3 class="muted small" style="margin-bottom:6px">${esc(tpName(B))}</h3><div class="scroll-x viz-box">${heatOf(B)}</div></div>
        </div>
      </section>
    </div>`;
  }

  /* ----- Tab: Methode ----- */
  function renderMethod() {
    return `<section class="panel"><header><h2>Methodik und Berechnungen</h2></header><div class="prose">
      <p>Die Repertory-Grid-Technik (Kelly, 1955) erfasst, wie eine Person bedeutsame <strong>Elemente</strong> (Personen, Situationen, Rollen) anhand selbst gewählter bipolarer <strong>Konstrukte</strong> beurteilt. Jede Zelle des Grids enthält eine Bewertung zwischen den beiden Polen eines Konstrukts.</p>
      <h3>Kennwerte je Erhebungszeitpunkt</h3>
      <ul>
        <li><strong>Differenziertheit (Bieri)</strong>: Für jedes Konstruktpaar wird gezählt, bei wie vielen Elementen beide Konstrukte identisch bewertet wurden. Der Anteil dieser Übereinstimmungen wird von 1 abgezogen. Hohe Werte sprechen für ein differenziertes Konstruktsystem.</li>
        <li><strong>Intensität (Bannister)</strong>: Mittelwert von r² × 100 über alle Konstruktpaare. Hohe Werte zeigen eng verknüpfte, „verdichtete“ Konstrukte.</li>
        <li><strong>Extremität</strong>: Anteil der Bewertungen am Skalenminimum oder -maximum.</li>
        <li><strong>Varianz der 1. Hauptkomponente</strong> (PVAFF): Anteil der Gesamtvarianz, den die erste Komponente erklärt. Hohe Werte deuten auf ein eindimensionales System hin.</li>
        <li><strong>Elementdistanzen</strong>: Euklidische Distanz der Bewertungsprofile zweier Elemente, normiert auf die maximal mögliche Distanz (0 bis 1). Typisch ist der Vergleich „Ich selbst“ ↔ „Ideal-Ich“.</li>
        <li><strong>Konstruktkorrelationen</strong>: Pearson-Korrelation zweier Konstruktzeilen über die Elemente.</li>
      </ul>
      <h3>Hauptkomponentenanalyse (Biplot)</h3>
      <p>Die Matrix wird je Konstrukt zentriert und per Singulärwertzerlegung (über die Eigenwertzerlegung der Gram-Matrix, Jacobi-Verfahren) zerlegt. Elemente werden als Hauptkomponenten-Scores dargestellt, Konstrukte als Richtungsvektoren; die Vektorlänge ist zur besseren Lesbarkeit auf den Elementradius skaliert.</p>
      <h3>Clusteranalyse</h3>
      <p>Hierarchisch-agglomerativ mit Average Linkage. Elemente auf Basis der normierten Distanzen, Konstrukte auf Basis von 1 − |r|, damit gespiegelte Konstrukte als ähnlich gelten.</p>
      <h3>Vergleich von Erhebungszeitpunkten</h3>
      <ul>
        <li><strong>Differenzmatrix</strong>: Bewertung zum Zeitpunkt B minus Bewertung zum Zeitpunkt A, je Zelle.</li>
        <li><strong>Übereinstimmung</strong>: Korrelation aller Zellen beider Grids; <strong>mittlere Änderung</strong>: Durchschnitt der Differenzbeträge.</li>
        <li><strong>Gemeinsamer Konstruktraum</strong>: Die Grids aller Zeitpunkte werden spaltenweise aneinandergehängt und gemeinsam zerlegt. So liegen alle Zeitpunkte in denselben Achsen und Verschiebungen von Elementen werden direkt sichtbar.</li>
        <li><strong>Kennwerte im Zeitverlauf</strong>: alle Strukturindizes je Zeitpunkt auf einer gemeinsamen 0–100-Skala.</li>
      </ul>
      <h3>Datenformat</h3>
      <p>Export und Import erfolgen als JSON (vollständiger Datensatz mit allen Zeitpunkten) oder CSV (ein Grid). Alle Berechnungen laufen vollständig im Browser; es werden keine Daten übertragen.</p>
      <p class="small muted">Literatur: Kelly, G. A. (1955). The Psychology of Personal Constructs. · Fromm, M. (2004). Introduction to the Repertory Grid Interview. · Fransella, F., Bell, R. &amp; Bannister, D. (2004). A Manual for Repertory Grid Technique.</p>
    </div></section>`;
  }

  /* ---------- Ereignisse ---------- */
  function setStatus(text, error) { ui.status = { text, error }; }
  function bindMain(main) {
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b) return;
      const a = b.dataset.action;
      if (a === 'select-tp') { ui.tp = +b.dataset.tp; render(); }
      if (a === 'del-tp' && data.timepoints.length > 1) { data.timepoints.splice(+b.dataset.tp, 1); ui.tp = Math.max(0, ui.tp - 1); ui.cmpB = data.timepoints.length - 1; save(); render(); }
      if (a === 'add-tp') {
        const n = data.timepoints.length + 1;
        data.timepoints.push({ id: 'T' + n, label: 'T' + n, date: '', ratings: clone(grid(ui.tp)) });
        ui.tp = data.timepoints.length - 1; ui.cmpB = ui.tp; save(); render();
        const f = $('#tp-label-' + ui.tp); if (f) f.focus();
      }
      if (a === 'del-el' && data.elements.length > 1) { const j = +b.dataset.el; data.elements.splice(j, 1); data.timepoints.forEach(t => t.ratings.forEach(r => r.splice(j, 1))); save(); render(); }
      if (a === 'del-con' && data.constructs.length > 1) { const i = +b.dataset.con; data.constructs.splice(i, 1); data.timepoints.forEach(t => t.ratings.splice(i, 1)); save(); render(); }
      if (a === 'add-el') {
        const name = $('#new-el').value.trim(); if (!name) { $('#new-el').focus(); return; }
        const mid = Math.round((data.scale.min + data.scale.max) / 2);
        data.elements.push(name); data.timepoints.forEach(t => t.ratings.forEach(r => r.push(mid))); save(); render();
      }
      if (a === 'add-con') {
        const l = $('#new-cl').value.trim(), r = $('#new-cr').value.trim(); if (!l || !r) { $(!l ? '#new-cl' : '#new-cr').focus(); return; }
        const mid = Math.round((data.scale.min + data.scale.max) / 2);
        data.constructs.push({ left: l, right: r }); data.timepoints.forEach(t => t.ratings.push(data.elements.map(() => mid))); save(); render();
      }
      if (a === 'load-sample') { data = clone(window.RG_SAMPLE); ui.tp = 0; ui.cmpA = 0; ui.cmpB = data.timepoints.length - 1; ui.pairA = 0; ui.pairB = 1; save(); setStatus('Beispieldaten geladen (fiktiver Fall mit drei Erhebungszeitpunkten).'); render(); }
      if (a === 'reset') {
        data = { title: 'Neues Repertory Grid', scale: { min: 1, max: 5 }, elements: ['Ich selbst', 'Ideal-Ich', 'Element 3'], constructs: [{ left: 'Pol A', right: 'Pol B' }, { left: 'Pol C', right: 'Pol D' }], timepoints: [{ id: 'T1', label: 'T1', date: '', ratings: [[3, 3, 3], [3, 3, 3]] }] };
        ui.tp = 0; ui.cmpA = 0; ui.cmpB = 0; ui.pairA = 0; ui.pairB = 1; save(); setStatus('Leeres Grid angelegt. Elemente, Konstrukte und Bewertungen können jetzt bearbeitet werden.'); render();
      }
      if (a === 'export-json') download(`${slug(data.title)}.json`, JSON.stringify(data, null, 2), 'application/json');
      if (a === 'export-csv') download(`${slug(data.title)}_${data.timepoints[ui.tp].id}.csv`, toCsv(ui.tp), 'text/csv');
      if (a === 'copy-json') {
        const txt = JSON.stringify(data, null, 2);
        const done = ok => { setStatus(ok ? 'JSON in die Zwischenablage kopiert.' : 'Kopieren nicht möglich. Bitte „JSON herunterladen“ verwenden.', !ok); render(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); else done(false);
      }
    });
    main.addEventListener('change', e => {
      const el = e.target;
      if (el.id === 'f-title') { data.title = el.value; save(); render(); }
      if (el.id === 'f-min' || el.id === 'f-max') {
        const min = +$('#f-min').value, max = +$('#f-max').value;
        if (Number.isInteger(min) && Number.isInteger(max) && max > min) {
          data.scale = { min, max };
          data.timepoints.forEach(t => t.ratings.forEach(r => r.forEach((v, j) => { r[j] = Math.min(max, Math.max(min, v)); })));
          save(); render();
        } else { setStatus('Die Skala braucht ganzzahlige Grenzen, das Maximum muss größer als das Minimum sein.', true); render(); }
      }
      if (el.dataset.tp != null && el.dataset.field) { data.timepoints[+el.dataset.tp][el.dataset.field] = el.value; save(); if (el.dataset.field === 'label') render(); }
      if (el.dataset.el != null && el.type === 'text') { data.elements[+el.dataset.el] = el.value.trim() || `Element ${+el.dataset.el + 1}`; save(); render(); }
      if (el.dataset.con != null && el.dataset.field) { data.constructs[+el.dataset.con][el.dataset.field] = el.value.trim() || '–'; save(); }
      if (el.dataset.r != null) {
        let v = Math.round(+el.value); if (!Number.isFinite(v)) v = data.scale.min;
        v = Math.min(data.scale.max, Math.max(data.scale.min, v)); el.value = v;
        data.timepoints[ui.tp].ratings[+el.dataset.r][+el.dataset.c] = v; save();
      }
      if (el.id === 'f-import') importFile(el.files[0]);
      if (el.id === 'sort-cluster') { ui.sortCluster = el.checked; render(); }
      if (el.id === 'pair-a') { ui.pairA = +el.value; render(); }
      if (el.id === 'pair-b') { ui.pairB = +el.value; render(); }
      if (el.id === 'cmp-a') { ui.cmpA = +el.value; render(); }
      if (el.id === 'cmp-b') { ui.cmpB = +el.value; render(); }
    });
    // Pfeiltasten-Navigation im Grid
    main.addEventListener('keydown', e => {
      const el = e.target; if (el.dataset.r == null) return;
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0] };
      const m = moves[e.key]; if (!m) return;
      const nxt = $(`#r-${+el.dataset.r + m[0]}-${+el.dataset.c + m[1]}`); if (nxt) { e.preventDefault(); nxt.focus(); nxt.select(); }
    });
  }

  /* ---------- Import / Export ---------- */
  const slug = s => (s || 'repgrid').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'repgrid';
  function download(name, content, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toCsv(i) {
    const t = data.timepoints[i];
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const lines = [['Linker Pol', ...data.elements, 'Rechter Pol'].map(q).join(';')];
    data.constructs.forEach((c, r) => lines.push([q(c.left), ...t.ratings[r], q(c.right)].join(';')));
    return lines.join('\n');
  }
  function parseCsv(text) {
    const sep = (text.match(/;/g) || []).length >= (text.match(/,/g) || []).length ? ';' : (text.includes('\t') ? '\t' : ',');
    const rows = [];
    text.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const cells = []; let cur = '', inQ = false;
      for (let k = 0; k < line.length; k++) {
        const ch = line[k];
        if (ch === '"') { if (inQ && line[k + 1] === '"') { cur += '"'; k++; } else inQ = !inQ; }
        else if (ch === sep && !inQ) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
      cells.push(cur); rows.push(cells.map(c => c.trim()));
    });
    if (rows.length < 2 || rows[0].length < 4) throw new Error('CSV benötigt eine Kopfzeile mit linkem Pol, Elementen und rechtem Pol sowie mindestens eine Konstruktzeile.');
    const elements = rows[0].slice(1, -1);
    const constructs = [], ratings = [];
    rows.slice(1).forEach((r, i) => {
      if (r.length !== rows[0].length) throw new Error(`Zeile ${i + 2} hat ${r.length} statt ${rows[0].length} Spalten.`);
      constructs.push({ left: r[0], right: r[r.length - 1] });
      const vals = r.slice(1, -1).map(v => Number(String(v).replace(',', '.')));
      if (vals.some(v => !Number.isFinite(v))) throw new Error(`Zeile ${i + 2} enthält eine ungültige Bewertung.`);
      ratings.push(vals.map(Math.round));
    });
    return { elements, constructs, ratings };
  }
  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        if (file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{')) {
          const d = JSON.parse(text);
          if (!d.elements || !d.constructs || !d.timepoints || !d.scale) throw new Error('JSON enthält keinen vollständigen RepGrid-Datensatz.');
          d.timepoints.forEach(t => { if (t.ratings.length !== d.constructs.length || t.ratings.some(r => r.length !== d.elements.length)) throw new Error(`Zeitpunkt „${t.label}“: Matrixgröße passt nicht zu Elementen/Konstrukten.`); });
          data = d; ui.tp = 0; ui.cmpA = 0; ui.cmpB = d.timepoints.length - 1; ui.pairA = 0; ui.pairB = Math.min(1, d.elements.length - 1);
          setStatus(`Datensatz „${d.title || file.name}“ mit ${d.timepoints.length} Zeitpunkt(en) importiert.`);
        } else {
          const p = parseCsv(text);
          const same = p.elements.length === data.elements.length && p.elements.every((e, i) => e === data.elements[i]) && p.constructs.length === data.constructs.length && p.constructs.every((c, i) => c.left === data.constructs[i].left && c.right === data.constructs[i].right);
          if (same) {
            const n = data.timepoints.length + 1;
            data.timepoints.push({ id: 'T' + n, label: file.name.replace(/\.[^.]+$/, ''), date: '', ratings: p.ratings });
            ui.tp = data.timepoints.length - 1; ui.cmpB = ui.tp;
            setStatus(`CSV als neuer Erhebungszeitpunkt „${data.timepoints[ui.tp].label}“ angehängt.`);
          } else {
            const all = p.ratings.flat();
            data = { title: file.name.replace(/\.[^.]+$/, ''), scale: { min: Math.min(...all), max: Math.max(...all) }, elements: p.elements, constructs: p.constructs, timepoints: [{ id: 'T1', label: 'T1', date: '', ratings: p.ratings }] };
            if (data.scale.max === data.scale.min) data.scale.max = data.scale.min + 1;
            ui.tp = 0; ui.cmpA = 0; ui.cmpB = 0; ui.pairA = 0; ui.pairB = Math.min(1, p.elements.length - 1);
            setStatus(`CSV als neuer Datensatz importiert (Skala aus den Daten abgeleitet: ${data.scale.min}–${data.scale.max}, bei Bedarf anpassen).`);
          }
        }
        save(); render();
      } catch (err) { setStatus('Import fehlgeschlagen: ' + err.message, true); render(); }
    };
    reader.readAsText(file);
  }

  /* ---------- Tooltip & Theme ---------- */
  const tip = $('#tip');
  document.addEventListener('mouseover', e => { const m = e.target.closest('.mark[data-tip]'); if (m) { tip.textContent = m.dataset.tip; tip.classList.add('show'); } });
  document.addEventListener('mousemove', e => { if (!tip.classList.contains('show')) return; const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px'; });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('.mark[data-tip]')) tip.classList.remove('show'); });
  const rerender = () => { if (ui.tab !== 'daten') render(); };
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender);
  new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Start ---------- */
  const TABS = ['daten', 'auswertung', 'vergleich', 'methode'];
  $$('.tabs button').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; history.replaceState(null, '', '#' + ui.tab); render(); window.scrollTo(0, 0); }));
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (TABS.includes(h) && h !== ui.tab) { ui.tab = h; render(); } });
  $('#tp-select').addEventListener('change', e => { ui.tp = +e.target.value; render(); });
  const hash = location.hash.replace('#', '');
  ui.tab = TABS.includes(hash) ? hash : 'auswertung';
  render();
})();

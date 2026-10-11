/* RepGrid Analyzer – Analyse-Engine
 * Reine Funktionen ohne DOM-Zugriff. Grid = Array von Konstrukt-Zeilen,
 * jede Zeile = Array von Bewertungen je Element (Konstrukte × Elemente).
 */
(function (global) {
  'use strict';
  const RG = {};

  /* ---------- Basisstatistik ---------- */
  RG.mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
  RG.sd = a => {
    if (a.length < 2) return 0;
    const m = RG.mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  };
  RG.pearson = (x, y) => {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const mx = RG.mean(x), my = RG.mean(y);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx += (x[i] - mx) ** 2;
      dy += (y[i] - my) ** 2;
    }
    const den = Math.sqrt(dx * dy);
    return den === 0 ? 0 : num / den;
  };
  RG.transpose = m => (m.length ? m[0].map((_, j) => m.map(r => r[j])) : []);
  RG.round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

  /* ---------- Deskriptive Kennwerte ---------- */
  RG.constructStats = (grid, scale) => grid.map(row => ({
    mean: RG.mean(row),
    sd: RG.sd(row),
    min: Math.min(...row),
    max: Math.max(...row),
    extremity: row.filter(v => v === scale.min || v === scale.max).length / row.length,
  }));
  RG.elementStats = (grid, scale) => RG.transpose(grid).map(col => ({
    mean: RG.mean(col),
    sd: RG.sd(col),
    extremity: col.filter(v => v === scale.min || v === scale.max).length / col.length,
  }));

  /* ---------- Korrelationen & Distanzen ---------- */
  RG.corrMatrix = rows => rows.map(a => rows.map(b => RG.pearson(a, b)));
  RG.euclid = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  /* Elementdistanzen: roh (euklidisch) und normiert auf 0..1
   * (geteilt durch die maximal mögliche Distanz bei gegebener Skala). */
  RG.elementDistances = (grid, scale) => {
    const cols = RG.transpose(grid);
    const maxD = (scale.max - scale.min) * Math.sqrt(grid.length || 1);
    const raw = cols.map(a => cols.map(b => RG.euclid(a, b)));
    const norm = raw.map(r => r.map(d => d / maxD));
    return { raw, norm };
  };
  RG.constructDistances = (grid, scale) => {
    /* Distanz zwischen Konstrukten auf Basis 1-|r|, damit gespiegelte Pole
     * (negative Korrelation) als ähnlich gelten. */
    const r = RG.corrMatrix(grid);
    return r.map(row => row.map(v => 1 - Math.abs(v)));
  };

  /* ---------- Eigenwertzerlegung (zyklisches Jacobi-Verfahren) ---------- */
  RG.jacobiEigen = (S) => {
    const n = S.length;
    const A = S.map(r => r.slice());
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-14) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(A[p][q]) < 1e-15) continue;
          const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
          const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = A[k][p], akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p][k], aqk = A[q][k];
            A[p][k] = c * apk - s * aqk;
            A[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const order = A.map((_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return {
      values: order.map(i => Math.max(0, A[i][i])),
      vectors: order.map(i => V.map(r => r[i])), // vectors[k] = k-ter Eigenvektor
    };
  };

  /* ---------- Hauptkomponentenanalyse ----------
   * Zentrierung je Konstrukt (Zeile), SVD über die Gram-Matrix X·Xᵀ.
   * Ergebnis: Elementkoordinaten (Scores), Konstruktladungen, erklärte Varianz. */
  RG.pca = (grid) => {
    const nC = grid.length, nE = nC ? grid[0].length : 0;
    if (nC < 2 || nE < 2) return null;
    const rowMeans = grid.map(RG.mean);
    const X = grid.map((r, i) => r.map(v => v - rowMeans[i]));
    const G = X.map(a => X.map(b => a.reduce((s, v, k) => s + v * b[k], 0)));
    const eig = RG.jacobiEigen(G);
    const total = eig.values.reduce((s, v) => s + v, 0) || 1;
    const k = Math.min(nC, nE, eig.values.length);
    const comps = [];
    for (let c = 0; c < k; c++) {
      const u = eig.vectors[c];
      const s = Math.sqrt(eig.values[c]);
      // Element-Scores = Xᵀ·u ; Konstruktkoordinaten = u·s
      const elementScores = Array.from({ length: nE }, (_, j) => X.reduce((acc, row, i) => acc + row[j] * u[i], 0));
      comps.push({ eigenvalue: eig.values[c], singular: s, explained: eig.values[c] / total, u, elementScores, constructCoords: u.map(v => v * s) });
    }
    return {
      rowMeans, components: comps,
      elements: Array.from({ length: nE }, (_, j) => comps.map(c => c.elementScores[j])),
      constructs: Array.from({ length: nC }, (_, i) => comps.map(c => c.constructCoords[i])),
      explained: comps.map(c => c.explained),
    };
  };
  /* Gemeinsamer Konstruktraum über mehrere Zeitpunkte: Grids werden
   * spaltenweise aneinandergehängt, einmal zentriert und gemeinsam zerlegt. */
  RG.pooledPca = (grids) => {
    if (!grids.length) return null;
    const pooled = grids[0].map((_, i) => grids.flatMap(g => g[i]));
    const p = RG.pca(pooled);
    if (!p) return null;
    const nE = grids[0][0].length;
    const perGrid = grids.map((_, t) => p.elements.slice(t * nE, (t + 1) * nE));
    return { ...p, perGrid };
  };

  /* ---------- Hierarchische Clusteranalyse (Average Linkage) ---------- */
  RG.hcluster = (dist, labels) => {
    const n = labels.length;
    if (n === 0) return null;
    let clusters = labels.map((l, i) => ({ leaf: i, label: l, size: 1, height: 0, leaves: [i] }));
    let D = dist.map(r => r.slice());
    while (clusters.length > 1) {
      let bi = 0, bj = 1, best = Infinity;
      for (let i = 0; i < clusters.length; i++)
        for (let j = i + 1; j < clusters.length; j++)
          if (D[i][j] < best) { best = D[i][j]; bi = i; bj = j; }
      const a = clusters[bi], b = clusters[bj];
      const merged = { left: a, right: b, size: a.size + b.size, height: best, leaves: a.leaves.concat(b.leaves) };
      const newD = [];
      const rest = clusters.map((_, i) => i).filter(i => i !== bi && i !== bj);
      const nd = rest.map(i => (D[i][bi] * a.size + D[i][bj] * b.size) / (a.size + b.size));
      for (let x = 0; x < rest.length; x++) {
        newD.push(rest.map(j => D[rest[x]][j]).concat([nd[x]]));
      }
      newD.push(nd.concat([0]));
      D = newD;
      clusters = rest.map(i => clusters[i]).concat([merged]);
    }
    return clusters[0];
  };

  /* ---------- Strukturindizes ---------- */
  RG.indices = (grid, scale) => {
    const nC = grid.length, nE = nC ? grid[0].length : 0;
    if (nC < 2 || nE < 2) return null;
    let matches = 0, pairs = 0, sumR2 = 0;
    for (let i = 0; i < nC; i++) for (let j = i + 1; j < nC; j++) {
      pairs++;
      for (let e = 0; e < nE; e++) if (grid[i][e] === grid[j][e]) matches++;
      const r = RG.pearson(grid[i], grid[j]);
      sumR2 += r * r;
    }
    const cells = nC * nE;
    const extreme = grid.flat().filter(v => v === scale.min || v === scale.max).length;
    const p = RG.pca(grid);
    return {
      bieriMatches: matches,                               // Rohscore nach Bieri (Übereinstimmungen)
      differentiation: 1 - matches / (pairs * nE),         // 1 − Übereinstimmungsanteil, 0..1
      intensity: (sumR2 / pairs) * 100,                    // Bannister: mittleres r²×100, 0..100
      extremity: extreme / cells,                          // Anteil Extremwerte, 0..1
      pvaff: p ? p.explained[0] : NaN,                     // Varianzanteil der 1. Hauptkomponente
      meanAbsCorr: Math.sqrt(sumR2 / pairs),
    };
  };

  /* ---------- Vergleich zweier Erhebungszeitpunkte ---------- */
  RG.compare = (gridA, gridB, scale) => {
    const nC = gridA.length, nE = nC ? gridA[0].length : 0;
    const delta = gridA.map((r, i) => r.map((v, j) => gridB[i][j] - v));
    const flatA = gridA.flat(), flatB = gridB.flat(), flatD = delta.flat();
    const changed = flatD.filter(d => d !== 0).length;
    const perConstruct = delta.map(r => ({ mean: RG.mean(r), abs: RG.mean(r.map(Math.abs)) }));
    const perElement = RG.transpose(delta).map(c => ({ mean: RG.mean(c), abs: RG.mean(c.map(Math.abs)) }));
    let maxCell = { i: 0, j: 0, d: 0 };
    delta.forEach((r, i) => r.forEach((d, j) => { if (Math.abs(d) > Math.abs(maxCell.d)) maxCell = { i, j, d }; }));
    return {
      delta,
      correlation: RG.pearson(flatA, flatB),
      meanAbs: RG.mean(flatD.map(Math.abs)),
      changedShare: nC * nE ? changed / (nC * nE) : 0,
      perConstruct, perElement, maxCell,
      cells: nC * nE,
    };
  };

  global.RG = RG;
})(typeof window !== 'undefined' ? window : globalThis);

/* RepGrid Analyzer – SVG-Visualisierungen (ohne externe Bibliotheken)
 * Jede Funktion liefert einen SVG-String. Farben werden aus den CSS-Tokens
 * des Dokuments gelesen, damit Hell- und Dunkelmodus konsistent bleiben. */
(function (global) {
  'use strict';
  const C = {};
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  C.esc = esc; C.fmt = fmt;

  /* ---------- Farben ---------- */
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((v, i) => v + (hex2rgb(b)[i] - v) * t));
  const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  C.theme = () => ({
    dark: token('--mode') === 'dark',
    text: token('--fg') || '#0b0b0b',
    muted: token('--fg-muted') || '#52514e',
    line: token('--line') || '#dcdad4',
    surface: token('--surface') || '#fcfcfb',
    neutral: token('--viz-neutral') || '#f0efec',
    series: [1, 2, 3, 4, 5].map(i => token('--series-' + i)),
    seqLow: token('--seq-low') || '#cde2fb',
    seqHigh: token('--seq-high') || '#0d366b',
    divNeg: token('--div-neg') || '#2a78d6',
    divPos: token('--div-pos') || '#e34948',
  });
  /* sequenziell: eine Farbe, hell → dunkel */
  C.seqColor = (t, th) => mix(th.seqLow, th.seqHigh, Math.max(0, Math.min(1, t)));
  /* divergierend: Blau ↔ neutrales Grau ↔ Rot, t in [-1, 1] */
  C.divColor = (t, th) => (t < 0 ? mix(th.neutral, th.divNeg, Math.min(1, -t)) : mix(th.neutral, th.divPos, Math.min(1, t)));
  C.inkOn = bg => (lum(bg) > 0.35 ? '#0b0b0b' : '#ffffff');

  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /* ---------- Heatmap (Bewertungsmatrix, Korrelationen, Distanzen, Delta) ---------- */
  C.heatmap = (o) => {
    const th = C.theme();
    const nR = o.rows.length, nCo = o.cols.length;
    const cell = o.cell || 34, leftW = o.leftW ?? 150, rightW = o.rightLabels ? 150 : 8, topH = o.topH ?? 110;
    const w = leftW + nCo * cell + rightW, h = topH + nR * cell + 8;
    let s = `<svg class="viz" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.title || 'Heatmap')}">`;
    s += `<rect width="${w}" height="${h}" fill="${th.surface}"/>`;
    o.cols.forEach((c, j) => {
      const x = leftW + j * cell + cell / 2;
      s += `<text x="${x}" y="${topH - 8}" transform="rotate(-55 ${x} ${topH - 8})" fill="${th.text}" font-size="12" text-anchor="start"><title>${esc(c)}</title>${esc(trunc(c, 18))}</text>`;
    });
    o.rows.forEach((r, i) => {
      const y = topH + i * cell + cell / 2 + 4;
      s += `<text x="${leftW - 8}" y="${y}" fill="${th.text}" font-size="12" text-anchor="end"><title>${esc(r)}</title>${esc(trunc(r, 22))}</text>`;
      if (o.rightLabels) s += `<text x="${leftW + nCo * cell + 8}" y="${y}" fill="${th.text}" font-size="12">${esc(trunc(o.rightLabels[i], 22))}</text>`;
    });
    o.values.forEach((row, i) => row.forEach((v, j) => {
      let bg, label;
      if (o.mode === 'diverging') { bg = C.divColor(v / o.max, th); label = (v > 0 ? '+' : '') + fmt(v, o.digits ?? 0); }
      else { bg = C.seqColor((v - o.min) / (o.max - o.min || 1), th); label = fmt(v, o.digits ?? 0); }
      if (o.mode === 'diverging' && v === 0) label = '0';
      const x = leftW + j * cell + 1, y = topH + i * cell + 1;
      const tip = o.tip ? o.tip(i, j, v) : `${o.rows[i]} × ${o.cols[j]}: ${label}`;
      s += `<g class="mark" data-tip="${esc(tip)}"><rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="3" fill="${bg}"/>`;
      if (o.cellText !== false) s += `<text x="${x + (cell - 2) / 2}" y="${y + (cell - 2) / 2 + 4}" font-size="11" text-anchor="middle" fill="${C.inkOn(bg)}" font-variant-numeric="tabular-nums">${label}</text>`;
      s += '</g>';
    }));
    return s + '</svg>';
  };

  /* ---------- Biplot (Hauptkomponenten) mit optionalen Verlaufspfaden ---------- */
  C.biplot = (o) => {
    const th = C.theme();
    const W = 640, H = 520, pad = 70;
    const pts = o.points; // {label, x, y, t?}
    const allX = pts.map(p => p.x), allY = pts.map(p => p.y);
    let vecs = o.vectors || [];
    let r = Math.max(...allX.map(Math.abs), ...allY.map(Math.abs), 1e-9);
    // Konstruktvektoren so skalieren, dass der längste 85 % des Elementradius erreicht
    const vmax = Math.max(...vecs.map(v => Math.hypot(v.x, v.y)), 1e-9);
    const vs = (r * 0.85) / vmax;
    r *= 1.15;
    const sx = x => W / 2 + (x / r) * (W / 2 - pad), sy = y => H / 2 - (y / r) * (H / 2 - pad);
    let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Biplot')}">`;
    s += `<rect width="${W}" height="${H}" fill="${th.surface}"/>`;
    s += `<line x1="${pad / 2}" y1="${H / 2}" x2="${W - pad / 2}" y2="${H / 2}" stroke="${th.line}" stroke-width="1"/>`;
    s += `<line x1="${W / 2}" y1="${pad / 2}" x2="${W / 2}" y2="${H - pad / 2}" stroke="${th.line}" stroke-width="1"/>`;
    s += `<text x="${W - pad / 2}" y="${H / 2 - 6}" font-size="11" fill="${th.muted}" text-anchor="end">Komponente 1 (${fmt(o.explained[0] * 100, 1)} %)</text>`;
    s += `<text x="${W / 2 + 6}" y="${pad / 2 + 12}" font-size="11" fill="${th.muted}">Komponente 2 (${fmt(o.explained[1] * 100, 1)} %)</text>`;
    vecs.forEach(v => {
      const x1 = sx(-v.x * vs), y1 = sy(-v.y * vs), x2 = sx(v.x * vs), y2 = sy(v.y * vs);
      s += `<g class="mark" data-tip="${esc(v.left + ' – ' + v.right)}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${th.muted}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.8"/>`;
      s += `<circle cx="${x2}" cy="${y2}" r="3" fill="${th.muted}"/>`;
      const anchor = (x) => (x > W / 2 ? 'start' : 'end');
      s += `<text x="${x2 + (x2 > W / 2 ? 5 : -5)}" y="${y2 + 4}" font-size="11" fill="${th.muted}" text-anchor="${anchor(x2)}">${esc(trunc(v.right, 16))}</text>`;
      s += `<text x="${x1 + (x1 > W / 2 ? 5 : -5)}" y="${y1 + 4}" font-size="11" fill="${th.muted}" text-anchor="${anchor(x1)}">${esc(trunc(v.left, 16))}</text></g>`;
    });
    if (o.trajectories) {
      o.trajectories.forEach(tr => {
        const d = tr.map((p, i) => (i ? 'L' : 'M') + sx(p.x) + ' ' + sy(p.y)).join(' ');
        s += `<path d="${d}" fill="none" stroke="${th.muted}" stroke-width="1.5" opacity="0.7"/>`;
      });
    }
    pts.forEach(p => {
      const color = p.t != null ? th.series[p.t % th.series.length] : th.series[0];
      const x = sx(p.x), y = sy(p.y);
      s += `<g class="mark" data-tip="${esc(p.tip || p.label)}"><circle cx="${x}" cy="${y}" r="${p.r || 6}" fill="${color}" stroke="${th.surface}" stroke-width="2"/>`;
      if (p.showLabel !== false) s += `<text x="${x + 9}" y="${y + 4}" font-size="12" font-weight="600" fill="${th.text}">${esc(trunc(p.label, 20))}</text>`;
      s += '</g>';
    });
    return s + '</svg>';
  };

  /* ---------- Dendrogramm (horizontal) ---------- */
  C.dendrogram = (tree, labels) => {
    const th = C.theme();
    const leaves = tree.leaves;
    const rowH = 24, labelW = 170, plotW = 320, W = plotW + labelW + 20, H = leaves.length * rowH + 30;
    const maxH = tree.height || 1;
    const sx = h => 10 + (1 - h / maxH) * plotW;
    const pos = {}; leaves.forEach((l, i) => { pos[l] = 20 + i * rowH; });
    let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dendrogramm">`;
    s += `<rect width="${W}" height="${H}" fill="${th.surface}"/>`;
    const walk = node => {
      if (node.leaf != null) return { x: sx(0), y: pos[node.leaf] };
      const a = walk(node.left), b = walk(node.right);
      const x = sx(node.height);
      s += `<g class="mark" data-tip="${esc('Fusionsdistanz ' + fmt(node.height))}"><path d="M${a.x} ${a.y} H${x} V${b.y} H${b.x}" fill="none" stroke="${th.series[0]}" stroke-width="2" stroke-linecap="round"/></g>`;
      return { x, y: (a.y + b.y) / 2 };
    };
    walk(tree);
    leaves.forEach(l => s += `<text x="${sx(0) + 8}" y="${pos[l] + 4}" font-size="12" fill="${th.text}"><title>${esc(labels[l])}</title>${esc(trunc(labels[l], 26))}</text>`);
    s += `<text x="10" y="${H - 4}" font-size="10" fill="${th.muted}">← größere Distanz</text>`;
    return s + '</svg>';
  };

  /* ---------- Liniendiagramm (Indizes über Zeitpunkte) ---------- */
  C.lineChart = (o) => {
    const th = C.theme();
    const W = 640, H = 320, padL = 44, padR = 150, padT = 16, padB = 40;
    const n = o.x.length;
    const yMax = o.yMax || 100;
    const sx = i => padL + (n > 1 ? (i / (n - 1)) * (W - padL - padR) : (W - padL - padR) / 2);
    const sy = v => padT + (1 - v / yMax) * (H - padT - padB);
    let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Verlauf')}">`;
    s += `<rect width="${W}" height="${H}" fill="${th.surface}"/>`;
    [0, 25, 50, 75, 100].forEach(v => {
      const y = sy((v / 100) * yMax);
      s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${th.line}"/>`;
      s += `<text x="${padL - 6}" y="${y + 4}" font-size="11" fill="${th.muted}" text-anchor="end">${fmt((v / 100) * yMax, 0)}</text>`;
    });
    o.x.forEach((l, i) => s += `<text x="${sx(i)}" y="${H - padB + 18}" font-size="11" fill="${th.text}" text-anchor="middle">${esc(trunc(l, 14))}</text>`);
    // Beschriftungen am rechten Rand ohne Überlappung verteilen (min. 13 px Abstand)
    const labels = o.series.map((ser, k) => ({ k, y: sy(ser.values[ser.values.length - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
    for (let i = labels.length - 1; i >= 0; i--) { const lim = H - padB - 4; if (labels[i].y > lim) labels[i].y = lim; if (i < labels.length - 1 && labels[i + 1].y - labels[i].y < 13) labels[i].y = labels[i + 1].y - 13; }
    const labelY = {}; labels.forEach(l => { labelY[l.k] = l.y; });
    o.series.forEach((ser, k) => {
      const color = th.series[k % th.series.length];
      const d = ser.values.map((v, i) => (i ? 'L' : 'M') + sx(i) + ' ' + sy(v)).join(' ');
      s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
      ser.values.forEach((v, i) => s += `<g class="mark" data-tip="${esc(ser.name + ' · ' + o.x[i] + ': ' + fmt(v, 1))}"><circle cx="${sx(i)}" cy="${sy(v)}" r="5" fill="${color}" stroke="${th.surface}" stroke-width="2"/></g>`);
      s += `<text x="${sx(n - 1) + 10}" y="${labelY[k] + 4}" font-size="11" fill="${th.text}">${esc(trunc(ser.name, 24))}</text>`;
    });
    return s + '</svg>';
  };

  /* ---------- Balkendiagramm (horizontal, divergierend bei Vorzeichen) ---------- */
  C.barChart = (o) => {
    const th = C.theme();
    const rowH = 26, labelW = 170, plotW = 360, W = labelW + plotW + 60, H = o.labels.length * rowH + 16;
    const maxV = Math.max(...o.values.map(Math.abs), 1e-9);
    const signed = o.signed;
    const zero = signed ? labelW + plotW / 2 : labelW;
    const sx = v => zero + (v / maxV) * (signed ? plotW / 2 : plotW);
    let s = `<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Balken')}">`;
    s += `<rect width="${W}" height="${H}" fill="${th.surface}"/>`;
    s += `<line x1="${zero}" y1="8" x2="${zero}" y2="${H - 8}" stroke="${th.line}"/>`;
    o.labels.forEach((l, i) => {
      const v = Math.abs(o.values[i]) < 0.005 ? 0 : o.values[i], y = 8 + i * rowH;
      const color = signed ? (v < 0 ? th.divNeg : th.divPos) : th.series[0];
      s += `<text x="${labelW - 8}" y="${y + 17}" font-size="12" fill="${th.text}" text-anchor="end"><title>${esc(l)}</title>${esc(trunc(l, 24))}</text>`;
      const x1 = Math.min(zero, sx(v)), wdt = Math.abs(sx(v) - zero);
      s += `<g class="mark" data-tip="${esc(l + ': ' + fmt(v, 2))}"><rect x="${x1}" y="${y + 4}" width="${Math.max(wdt, 1)}" height="${rowH - 8}" rx="3" fill="${color}"/>`;
      s += `<text x="${v < 0 ? x1 - 6 : x1 + wdt + 6}" y="${y + 17}" font-size="11" fill="${th.muted}" text-anchor="${v < 0 ? 'end' : 'start'}" font-variant-numeric="tabular-nums">${fmt(v, 2)}</text></g>`;
    });
    return s + '</svg>';
  };

  global.RGC = C;
})(typeof window !== 'undefined' ? window : globalThis);

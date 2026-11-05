/* =========================================================
   Tooltip + minimal SVG line chart with crosshair hover
   ========================================================= */
const Tooltip = {
  el: null,
  show(e, html) { this.el ||= document.getElementById('tooltip'); this.el.innerHTML = html; this.el.hidden = false; this.move(e); },
  move(e) {
    if (!this.el || this.el.hidden) return;
    const r = this.el.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY - r.height - 10;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y < 8) y = e.clientY + 16;
    this.el.style.left = x + 'px'; this.el.style.top = y + 'px';
  },
  hide() { if (this.el) this.el.hidden = true; },
};

/**
 * Renders a single-series line chart.
 * @param {HTMLElement} el
 * @param {Array<{x:number,y:number,label:string,marks?:number}>} points
 * @param {object} o { height, yMin, yMax, ySuffix, tip(point)->html, xLabel(point)->string, area }
 */
function lineChart(el, points, o = {}) {
  el.classList.add('chart');
  if (!points.length) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const W = Math.max(el.clientWidth, 280), H = o.height || 200;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const ys = points.map(p => p.y);
  let yMin = o.yMin ?? Math.min(...ys), yMax = o.yMax ?? Math.max(...ys);
  if (o.yMin === undefined) yMin = Math.max(0, Math.floor((yMin - 5) / 10) * 10);
  if (o.yMax === undefined) yMax = Math.ceil((yMax + 5) / 10) * 10;
  if (yMax === yMin) yMax = yMin + 10;
  const n = points.length;
  const x = i => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = v => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  // ~4 horizontal gridlines with round values
  const step = niceStep((yMax - yMin) / 4);
  let grid = '', axis = '';
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    axis += `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(1)}${o.ySuffix || ''}</text>`;
  }
  // x labels: first, middle, last
  const xIdx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
  for (const i of xIdx) {
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    axis += `<text x="${x(i)}" y="${H - 6}" text-anchor="${n === 1 ? 'middle' : anchor}">${escapeHtml(o.xLabel ? o.xLabel(points[i]) : points[i].label)}</text>`;
  }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const area = o.area !== false && n > 1
    ? `<path class="area" d="${d}L${x(n - 1)},${y(yMin)}L${x(0)},${y(yMin)}Z"/>` : '';
  const marks = points.filter(p => p.marks).map(p => {
    const i = points.indexOf(p);
    return `<circle class="err-mark" cx="${x(i)}" cy="${H - pad.b - 3}" r="${Math.min(2 + p.marks, 5)}"/>`;
  }).join('');
  const dots = n <= 40 ? points.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.y)}" r="3.5"/>`).join('') : '';

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${escapeHtml(o.aria || 'Line chart')}">
      <g class="grid">${grid}</g>
      <g class="axis">${axis}</g>
      ${area}<path class="series" d="${d}"/>${dots}${marks}
      <line class="cross" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
      <circle class="dot hover-dot" r="5" visibility="hidden"/>
      <rect x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>
    </svg>`;

  const svg = el.querySelector('svg');
  const cross = svg.querySelector('.cross');
  const hd = svg.querySelector('.hover-dot');
  const hit = svg.querySelector('rect');
  hit.addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (W / r.width);
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((mx - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
    const p = points[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    hd.setAttribute('cx', x(i)); hd.setAttribute('cy', y(p.y)); hd.setAttribute('visibility', 'visible');
    Tooltip.show(e, o.tip ? o.tip(p) : `<b>${p.y}</b>`);
  });
  hit.addEventListener('mouseleave', () => {
    cross.setAttribute('visibility', 'hidden'); hd.setAttribute('visibility', 'hidden'); Tooltip.hide();
  });
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

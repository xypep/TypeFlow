/* =========================================================
   Statistics tab — KPIs, WPM/accuracy trends, key heatmap, history
   ========================================================= */
const Stats = {
  range: 30,
  kind: 'all',

  init() {
    this._seg('stats-range', String(this.range), v => { this.range = +v; this.render(); });
    this._seg('stats-kind', this.kind, v => { this.kind = v; this.render(); });
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => App.route === 'stats' && this.render(), 150); });
  },

  _seg(id, current, onPick) {
    const seg = document.getElementById(id);
    const set = v => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    set(current);
    seg.onclick = e => { const b = e.target.closest('button'); if (b) { set(b.dataset.v); onPick(b.dataset.v); } };
  },

  filtered() {
    const since = this.range ? Date.now() - this.range * 864e5 : 0;
    return Store.data.sessions.filter(s =>
      new Date(s.date).getTime() >= since && (this.kind === 'all' || s.kind === this.kind));
  },

  render() {
    const body = document.getElementById('stats-body');
    const name = Store.data.settings.name.trim();
    document.querySelector('.stats-card h1').textContent = name ? `Statistics · ${name}` : 'Statistics';
    const list = this.filtered();
    if (!list.length) {
      body.innerHTML = `<div class="empty">No sessions in this range yet.<br>Head to <a href="#start" style="color:var(--accent)">Start</a> or <a href="#learn" style="color:var(--accent)">Learn</a> and type something!</div>`;
      return;
    }
    const avg = k => list.reduce((a, s) => a + s[k], 0) / list.length;
    const best = Math.max(...list.map(s => s.wpm));
    const totalSec = list.reduce((a, s) => a + s.seconds, 0);
    const totalChars = list.reduce((a, s) => a + s.correctChars, 0);
    const recent = list.slice(-10);
    const recentAvg = recent.reduce((a, s) => a + s.wpm, 0) / recent.length;

    body.innerHTML = `
      <div class="kpis">
        ${tile(list.length, 'Sessions')}
        ${tile(Math.round(avg('wpm')), 'Avg WPM')}
        ${tile(best, 'Best WPM')}
        ${tile(Math.round(recentAvg), 'Avg WPM (last 10)')}
        ${tile(avg('accuracy').toFixed(1) + '%', 'Avg accuracy')}
        ${tile(fmtDuration(totalSec), 'Time typing')}
        ${tile(totalChars.toLocaleString(), 'Correct characters')}
      </div>
      <div class="chart-grid">
        <div class="chart-box"><h3>Speed <small>WPM per session</small></h3><div id="ch-wpm"></div></div>
        <div class="chart-box"><h3>Accuracy <small>% per session</small></h3><div id="ch-acc"></div></div>
      </div>
      <div class="chart-box" style="margin-bottom:22px">
        <h3>Problem keys <small>error rate per key · all time</small></h3>
        <div id="heat-kb"></div>
        <div class="heat-scale"><span>fewer errors</span><span class="bar"></span><span>more errors</span></div>
      </div>
      <h3>History</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Mode</th><th>Text / lesson</th><th class="num">WPM</th><th class="num">Raw</th><th class="num">Accuracy</th><th class="num">Time</th></tr></thead>
          <tbody>${list.slice().reverse().slice(0, 50).map(s => `
            <tr><td>${fmtDate(s.date)}</td><td>${MODE_NAMES[s.mode] || s.mode}${s.timeLimit ? ` ${s.timeLimit}s` : ''}</td>
            <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.textTitle || '')}</td>
            <td class="num">${s.wpm}</td><td class="num">${s.raw}</td><td class="num">${s.accuracy}%</td><td class="num">${fmtTime(s.seconds)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    const pts = list.map((s, i) => ({ x: i, y: s.wpm, label: fmtDate(s.date, true), s }));
    const tip = p => `<b>${p.s.wpm} wpm</b> · ${p.s.accuracy}%<br>${MODE_NAMES[p.s.mode] || p.s.mode} · ${fmtDate(p.s.date)}`;
    lineChart(document.getElementById('ch-wpm'), pts, { yMin: 0, tip, aria: 'WPM per session' });
    const accPts = list.map((s, i) => ({ x: i, y: s.accuracy, label: fmtDate(s.date, true), s }));
    const minAcc = Math.min(...accPts.map(p => p.y));
    lineChart(document.getElementById('ch-acc'), accPts, {
      yMin: Math.max(0, Math.floor((minAcc - 2) / 5) * 5), yMax: 100, ySuffix: '%', tip, aria: 'Accuracy per session',
    });

    const kb = new Keyboard(document.getElementById('heat-kb'), { layout: Store.data.settings.layout, fingers: false, heat: true, legend: false });
    kb.applyHeat(Store.data.keyStats, Tooltip);
  },
};

function tile(v, k) { return `<div class="stat-tile"><div class="v">${v}</div><div class="k">${k}</div></div>`; }

function fmtDate(iso, short = false) {
  const d = new Date(iso);
  return short
    ? d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
    : d.toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * End-to-end smoke test (Playwright). Starts its own static server,
 * mocks the folder picker with an in-memory file and walks through
 * login → training → lesson → statistics → settings.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run test:e2e            (SCREENSHOTS=1 to save screenshots)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'screenshots');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

(async () => {
  const server = await serve();
  const url = `http://localhost:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const shot = async name => {
    if (!process.env.SCREENSHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(350);     // let page/caret transitions settle
    await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
  };

  // in-memory replacement for window.showDirectoryPicker
  await page.addInitScript(() => {
    window.__files = {};
    const file = name => ({
      name, kind: 'file',
      async getFile() { return { text: async () => window.__files[name] || '' }; },
      async createWritable() {
        let buf = '';
        return { write: async d => { buf += d; }, close: async () => { window.__files[name] = buf; } };
      },
    });
    window.showDirectoryPicker = async () => ({
      name: 'TypeFlowData', kind: 'directory', getFileHandle: async n => file(n),
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    });
  });

  try {
    await page.goto(url);
    await shot('01-login');
    await page.click('#btn-folder');
    await page.waitForSelector('#app:not([hidden])');
    assert.match(await page.textContent('#nav-storage'), /TypeFlowData/);

    // ---- training: full text with one typo ----
    await page.fill('#source-text', 'Die Sonne scheint hell. Wir lernen heute tippen.');
    await shot('02-start');
    await page.click('#btn-start');
    const target = await page.evaluate(() => Training.session.target);
    await page.keyboard.type('Die Sonne scheint hxll. ', { delay: 25 });
    await shot('03-typing');
    await page.keyboard.type(target.slice(24), { delay: 25 });
    await page.waitForSelector('#train-result:not([hidden])');
    await shot('04-result');
    const db = await page.evaluate(() => JSON.parse(window.__files['typeflow-db.json']));
    assert.equal(db.sessions.length, 1, 'session saved to the folder DB');
    assert.equal(db.sessions[0].errors, 1);
    assert.equal(db.texts.length, 1, 'pasted text saved');

    // ---- Tab restarts, Esc stops ----
    await page.keyboard.press('Tab');
    assert.ok(await page.isVisible('#train-run'));
    await page.keyboard.press('Escape');
    assert.ok(await page.isVisible('#train-idle'));

    // ---- lesson 1 ----
    await page.click('.nav-link[data-route="learn"]');
    await shot('05-learn');
    await page.click('.lesson[data-i="0"]');
    const lesson = await page.evaluate(() => Learn.session.target);
    await page.keyboard.type(lesson.slice(0, 18), { delay: 25 });
    await shot('06-lesson');
    await page.keyboard.type(lesson.slice(18), { delay: 5 });
    await page.waitForSelector('#learn-result:not([hidden])');
    assert.ok(await page.isVisible('.badge.pass'), 'lesson passed');

    // ---- statistics & settings ----
    await page.click('.nav-link[data-route="stats"]');
    await page.waitForSelector('#ch-wpm svg');
    await shot('07-stats');
    await page.click('.nav-link[data-route="settings"]');
    await page.click('[data-seg="theme"] [data-v="light"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.themeResolved), 'light');
    await shot('08-settings-light');
    await page.click('.nav-link[data-route="stats"]');
    await shot('09-stats-light');

    assert.deepEqual(errors, [], 'no page errors');
    console.log('✔ e2e smoke test passed');
  } catch (err) {
    console.error('✖ e2e smoke test failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-single.js');

test('single-file build inlines every local stylesheet and script', () => {
  const html = fs.readFileSync(build(), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...index.matchAll(/<script src="([^"]+)">/g)].map(m => m[1]);

  assert.ok(scripts.length >= 10);
  for (const src of scripts) assert.ok(html.includes(`/* ---- ${src} ---- */`), `${src} inlined`);
  assert.ok(!/<script src="(?!https?:)/.test(html), 'no local <script src>');
  assert.ok(!/<link rel="stylesheet" href="(?!https?:)/.test(html), 'no local stylesheet link');
  assert.ok(html.includes('--surface'), 'CSS inlined');
  // script order must match index.html (later files use globals from earlier ones)
  const order = scripts.map(s => html.indexOf(`/* ---- ${s} ---- */`));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

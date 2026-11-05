/**
 * Builds a single self-contained HTML file: dist/typeflow.html
 * - inlines css/styles.css and every js/*.js referenced by index.html (in order)
 * - no dependencies, run with: npm run build
 *
 * The result works by double-clicking it (file://) in Chrome/Edge;
 * the database stays a separate typeflow-db.json in the folder you pick.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'typeflow.html');

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Text inside <script>/<style> must not contain a closing tag. */
function guard(code, tag, file) {
  if (new RegExp(`</${tag}`, 'i').test(code)) throw new Error(`${file} contains "</${tag}" and cannot be inlined`);
  return code;
}

function build() {
  let html = read('index.html');
  let inlined = 0;

  // <link rel="stylesheet" href="css/...">  →  <style>…</style>  (external URLs such as Google Fonts stay)
  html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (_, href) => {
    inlined++;
    return `<style>\n${guard(read(href), 'style', href)}\n</style>`;
  });

  // <script src="js/...">  →  <script>…</script>
  html = html.replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (_, src) => {
    inlined++;
    return `<script>\n/* ---- ${src} ---- */\n${guard(read(src), 'script', src)}\n</script>`;
  });

  const banner = `<!-- TypeFlow single-file build · generated ${new Date().toISOString().slice(0, 10)} from index.html — edit the sources, then run "npm run build" -->\n`;
  html = html.replace(/^<!doctype html>\n?/i, m => m + banner);

  if (/<(script|link)[^>]+(src|href)="(?!https?:)/.test(html)) throw new Error('Some local file reference was not inlined');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`✔ ${path.relative(ROOT, OUT)} — ${inlined} files inlined, ${(html.length / 1024).toFixed(0)} KB`);
  return OUT;
}

if (require.main === module) build();
module.exports = { build, OUT };

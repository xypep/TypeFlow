/**
 * Loads the browser scripts (classic <script> files with globals) into a
 * Node vm context so their pure logic can be unit-tested without a browser.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * @param {string[]} files  script names in js/ (load order matters, like index.html)
 * @param {object} globals  extra globals / stubs (e.g. a fake clock)
 * @returns {(expr: string) => any} evaluates an expression inside the context
 */
function load(files, globals = {}) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, ...globals });
  for (const f of files) {
    const file = path.join(__dirname, '..', 'js', f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return expr => vm.runInContext(expr, ctx);
}

/** Fake performance.now() that tests advance manually. */
function fakeClock() {
  let t = 1000;
  return { performance: { now: () => t }, advance: ms => { t += ms; } };
}

module.exports = { load, fakeClock };

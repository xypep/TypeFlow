const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeClock } = require('./load');

/** Fresh context per test so the fake clock is isolated. */
function setup() {
  const clock = fakeClock();
  const run = load(['engine.js'], { performance: clock.performance });
  const TypingSession = run('TypingSession');
  const make = o => new TypingSession(o);
  return { clock, make };
}
const type = (s, text) => { for (const ch of text) s.input(ch); };

test('counts correct input and finishes at the end of the text', () => {
  const { make } = setup();
  const s = make({ text: 'ab cd' });
  let finished = null;
  s.on('finish', st => { finished = st; });
  type(s, 'ab cd');
  assert.ok(s.finished);
  assert.equal(finished.correctChars, 5);
  assert.equal(finished.errors, 0);
  assert.equal(finished.accuracy, 100);
});

test('wrong keys reduce accuracy and are marked incorrect', () => {
  const { make } = setup();
  const s = make({ text: 'abcd' });
  type(s, 'axcd');
  const st = s.stats();
  assert.equal(st.errors, 1);
  assert.equal(st.correctChars, 3);
  assert.equal(st.incorrectChars, 1);
  assert.equal(st.accuracy, 75);
});

test('accuracy counts every wrong keystroke, even if corrected', () => {
  const { make } = setup();
  const s = make({ text: 'ab' });
  type(s, 'x'); s.backspace(); type(s, 'ab');
  const st = s.stats();
  assert.equal(st.keystrokes, 3);
  assert.equal(st.correctChars, 2);
  assert.equal(st.accuracy, 66.7);
});

test('WPM uses correct chars / 5 per minute', () => {
  const { make, clock } = setup();
  const s = make({ text: 'x'.repeat(100) });
  type(s, 'x');                 // starts the clock
  clock.advance(60_000);
  type(s, 'x'.repeat(49));      // 50 correct chars in 60s → 10 wpm
  assert.equal(s.stats().wpm, 10);
  assert.equal(s.stats().raw, 10);
});

test('WPM is not inflated in the first second', () => {
  const { make, clock } = setup();
  const s = make({ text: 'hello world' });
  type(s, 'h');
  clock.advance(50);
  assert.ok(s.stats().wpm <= 12, `wpm was ${s.stats().wpm}`);
});

test('backspace and word-backspace', () => {
  const { make } = setup();
  const s = make({ text: 'one two three' });
  type(s, 'one tw');
  s.backspace();
  assert.equal(s.pos, 5);
  s.backspace(true);            // deletes "t" back to the space
  assert.equal(s.pos, 4);
  s.backspace(true);            // skips the space, deletes "one"
  assert.equal(s.pos, 0);
  s.backspace();                // no-op at the start
  assert.equal(s.pos, 0);
});

test('strict mode rejects wrong keys without advancing', () => {
  const { make } = setup();
  const s = make({ text: 'ab', strict: true });
  let rejected = 0;
  s.on('reject', () => rejected++);
  type(s, 'xa');
  assert.equal(s.pos, 1);
  assert.equal(rejected, 1);
  assert.equal(s.errors, 1);
});

test('keyStats count only the first attempt per position', () => {
  const { make } = setup();
  const s = make({ text: 'aa' });
  type(s, 'x'); s.backspace(); type(s, 'a'); type(s, 'a');
  assert.deepEqual({ ...s.keyStats.a }, { hits: 1, misses: 1 });
  assert.equal(s.missedKeys()[0][0], 'a');
});

test('time mode extends the text and finishes at the time limit', () => {
  const { make, clock } = setup();
  const s = make({ text: 'aa aa', timeLimit: 10, moreText: () => 'aa aa aa' });
  type(s, 'aa aa');
  assert.ok(!s.finished, 'time mode must not end when the text runs out');
  assert.ok(s.target.length > 5, 'text was extended');
  clock.advance(10_500);
  s.tick();
  assert.ok(s.finished);
  assert.equal(s.stats().seconds, 10);   // capped at the limit
  assert.equal(s.samples.length, 10);    // one sample per second
});

test('input after finish is ignored', () => {
  const { make } = setup();
  const s = make({ text: 'a' });
  type(s, 'ab');
  assert.equal(s.pos, 1);
  assert.equal(s.keystrokes, 1);
});

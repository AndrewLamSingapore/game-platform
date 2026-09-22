import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');

test('the public shell declares its icon so browsers stop requesting /favicon.ico', () => {
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'), 'index.html links the favicon');
  const favicon = read('favicon.svg');
  assert.match(favicon, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32"/);
  assert.ok(favicon.includes('aria-label="Living Worlds"'), 'the icon carries a label');
});

test('the site serves a robots policy instead of a 404', () => {
  assert.ok(existsSync(new URL('../robots.txt', import.meta.url)), 'robots.txt exists at the served root');
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(!/Disallow:\s*\/\s*$/m.test(robots), 'the public site is not blocked');
});

test('turn outcomes are announced through a live region', () => {
  assert.ok(
    html.includes('id="notice" class="notice" role="status" aria-live="polite" aria-atomic="true"'),
    'the notice container is a polite live region',
  );
  assert.match(read('app.js'), /notice\('The world is advancing/);
});

test('the material redesign loads after every legacy stylesheet', () => {
  const family = html.indexOf('/authority-family.css?v=2');
  assert.ok(family > html.indexOf('/atmosphere.css?v=8'), 'Authority family CSS must win the cascade');
  assert.ok(family > html.lastIndexOf('</style>'), 'Authority family CSS must follow inline legacy styles');
  const css = read('authority-family.css');
  for (const selector of ['.world-card', '.story-panel', '.choice', '.systems>summary']) {
    assert.ok(css.includes(selector), `redesign owns ${selector}`);
  }
  assert.match(css, /@media\s*\(max-width:\s*680px\)/);
});

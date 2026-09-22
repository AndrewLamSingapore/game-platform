/**
 * Living Worlds live play check.
 *
 * Exercises the deployed product the way a visitor does: anonymous guest
 * session -> starter world preview -> enter world -> read the scene -> submit
 * one choice -> observe the resolved turn and the next choices. It records
 * console errors, failed requests, horizontal overflow at phone width, the HUD
 * after resolution, and acceptance screenshots.
 *
 * This talks to the live Supabase project and generates exactly one GM turn, so
 * it is opt-in and never wired into CI. `playwright-core` is not a project
 * dependency; the script exits cleanly when it is absent.
 *
 *   npm install --no-save --no-package-lock playwright-core
 *   node scripts/live-play-check.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.LW_PLAY_URL || 'https://game-platform-wine-nine.vercel.app';
const SHOTS = process.env.LW_PLAY_SHOTS || path.join(tmpdir(), 'lw-play-shots');
const EDGE_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};
const step = async (name, body) => {
  try {
    await body();
  } catch (error) {
    record(name, false, `${error.name}: ${String(error.message).split('\n')[0]}`);
  }
};

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.log('SKIP  playwright-core is not installed; live play check not executed.');
  process.exit(0);
}

const executablePath = EDGE_PATHS.find((candidate) => existsSync(candidate));
if (!executablePath) {
  console.log('SKIP  no Chromium-family browser found.');
  process.exit(0);
}

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const failed = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text().slice(0, 300));
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText || ''}`));
page.on('response', (response) => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
});

const readPlayState = () =>
  page.evaluate(() => ({
    clock: document.querySelector('#clockLabel')?.textContent?.trim() || '',
    scene: document.querySelector('#openingLabel')?.textContent?.trim() || '',
    quest: document.querySelector('#questFocus')?.textContent?.trim() || '',
    people: document.querySelectorAll('#peoplePresent .presence-card, #peoplePresent .presence-empty').length,
    turns: document.querySelectorAll('#transcript .turn').length,
    choices: Array.from(document.querySelectorAll('.choice')).map((button) => ({
      text: button.textContent.trim().slice(0, 90),
      disabled: button.disabled,
    })),
    notice: document.querySelector('#notice')?.textContent?.trim() || '',
    noticeRole: document.querySelector('#notice')?.getAttribute('role') || '',
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    worldState: document.querySelector('#world')?.textContent?.slice(0, 200) || '',
  }));

await step('live session and first turn', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.world-card.starter', { timeout: 45000 });
  record('guest session opens the world dashboard', true, await page.locator('.world-card.starter').count() + ' starter worlds');
  await page.screenshot({ path: path.join(SHOTS, '01-dashboard.png'), fullPage: false });

  await page.locator('.world-card.starter').first().click();
  await page.waitForSelector('#enterWorld:visible', { timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS, '02-world-preview.png'), fullPage: false });
  record('world preview opens with an entry action', true, (await page.locator('#previewTitle').textContent())?.trim() || '');

  await page.locator('#enterWorld').click();
  await page.waitForSelector('.story-panel:visible', { timeout: 45000 });

  const deadline = Date.now() + 90000;
  let before = await readPlayState();
  while (before.choices.length === 0 && Date.now() < deadline) {
    await page.waitForTimeout(2000);
    before = await readPlayState();
  }
  record('the opening scene renders choices', before.choices.length > 0, JSON.stringify(before.choices));
  record('the HUD shows world time and the scene label', Boolean(before.clock && before.scene), `${before.clock} | ${before.scene}`);
  record('the campaign world state is loaded from the server', before.worldState.length > 20, before.worldState.slice(0, 80));
  await page.screenshot({ path: path.join(SHOTS, '03-scene.png'), fullPage: true });

  const firstChoice = before.choices[0]?.text || '';
  const started = Date.now();
  await page.locator('.choice').first().click();
  await page.waitForFunction(
    (turns) => document.querySelectorAll('#transcript .turn').length > turns,
    before.turns,
    { timeout: 90000 },
  );
  const elapsed = Date.now() - started;
  await page.waitForTimeout(1500);
  const after = await readPlayState();
  record('a choice resolves into a new turn', after.turns > before.turns, `turns ${before.turns} -> ${after.turns} in ${elapsed}ms`);
  record('the resolved turn returns fresh choices', after.choices.length > 0, JSON.stringify(after.choices.map((choice) => choice.text)));
  record('the choices are not left disabled after resolution', after.choices.every((choice) => choice.disabled === false), JSON.stringify(after.choices.map((choice) => choice.disabled)));
  record(
    'the resolved turn changes authoritative state',
    after.clock !== before.clock || after.worldState !== before.worldState,
    `${before.clock} -> ${after.clock}`,
  );
  record('the outcome is announced', after.notice.length > 0, `${after.notice} (role=${after.noticeRole || 'none'})`);
  record('the first choice came from the stored scene', firstChoice.length > 10, firstChoice);
  await page.screenshot({ path: path.join(SHOTS, '04-resolved-turn.png'), fullPage: true });
});

await step('mobile review', async () => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForSelector('.world-card.starter', { timeout: 45000 });
  const dashboardOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record('mobile dashboard has no horizontal overflow', dashboardOverflow <= 1, `overflow=${dashboardOverflow}`);
  const overlap = await mobilePage.evaluate(() => {
    const card = document.querySelector('.world-card.starter');
    const box = card?.getBoundingClientRect();
    return box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  });
  record('mobile world cards stay tappable', Boolean(overlap && overlap.width > 280 && overlap.height >= 180), JSON.stringify(overlap));
  await mobilePage.screenshot({ path: path.join(SHOTS, '05-mobile-dashboard.png'), fullPage: true });

  const mobilePlay = await mobile.newPage();
  await mobilePlay.goto(`${BASE}/#`, { waitUntil: 'domcontentloaded' });
  await mobilePlay.waitForSelector('.world-card.starter', { timeout: 45000 });
  await mobilePlay.locator('.world-card.starter').first().click();
  await mobilePlay.waitForSelector('#enterWorld:visible', { timeout: 15000 });
  await mobilePlay.locator('#enterWorld').click();
  await mobilePlay.waitForSelector('.story-panel:visible', { timeout: 45000 });
  await mobilePlay.waitForTimeout(6000);
  const playOverflow = await mobilePlay.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record('mobile play view has no horizontal overflow', playOverflow <= 1, `overflow=${playOverflow}`);
  const target = await mobilePlay.evaluate(() => {
    const button = document.querySelector('.choice');
    const box = button?.getBoundingClientRect();
    return box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
  });
  record('mobile choice targets are comfortably tappable', Boolean(target && target.height >= 44 && target.width >= 280), JSON.stringify(target));
  await mobilePlay.screenshot({ path: path.join(SHOTS, '06-mobile-scene.png'), fullPage: true });
  await mobile.close();
});

record('no runtime errors during the live session', errors.length === 0, errors.slice(0, 3).join(' | '));
record('no failed requests during the live session', failed.length === 0, failed.slice(0, 3).join(' | '));

await context.close();
await browser.close();

const reportPath = path.join(SHOTS, 'live-play-report.json');
writeFileSync(reportPath, JSON.stringify({ base: BASE, executablePath, results, shots: SHOTS, errors, failed }, null, 2));
const failures = results.filter((result) => !result.pass);
console.log(`\n${results.length - failures.length}/${results.length} live checks passed. Report: ${reportPath}`);
process.exit(failures.length === 0 ? 0 : 1);

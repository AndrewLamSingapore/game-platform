import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadCampaignForm(insertResult, openCampaign = async () => {}) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { value: 'sample', hidden: false, disabled: false, append() {} });
    return elements.get(selector);
  };
  const starters = [element('starter-a'), element('starter-b')];
  const db = {
    auth: { getUser: () => new Promise(() => {}), onAuthStateChange() {} },
    from() { return { insert() { return this; }, select() { return this; }, single: insertResult }; },
  };
  const context = vm.createContext({
    createGuestRecovery: () => ({ start() {}, finish() {} }), createClient: () => db,
    window: {}, document: { querySelector: element, querySelectorAll: selector => selector === '.starter' ? starters : [], createElement: element },
    setTimeout, crypto: { randomUUID: () => 'id' }, openCampaignForTest: openCampaign,
  });
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  vm.runInContext("user={id:'guest-1'}; openCampaign=openCampaignForTest", context);
  const submitter = element('submit');
  return { element, starters, submitter, submit: () => element('#newCampaign').onsubmit({ preventDefault() {}, submitter }) };
}

test('successful creation restores controls for another world after returning to the dashboard', async () => {
  let resolveInsert, opened;
  const form = loadCampaignForm(() => new Promise(resolve => { resolveInsert = resolve; }), async id => { opened = id; });
  const pending = form.submit();
  assert.equal(form.submitter.disabled, true);
  assert.ok(form.starters.every(button => button.disabled));
  resolveInsert({ data: { id: 'campaign-1' }, error: null });
  await pending;
  assert.equal(opened, 'campaign-1');
  assert.equal(form.submitter.disabled, false);
  assert.ok(form.starters.every(button => !button.disabled));
});

for (const failure of ['returned insert error', 'thrown insert error', 'thrown campaign load error']) {
  test(`${failure} reports the failure and restores creation controls`, async () => {
    const form = loadCampaignForm(async () => {
      if (failure === 'returned insert error') return { data: null, error: { message: 'creation failed' } };
      if (failure === 'thrown insert error') throw new Error('creation failed');
      return { data: { id: 'campaign-1' }, error: null };
    }, async () => { throw new Error('creation failed'); });
    await form.submit();
    assert.equal(form.element('#notice').textContent, 'creation failed');
    assert.equal(form.element('#notice').className, 'notice bad');
    assert.equal(form.submitter.disabled, false);
    assert.ok(form.starters.every(button => !button.disabled));
  });
}

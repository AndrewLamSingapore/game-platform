import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageFreshDatabase } from '../scripts/stage-fresh-database.mjs';
const original = new URL('../', import.meta.url);
function fixture(run) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'game-stage-test-'));
  const repository = path.join(temp, 'repository');
  cpSync(new URL('supabase/', original), path.join(repository, 'supabase'), { recursive: true, filter: source => !source.includes(path.sep + '.temp') && !source.includes(path.sep + 'functions') });
  try { return run({ temp, repository, output: path.join(temp, 'stage') }); }
  finally { rmSync(temp, { recursive: true, force: true }); }
}
test('fresh baseline is deterministic and preserves each exact original plus one deliberate repair prelude', () => fixture(({ temp, repository, output }) => {
  const a = stageFreshDatabase({ repository, output });
  const b = stageFreshDatabase({ repository, output: path.join(temp, 'stage-again') });
  assert.deepEqual(a, b);
  assert.equal(a.inputs.filter(input => input.use === 'original').length, 29);
  assert.equal(a.inputs.filter(input => input.file.startsWith('0004_')).length, 2);
  assert.equal(a.inputs.filter(input => input.use === 'early-compatibility-prelude').length, 1);
  assert.deepEqual(readFileSync(path.join(output, 'supabase', 'migrations', a.baseline)), readFileSync(path.join(temp, 'stage-again', 'supabase', 'migrations', a.baseline)));
  assert.equal(existsSync(path.join(output, 'supabase', '.temp')), false);
  const baseline = readFileSync(path.join(output, 'supabase', 'migrations', a.baseline));
  for (const input of a.inputs) assert.notEqual(baseline.indexOf(Buffer.from(readFileSync(path.join(repository, 'supabase', 'migrations', input.file), 'utf8').replace(/\r\n/g, '\n'))), -1);
}));
test('altered pinned SQL rejects before output creation', () => fixture(({ repository, output }) => {
  writeFileSync(path.join(repository, 'supabase', 'migrations', '0004_game_systems_v2.sql'), '-- tampered');
  assert.throws(() => stageFreshDatabase({ repository, output }), /hash mismatch/);
  assert.equal(existsSync(output), false);
}));
test('existing output and source overlap are rejected without writes', () => fixture(({ repository }) => {
  assert.throws(() => stageFreshDatabase({ repository, output: repository }), /already exists/);
  assert.throws(() => stageFreshDatabase({ repository, output: path.join(repository, 'supabase', 'new-output') }), /overlaps/);
}));
test('future timestamped migration retains its identity; backdated and duplicate versions fail closed', () => fixture(({ repository, output }) => {
  const migrations = path.join(repository, 'supabase', 'migrations');
  writeFileSync(path.join(migrations, '20990101000000_future.sql'), 'select 1;');
  const record = stageFreshDatabase({ repository, output });
  assert.equal(record.staged[1].file, '20990101000000_future.sql');
  writeFileSync(path.join(migrations, '20990101000000_collision.sql'), 'select 2;');
  assert.throws(() => stageFreshDatabase({ repository, output: output + '-collision' }), /Duplicate future/);
  rmSync(path.join(migrations, '20990101000000_collision.sql'));
  writeFileSync(path.join(migrations, '0008_unreviewed.sql'), 'select 3;');
  assert.throws(() => stageFreshDatabase({ repository, output: output + '-backdated' }), /Unreviewed backdated/);
}));
test('tampered preflight rejects before output creation', () => fixture(({ repository, output }) => {
  const config = JSON.parse(readFileSync(path.join(repository, 'supabase', 'fresh-install', 'manifest.json')));
  writeFileSync(path.join(repository, 'supabase', 'fresh-install', config.baseline), '-- removed guard');
  assert.throws(() => stageFreshDatabase({ repository, output }), /preflight hash mismatch/);
  assert.equal(existsSync(output), false);
}));

test('Windows CRLF and Git LF checkouts generate identical baseline bytes and provenance', () => fixture(({ temp, repository, output }) => {
  const config = JSON.parse(readFileSync(path.join(repository, 'supabase', 'fresh-install', 'manifest.json')));
  const templatePath = path.join(repository, 'supabase', 'fresh-install', config.baseline);
  for (const file of [...config.inputs.map(input => path.join(repository, 'supabase', 'migrations', input.file)), templatePath]) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  }
  const first = stageFreshDatabase({ repository, output });
  for (const input of config.inputs) {
    const file = path.join(repository, 'supabase', 'migrations', input.file);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  }
  const template = path.join(repository, 'supabase', 'fresh-install', config.baseline);
  writeFileSync(template, readFileSync(template, 'utf8').replace(/\r\n/g, '\n'));
  const next = path.join(temp, 'lf-stage');
  assert.deepEqual(stageFreshDatabase({ repository, output: next }), first);
  assert.deepEqual(readFileSync(path.join(output, 'supabase', 'migrations', first.baseline)), readFileSync(path.join(next, 'supabase', 'migrations', first.baseline)));
}));

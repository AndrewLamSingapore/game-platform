/** Generate an unlinked Supabase workspace for a NEW empty Game database. Never connects. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sqlName = /^\d+_[a-zA-Z0-9_]+\.sql$/;
export function stageFreshDatabase({ output, repository = root }) {
  if (!output || typeof output !== 'string') throw new Error('Select a new output directory; no database URL is accepted.');
  const source = realpathSync(path.join(repository, 'supabase', 'migrations'));
  const target = path.resolve(output);
  if (existsSync(target)) throw new Error('Output already exists; refusing to overwrite.');
  const parent = realpathSync(path.dirname(target));
  const actualTarget = path.join(parent, path.basename(target));
  const overlaps = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
  if (overlaps(actualTarget, realpathSync(path.join(repository, 'supabase')))) throw new Error('Output overlaps source Supabase configuration.');
  const manifest = JSON.parse(readFileSync(path.join(repository, 'supabase', 'fresh-install', 'manifest.json'), 'utf8'));
  if (manifest.format !== 1 || !/^\d{14}_[a-zA-Z0-9_]+\.sql$/.test(manifest.baseline)) throw new Error('Unsupported baseline identity.');
  const template = canonical(readFileSync(path.join(repository, 'supabase', 'fresh-install', manifest.baseline)));
  if (hash(template) !== manifest.template_sha256) throw new Error('Baseline preflight hash mismatch.');
  const names = readdirSync(source).sort();
  if (names.some(name => !sqlName.test(name))) throw new Error('Unrecognized source migration file.');
  const covered = new Set();
  const inputs = manifest.inputs.map(input => {
    if (!sqlName.test(input.file) || covered.has(input.file)) throw new Error('Invalid or duplicate pinned input.');
    covered.add(input.file);
    const bytes = canonical(readFileSync(path.join(source, input.file)));
    if (hash(bytes) !== input.sha256) throw new Error('Pinned migration hash mismatch: ' + input.file);
    return { ...input, bytes };
  });
  if (inputs[0]?.file !== '0001_game_platform_v1.sql' || !covered.has(manifest.repair)) throw new Error('Invalid compatibility ordering.');
  if (inputs.map(input => input.file).join('|') !== [...covered].sort().join('|')) throw new Error('Pinned input order is not canonical.');
  const baselineVersion = manifest.baseline.split('_')[0];
  const future = names.filter(name => !covered.has(name)).map(file => {
    const version = file.split('_')[0];
    if (!/^\d{14}$/.test(version) || version <= baselineVersion) throw new Error('Unreviewed backdated migration: ' + file);
    return { file, version, bytes: canonical(readFileSync(path.join(source, file))) };
  });
  if (new Set(future.map(input => input.version)).size !== future.length) throw new Error('Duplicate future migration version.');
  const repair = inputs.find(input => input.file === manifest.repair);
  const pieces = [template];
  const provenance = [];
  for (const input of inputs) {
    pieces.push(Buffer.from('\n-- Original input: ' + input.file + ' SHA256 ' + input.sha256 + '\n'), input.bytes, Buffer.from('\n'));
    provenance.push({ file: input.file, sha256: input.sha256, use: 'original' });
    if (input.file === '0001_game_platform_v1.sql') {
      pieces.push(Buffer.from('\n-- Early compatibility prelude; same reviewed repair bytes.\n'), repair.bytes, Buffer.from('\n'));
      provenance.push({ file: repair.file, sha256: repair.sha256, use: 'early-compatibility-prelude' });
    }
  }
  const baseline = Buffer.concat(pieces);
  const staged = [{ file: manifest.baseline, sha256: hash(baseline) }, ...future.map(input => ({ file: input.file, sha256: hash(input.bytes) }))];
  const record = { format: 1, source_encoding: 'utf8-lf (canonical Git SQL bytes; original working files untouched)', purpose: 'NEW EMPTY DATABASE ONLY; existing installations retain their original ledger', baseline: manifest.baseline, template_sha256: hash(template), inputs: provenance, staged };
  // All validation happens before creating or writing any output.
  mkdirSync(actualTarget);
  mkdirSync(path.join(actualTarget, 'supabase'));
  mkdirSync(path.join(actualTarget, 'supabase', 'migrations'));
  writeFileSync(path.join(actualTarget, 'supabase', 'config.toml'), 'project_id = "game-independent-fresh"\n[db]\nmajor_version = 17\n[db.seed]\nenabled = false\n');
  writeFileSync(path.join(actualTarget, 'supabase', 'migrations', manifest.baseline), baseline);
  for (const input of future) writeFileSync(path.join(actualTarget, 'supabase', 'migrations', input.file), input.bytes);
  writeFileSync(path.join(actualTarget, 'fresh-install-provenance.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/stage-fresh-database.mjs NEW_OUTPUT_DIRECTORY');
    const record = stageFreshDatabase({ output: process.argv[2] });
    console.log(JSON.stringify({ status: 'PASS', baseline: record.baseline, inputs: record.inputs.length, staged: record.staged }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

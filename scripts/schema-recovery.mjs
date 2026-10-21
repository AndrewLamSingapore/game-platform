/** Disposable PostgreSQL/pgvector replay. Never accepts a database URL or credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageFreshDatabase } from './stage-fresh-database.mjs';
import { fileURLToPath } from 'node:url';

const commissioning = process.argv.includes('--commissioning');
if (process.argv.slice(2).some(arg => arg !== '--commissioning')) throw new Error('Only --commissioning is accepted; no database target arguments.');
const cli = process.env.GAME_SUPABASE_CLI || 'supabase';
const password = randomUUID();
const scratch = commissioning ? mkdtempSync(path.join(os.tmpdir(), 'game-commissioning-')) : null;
let networkCreated = false;
let port;
const image = 'pgvector/pgvector@sha256:ac08538c6f8b9904c33c8224c5e5706dbe760aca29db1d096972b4052c22a75d';
const runId = randomUUID();
const container = `abex-game-recovery-${runId}`;
const network = `abex-game-recovery-${runId}`;
const directory = new URL('../supabase/migrations/', import.meta.url);
const repair = '20261021012412_restore_reproducible_game_schema.sql';
const files = readdirSync(directory).filter(name => /^\d+_[\w]+\.sql$/.test(name)).sort();
const historical = files.filter(name => name !== repair);
const owner = '10000000-0000-0000-0000-000000000001';
const outsider = '10000000-0000-0000-0000-000000000002';
const legacyCampaign = '20000000-0000-0000-0000-000000000001';
const campaign = '20000000-0000-0000-0000-000000000002';
const checks = [];
let created = false;
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, POSTGRES_PASSWORD: password } });
function cliUp(database, workdir) {
  try {
    return execFileSync(cli, ['migration', 'up', '--db-url', `postgresql://postgres:${password}@127.0.0.1:${port}/${database}?sslmode=disable`, '--workdir', workdir, '--yes'], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, SUPABASE_ACCESS_TOKEN: '', SUPABASE_DB_PASSWORD: '', NO_COLOR: '1' } });
  } catch (error) {
    // Never serialize child command arguments or inherited credentials.
    throw new Error([error.stderr, error.stdout].filter(Boolean).join('\n').replaceAll(password, '[redacted]').replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database-url-redacted]'));
  }
}
function fullFingerprint(database) {
  const tables = JSON.parse(sql(database, "select json_agg(format('%I.%I',schemaname,tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','supabase_migrations');"));
  const rows = tables.map(table => [table, sql(database, `select count(*)||':'||coalesce(md5(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text),'empty') from ${table} t;`)]);
  const schema = docker(['exec', container, 'pg_dump', '-U', 'postgres', '-d', database, '--schema-only', '--no-owner']).replace(/^\\(?:un)?restrict .*$/gm, '');
  return JSON.stringify({ rows, schema: createHash('sha256').update(schema).digest('hex') });
}
function sql(database, text, atomic = true) {
  return docker(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...(atomic ? ['-1'] : []), '-U', 'postgres', '-d', database], text).trim();
}
const identity = id => `set local role authenticated; set local request.jwt.claim.sub='${id}';`;
const server = 'set local role service_role;';
const migrationText = file => readFileSync(new URL(file, directory), 'utf8');
const apply = (database, file) => sql(database, migrationText(file));
function pass(name, detail = '') { checks.push({ name, status: 'PASS', detail }); console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`); }
function rejects(database, text, pattern) {
  let failed = false;
  try { sql(database, text); }
  catch (error) { failed = true; assert.match(String(error.stderr), pattern); }
  assert.ok(failed, 'operation must reject');
}
function prepare(database) {
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  sql('postgres', `alter database ${database} set search_path to public,extensions;`, false);
  sql(database, `
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant usage,select on sequences to anon,authenticated,service_role;
  `);
}
function fingerprint(database) {
  return sql(database, `select jsonb_build_object(
    'campaigns',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.campaigns t),
    'entities',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.campaign_entities t),
    'turns',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.game_turns t),
    'memory',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.campaign_memory t),
    'audit',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.game_audit_log t));`);
}

try {
  // --pull=never prevents implicit downloads. CLI mode uses one password-protected loopback port on its own bridge.
  docker(['image', 'inspect', image]);
  if (commissioning) {
    docker(['network', 'create', '--opt', 'com.docker.network.bridge.enable_icc=false', '--label', `abex.game-recovery=${runId}`, network]);
    networkCreated = true;
  }
  docker(['run', '--detach', '--pull=never', '--name', container, '--label', `abex.game-recovery=${runId}`, '--network', commissioning ? network : 'none', ...(commissioning ? ['--publish', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD'] : ['-e', 'POSTGRES_HOST_AUTH_METHOD=trust']), '--memory', '384m', '--cpus', '0.5', '--mount', 'type=tmpfs,destination=/var/lib/postgresql/data,tmpfs-size=134217728', image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { docker(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(ready, 'disposable PostgreSQL must start');
  sql('postgres', 'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;');
  const settings = JSON.parse(docker(['inspect', '--format', '{{json .HostConfig}}', container]));
  if (commissioning) {
    assert.equal(settings.NetworkMode, network);
    assert.equal(docker(['network', 'inspect', '--format', '{{index .Options "com.docker.network.bridge.enable_icc"}}', network]).trim(), 'false');
    assert.equal(settings.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1');
    port = docker(['port', container, '5432/tcp']).trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    assert.ok(port, 'only a loopback test port is accepted');
    pass('database isolation', 'task-only bridge with inter-container traffic disabled, random password, one loopback port, tmpfs 384MiB/0.5 CPU');
  } else {
    assert.equal(settings.NetworkMode, 'none'); assert.deepEqual(settings.PortBindings || {}, {});
    pass('database isolation', 'network none, no published ports, tmpfs data, 384MiB/0.5 CPU');
  }
  console.log(JSON.stringify({ image, postgres: sql('postgres', 'select version();'), sourceRoot: fileURLToPath(new URL('../', import.meta.url)), migrations: files.map(file => ({ file, sha256: createHash('sha256').update(migrationText(file)).digest('hex') })) }));
  const duplicateVersions = [...new Set(files.map(file => file.split('_')[0]).filter((version, index, all) => all.indexOf(version) !== index))];
  assert.deepEqual(duplicateVersions, ['0004']);
  pass('historical migration collision retained explicitly', '0004 files replay by full filename; no deployed history is rewritten');

  prepare('baseline');
  let originalFailure;
  for (const file of historical) {
    try { apply('baseline', file); }
    catch (error) { originalFailure = { file, error: String(error.stderr) }; break; }
  }
  assert.equal(originalFailure?.file, '0005_game_systems_v2_hardening.sql');
  assert.match(originalFailure.error, /column e.kind does not exist/);
  pass('original fresh-recovery failure reproduced', originalFailure.file);

  let staged;
  if (commissioning) {
    const raw = path.join(scratch, 'raw');
    mkdirSync(path.join(raw, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(path.join(raw, 'supabase', 'config.toml'), 'project_id="game-raw-collision"\n[db]\nmajor_version=17\n');
    for (const file of files) writeFileSync(path.join(raw, 'supabase', 'migrations', file), readFileSync(new URL(file, directory)));
    prepare('cli_baseline');
    assert.throws(() => cliUp('cli_baseline', raw), error => {
      assert.match(error.message, /schema_migrations_pkey|duplicate key.*version|version.*0004/s);
      console.log('EXPECTED original CLI failure: ' + error.message.slice(-1000));
      return true;
    });
    pass('actual original CLI migration-version collision reproduced');
    const output = path.join(scratch, 'staged');
    staged = { output, record: stageFreshDatabase({ output }) };
    console.log(JSON.stringify({ freshInstall: staged.record }));
    prepare('occupied');
    sql('occupied', "create table public.existing_marker(value text); insert into public.existing_marker values ('unchanged');");
    assert.throws(() => cliUp('occupied', output), /empty public application schema/);
    assert.equal(sql('occupied', 'select value from public.existing_marker;'), 'unchanged');
    assert.equal(sql('occupied', "select to_regclass('public.campaigns') is null;"), 't');
    assert.equal(sql('occupied', 'select count(*) from supabase_migrations.schema_migrations;'), '0');
    pass('nonempty target fails before application writes');
    prepare('occupied_private');
    sql('occupied_private', "create schema private; create function private.is_campaign_member(uuid) returns boolean language sql as $$select false$$;");
    assert.throws(() => cliUp('occupied_private', output), /empty public application schema/);
    assert.equal(sql('occupied_private', "select private.is_campaign_member('10000000-0000-0000-0000-000000000001');"), 'f');
    assert.equal(sql('occupied_private', "select to_regclass('public.campaigns') is null;"), 't');
    assert.equal(sql('occupied_private', 'select count(*) from supabase_migrations.schema_migrations;'), '0');
    pass('existing private ownership helper is preserved before baseline writes');
    prepare('occupied_ledger');
    sql('occupied_ledger', "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key); insert into supabase_migrations.schema_migrations values ('existing');");
    rejects('occupied_ledger', readFileSync(path.join(output, 'supabase', 'migrations', staged.record.baseline), 'utf8'), /empty migration ledger/);
    assert.equal(sql('occupied_ledger', 'select version from supabase_migrations.schema_migrations;'), 'existing');
    assert.equal(sql('occupied_ledger', "select to_regclass('public.campaigns') is null;"), 't');
    pass('nonempty migration ledger fails atomically without inventing history');
  }
  prepare('candidate');
  if (commissioning) {
    cliUp('candidate', staged.output);
    assert.equal(sql('candidate', 'select count(*) from supabase_migrations.schema_migrations;'), String(staged.record.staged.length));
    assert.equal(sql('candidate', 'select version from supabase_migrations.schema_migrations order by version limit 1;'), staged.record.baseline.split('_')[0]);
    const before = fullFingerprint('candidate');
    cliUp('candidate', staged.output);
    assert.equal(fullFingerprint('candidate'), before);
    pass('actual supported CLI commissions baseline; second run is a complete no-op');
    sql('candidate', `insert into auth.users(id) values ('${owner}'),('${outsider}');
      insert into public.campaigns(id,owner_id,title) values ('${legacyCampaign}','${owner}','Preserved legacy campaign');
      insert into public.campaign_entities(id,campaign_id,kind,name,state) values ('30000000-0000-0000-0000-000000000001','${legacyCampaign}','PC','Preserved hero','{"controlled_by":"${owner}"}');`);
  } else for (const file of historical) {
    apply('candidate', file);
    if (file === '0001_game_platform_v1.sql') {
      sql('candidate', `insert into auth.users(id) values ('${owner}'),('${outsider}');
        insert into public.campaigns(id,owner_id,name) values ('${legacyCampaign}','${owner}','Preserved legacy campaign');
        insert into public.campaign_entities(id,campaign_id,entity_type,name,state) values ('30000000-0000-0000-0000-000000000001','${legacyCampaign}','PC','Preserved hero','{"controlled_by":"${owner}"}');`);
      apply('candidate', repair);
    }
  }
  pass('all historical SQL replays', `${historical.length} files, early compatibility prelude, real pgvector${commissioning ? ', actual CLI baseline transaction' : ''}`);
  assert.equal(sql('candidate', `select title from public.campaigns where id='${legacyCampaign}';`), 'Preserved legacy campaign');
  assert.equal(sql('candidate', "select kind||':'||name from public.campaign_entities where id='30000000-0000-0000-0000-000000000001';"), 'PC:Preserved hero');
  pass(commissioning ? 'canonical fixture identities and values persist after commissioning' : 'legacy identities and values retained');

  sql('candidate', `${identity(owner)} insert into public.campaigns(id,owner_id,title,world_state) values ('${campaign}','${owner}','The Ashen Gate','{"starter_id":"ashen-gate"}');`);
  const world = JSON.parse(sql('candidate', `${identity(owner)} select json_build_object(
    'entities',(select count(*) from campaign_entities where campaign_id='${campaign}'),
    'stats',(select count(*) from character_stats where campaign_id='${campaign}'),
    'inventory',(select count(*) from inventory_items where campaign_id='${campaign}'),
    'quests',(select count(*) from campaign_quests where campaign_id='${campaign}'),
    'sessions',(select count(*) from game_sessions where campaign_id='${campaign}'),
    'npcs',(select count(*) from npcs where campaign_id='${campaign}'),
    'clock',(select count(*) from world_clocks where campaign_id='${campaign}'));`));
  assert.equal(world.entities, 11); assert.equal(world.stats, 11); assert.equal(world.inventory, 6);
  assert.equal(world.quests, 10); assert.equal(world.sessions, 1); assert.equal(world.npcs, 10); assert.equal(world.clock, 1);
  pass('authenticated starter-world bootstrap and persistence', JSON.stringify(world));
  assert.equal(sql('candidate', `${identity(outsider)} select count(*) from public.campaigns;`), '0');
  assert.equal(sql('candidate', `${identity(outsider)} select count(*) from public.campaign_entities;`), '0');
  assert.equal(sql('candidate', `${identity(outsider)} with changed as (update public.campaigns set title='forbidden' where id='${campaign}' returning id) select count(*) from changed;`), '0');
  rejects('candidate', `${identity(outsider)} insert into public.campaigns(owner_id,title) values ('${owner}','forbidden');`, /row-level security/);
  rejects('candidate', `${identity(owner)} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope) values ('${campaign}','forged','forged','{}');`, /row-level security|permission denied/);
  pass('cross-user read/write and audit-forgery denial');

  sql('candidate', `${server} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope) values ('${campaign}','audit-fixture','audit-fixture','{"actor_id":"${owner}"}');`);
  assert.equal(sql('candidate', `${identity(owner)} select count(*) from public.game_audit_log where idempotency_key='audit-fixture';`), commissioning ? '1' : '0');
  pass(commissioning ? 'commissioned baseline already restores canonical audit visibility' : 'original canonical audit visibility defect reproduced');
  apply('candidate', repair);
  const beforeRepeat = fingerprint('candidate');
  const beforeConstraint = sql('candidate', "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.campaign_memory'::regclass and conname='campaign_memory_memory_type_check';");
  apply('candidate', repair);
  assert.equal(fingerprint('candidate'), beforeRepeat);
  assert.equal(sql('candidate', "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.campaign_memory'::regclass and conname='campaign_memory_memory_type_check';"), beforeConstraint);
  assert.equal(sql('candidate', `${identity(owner)} select count(*) from public.game_audit_log where idempotency_key='audit-fixture';`), '1');
  sql('candidate', `${server} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope) values
    ('${campaign}','audit-legacy','audit-legacy','{"actor":{"id":"${owner}"}}'),
    ('${campaign}','audit-conflict','audit-conflict','{"actor_id":"${outsider}","actor":{"id":"${owner}"}}');`);
  assert.equal(sql('candidate', `${identity(owner)} select count(*) from public.game_audit_log;`), '2');
  assert.equal(sql('candidate', `${identity(outsider)} select count(*) from public.game_audit_log;`), '0');
  pass('forward repair is idempotent and preserves actor-scoped audit privacy');

  sql('candidate', `${server} insert into public.campaign_memory(campaign_id,memory_type,content) values ('${campaign}','SOCIAL','{"summary":"fixture conversation"}');
    insert into public.game_events(campaign_id,correlation_id,event_type) values ('${campaign}','fixture-event','RECOVERY_FIXTURE');`);
  rejects('candidate', `${server} insert into public.campaign_memory(campaign_id,memory_type,content) values ('${campaign}','INVALID_TYPE','{}');`, /check constraint/);
  pass('SOCIAL memory and correlated events persist with type validation intact');

  const session = sql('candidate', `select id from public.game_sessions where campaign_id='${campaign}' limit 1;`);
  sql('candidate', `${server} insert into public.game_turns(session_id,campaign_id,turn_no,speaker,content,created_at) values
    ('${session}','${campaign}',1,'PLAYER','Fixture decision','2026-10-21T00:00:00Z'),
    ('${session}','${campaign}',1,'GM','Fixture resolved consequence','2026-10-21T00:00:00Z');`);
  const snapshot = JSON.parse(sql('candidate', `${identity(owner)} select public.game_campaign_snapshot('${campaign}');`));
  assert.equal(snapshot.panels.length, 18);
  assert.deepEqual(snapshot.panels[4].data.filter(turn => turn.turn_no === 1).map(turn => turn.speaker), ['GM', 'PLAYER']);
  pass('persisted transcript snapshot is stable at equal timestamps', 'descending server window reverses to PLAYER then GM in client');

  sql('candidate', `${server} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope,turn_guard) values ('${campaign}','guard-one','guard-one','{"context":{"expected_turn":0}}',true);`);
  rejects('candidate', `${server} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope,turn_guard) values ('${campaign}','guard-two','guard-two','{"context":{"expected_turn":0}}',true);`, /game_one_active_gm_turn/);
  sql('candidate', `${server} update public.game_audit_log set turn_guard=false where idempotency_key='guard-one';`);
  rejects('candidate', `${server} insert into public.game_audit_log(campaign_id,correlation_id,idempotency_key,envelope,turn_guard) values ('${campaign}','stale','stale','{"context":{"expected_turn":-1}}',true);`, /stale_beat/);
  assert.equal(sql('candidate', `${server} select public.claim_next_game_turn('${session}');`), '1');
  const quota = JSON.parse(sql('candidate', `${identity(owner)} with admissions as materialized (select public.admit_game_narration('${campaign}') as allowed from generate_series(1,11)) select json_build_object('allowed',count(*) filter(where allowed),'denied',count(*) filter(where not allowed)) from admissions;`));
  assert.deepEqual(quota, { allowed: 10, denied: 1 });
  assert.equal(sql('candidate', `${identity(outsider)} select public.admit_game_narration('${campaign}');`), 'f');
  pass('turn concurrency, stale-scene rejection and paid-call quota admission');

  prepare('ambiguous'); apply('ambiguous', '0001_game_platform_v1.sql');
  sql('ambiguous', 'alter table public.campaigns add column title text;');
  rejects('ambiguous', migrationText(repair), /Ambiguous game schema/);
  assert.equal(sql('ambiguous', "select count(*) from information_schema.columns where table_schema='public' and table_name='campaign_entities' and column_name='entity_type';"), '1');
  pass('ambiguous legacy/canonical schema fails atomically without guessing');

  const saved = fingerprint('candidate');
  const fullSaved = commissioning ? fullFingerprint('candidate') : null;
  const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'candidate', '-Fc'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] });
  docker(['exec', container, 'createdb', '-U', 'postgres', 'recovered']);
  docker(['exec', '-i', container, 'pg_restore', '--exit-on-error', '-U', 'postgres', '-d', 'recovered'], dump);
  assert.equal(fingerprint('recovered'), saved);
  assert.equal(sql('recovered', `${identity(outsider)} select count(*) from public.campaigns;`), '0');
  pass('backup restores to independent empty database with state and RLS retained', `${dump.length} bytes of synthetic fixture backup`);
  if (commissioning) {
    assert.equal(fullFingerprint('recovered'), fullSaved, 'all public/auth/ledger rows plus schema must restore exactly');
    cliUp('recovered', staged.output);
    assert.equal(fullFingerprint('recovered'), fullSaved);
    assert.equal(sql('recovered', `${identity(owner)} select count(*) from public.campaigns where id='${campaign}';`), '1');
    assert.equal(sql('recovered', "set local role authenticated; set local request.jwt.claim.sub=''; select count(*) from public.campaigns;"), '0');
    assert.equal(sql('recovered', `${identity(outsider)} with changed as (update public.campaigns set title='forbidden' where id='${campaign}' returning id) select count(*) from changed;`), '0');
    rejects('recovered', `${identity(outsider)} insert into public.campaigns(owner_id,title) values ('${owner}','forbidden');`, /row-level security/);
    rejects('recovered', `update public.world_clocks set hour=25 where campaign_id='${campaign}';`, /check constraint/);
    rejects('recovered', "insert into public.game_sessions(campaign_id) values ('ffffffff-ffff-ffff-ffff-ffffffffffff');", /foreign key constraint/);
    pass('complete schema, all rows and CLI ledger restore; no-op replay, identity, RLS, FK and CHECK remain enforced');
    const futureRepo = path.join(scratch, 'future-repository');
    mkdirSync(path.join(futureRepo, 'supabase'), { recursive: true });
    cpSync(fileURLToPath(directory), path.join(futureRepo, 'supabase', 'migrations'), { recursive: true });
    cpSync(fileURLToPath(new URL('../supabase/fresh-install/', import.meta.url)), path.join(futureRepo, 'supabase', 'fresh-install'), { recursive: true });
    writeFileSync(path.join(futureRepo, 'supabase', 'migrations', '20990101000000_future_fixture.sql'), 'alter table public.campaigns add column commissioning_fixture text;');
    const next = path.join(scratch, 'future-staged');
    stageFreshDatabase({ output: next, repository: futureRepo });
    const baselineLedger = sql('recovered', "select md5(to_jsonb(t)::text) from supabase_migrations.schema_migrations t where version='" + staged.record.baseline.split('_')[0] + "';");
    cliUp('recovered', next);
    assert.equal(sql('recovered', 'select count(*) from supabase_migrations.schema_migrations;'), String(staged.record.staged.length + 1));
    assert.equal(sql('recovered', "select md5(to_jsonb(t)::text) from supabase_migrations.schema_migrations t where version='" + staged.record.baseline.split('_')[0] + "';"), baselineLedger);
    assert.equal(sql('recovered', `select title from public.campaigns where id='${campaign}';`), 'The Ashen Gate');
    const afterFuture = fullFingerprint('recovered');
    cliUp('recovered', next);
    assert.equal(fullFingerprint('recovered'), afterFuture);
    pass('normal future migration applies once; baseline ledger and existing state retained');
  }
  console.log(JSON.stringify({ status: 'PASS', checks, limitations: ['PostgreSQL roles/auth.uid fixture models Supabase DB identity; actual Auth, PostgREST, Deno deployment and browser gameplay are not executed.', commissioning ? 'Fresh CLI staging is tested on isolated PostgreSQL with Supabase identity fixtures; managed Auth/PostgREST/Edge and cloud recovery remain separate gates.' : 'Historical Supabase version collision remains; production migration history is never changed by this suite.'] }));
} catch (error) {
  console.error(`FAIL recovery suite: ${error.message.replaceAll(password, '[redacted]')}`);
  if (error.stderr) console.error(String(error.stderr).replaceAll(password, '[redacted]'));
  process.exitCode = 1;
} finally {
  if (created) {
    const label = docker(['inspect', '--format', '{{index .Config.Labels "abex.game-recovery"}}', container]).trim();
    assert.equal(label, runId, 'only remove this invocation\'s own test container');
    docker(['rm', '--force', container]);
    console.log('PASS disposable recovery container removed');
  }
  if (networkCreated) {
    assert.equal(docker(['network', 'inspect', '--format', '{{index .Labels "abex.game-recovery"}}', network]).trim(), runId);
    docker(['network', 'rm', network]);
    console.log('PASS owned test network removed');
  }
  if (scratch) {
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(scratch).startsWith('game-commissioning-'));
    rmSync(scratch, { recursive: true, force: true });
  }
}
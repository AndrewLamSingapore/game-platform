/** Disposable PostgreSQL/pgvector replay. Never accepts a database URL or credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const image = 'pgvector/pgvector@sha256:ac08538c6f8b9904c33c8224c5e5706dbe760aca29db1d096972b4052c22a75d';
const runId = randomUUID();
const container = `abex-game-recovery-${runId}`;
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
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
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
  // --pull=never prevents implicit network downloads. No published port or network peer.
  docker(['image', 'inspect', image]);
  docker(['run', '--detach', '--pull=never', '--name', container, '--label', `abex.game-recovery=${runId}`, '--network', 'none', '--memory', '384m', '--cpus', '0.5', '--mount', 'type=tmpfs,destination=/var/lib/postgresql/data,tmpfs-size=134217728', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { docker(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(ready, 'disposable PostgreSQL must start');
  sql('postgres', 'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;');
  const settings = JSON.parse(docker(['inspect', '--format', '{{json .HostConfig}}', container]));
  assert.equal(settings.NetworkMode, 'none'); assert.deepEqual(settings.PortBindings || {}, {});
  pass('database isolation', 'network none, no published ports, tmpfs data, 384MiB/0.5 CPU');
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

  prepare('candidate');
  for (const file of historical) {
    apply('candidate', file);
    if (file === '0001_game_platform_v1.sql') {
      sql('candidate', `insert into auth.users(id) values ('${owner}'),('${outsider}');
        insert into public.campaigns(id,owner_id,name) values ('${legacyCampaign}','${owner}','Preserved legacy campaign');
        insert into public.campaign_entities(id,campaign_id,entity_type,name,state) values ('30000000-0000-0000-0000-000000000001','${legacyCampaign}','PC','Preserved hero','{"controlled_by":"${owner}"}');`);
      apply('candidate', repair);
    }
  }
  pass('all historical SQL replays', `${historical.length} files, early compatibility prelude, real pgvector`);
  assert.equal(sql('candidate', `select title from public.campaigns where id='${legacyCampaign}';`), 'Preserved legacy campaign');
  assert.equal(sql('candidate', "select kind||':'||name from public.campaign_entities where id='30000000-0000-0000-0000-000000000001';"), 'PC:Preserved hero');
  pass('legacy identities and values retained');

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
  assert.equal(sql('candidate', `${identity(owner)} select count(*) from public.game_audit_log where idempotency_key='audit-fixture';`), '0');
  pass('original canonical audit visibility defect reproduced');
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
  const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-d', 'candidate', '-Fc'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] });
  docker(['exec', container, 'createdb', '-U', 'postgres', 'recovered']);
  docker(['exec', '-i', container, 'pg_restore', '--exit-on-error', '-U', 'postgres', '-d', 'recovered'], dump);
  assert.equal(fingerprint('recovered'), saved);
  assert.equal(sql('recovered', `${identity(outsider)} select count(*) from public.campaigns;`), '0');
  pass('backup restores to independent empty database with state and RLS retained', `${dump.length} bytes of synthetic fixture backup`);
  console.log(JSON.stringify({ status: 'PASS', checks, limitations: ['PostgreSQL roles/auth.uid fixture models Supabase DB identity; actual Auth, PostgREST, Deno deployment and browser gameplay are not executed.', 'Historical Supabase version collision remains; production migration history is never changed by this suite.'] }));
} catch (error) {
  console.error(`FAIL recovery suite: ${error.message}`);
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  if (created) {
    const label = docker(['inspect', '--format', '{{index .Config.Labels "abex.game-recovery"}}', container]).trim();
    assert.equal(label, runId, 'only remove this invocation\'s own test container');
    docker(['rm', '--force', container]);
    console.log('PASS disposable recovery container removed');
  }
}
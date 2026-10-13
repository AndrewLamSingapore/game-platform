import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestRecovery } from '../src/guest-recovery.js';

test('an unavailable guest backend exposes recovery after one bounded wait', () => {
  let callback, scheduled = 0, failures = 0;
  const recovery = createGuestRecovery(() => failures++, {
    schedule(fn, ms) { assert.equal(ms, 15000); callback = fn; scheduled++; return 1; },
    cancel() {},
  });
  recovery.start(); recovery.start();
  assert.equal(scheduled, 1);
  callback();
  assert.equal(failures, 1);
});

test('successful or failed authentication cancels the wait and permits another attempt', () => {
  const pending = new Map(); let id = 0;
  const recovery = createGuestRecovery(() => assert.fail('finished authentication must not time out'), {
    schedule(fn) { pending.set(++id, fn); return id; },
    cancel(key) { pending.delete(key); },
  });
  recovery.start(); recovery.finish();
  assert.equal(pending.size, 0);
  recovery.start(); assert.equal(pending.size, 1);
  recovery.finish(); assert.equal(pending.size, 0);
});

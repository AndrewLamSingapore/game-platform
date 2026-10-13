// Bound the loading UI without cancelling or clearing a browser's identity.
export function createGuestRecovery(onTimeout, { timeoutMs = 15000, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let timer = null;
  return {
    start() {
      if (timer !== null) return;
      timer = schedule(() => { onTimeout(); }, timeoutMs);
    },
    finish() {
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}

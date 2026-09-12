/**
 * Run a pick after `locked` is already true.
 * Always schedules `onDone` (typically `nextDuel`, which clears `locked`)
 * even if `work` throws.
 */
export function runLockedPick(work, onDone, schedule = setTimeout, delay = 420) {
  try {
    work();
  } finally {
    schedule(onDone, delay);
  }
}

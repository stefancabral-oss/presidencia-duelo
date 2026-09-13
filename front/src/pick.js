/**
 * Run a pick after `locked` is already true.
 * Always schedules `onDone` (typically `nextDuel`, which clears `locked`)
 * even if `work` throws.
 */
export const PICK_FEEDBACK_MS = 900;

export function runLockedPick(work, onDone, schedule = setTimeout, delay = PICK_FEEDBACK_MS) {
  try {
    work();
    return schedule(onDone, delay);
  } catch (error) {
    schedule(onDone, delay);
    throw error;
  }
}

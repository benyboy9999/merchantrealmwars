import cron from 'node-cron';

/**
 * Weekly Region control reset.
 * Evaluates which guild should take control for the next week.
 * Mechanism TBD — see CLAUDE.md (TBD Systems > Region control mechanism).
 */
export function startControlJob(): void {
  // Runs every Monday at 00:00 UTC
  cron.schedule('0 0 * * 1', () => {
    // TODO: implement region control evaluation once mechanism is designed
    console.warn('🏰 Weekly region control evaluation — not yet implemented');
  });
}

import { useState, useEffect } from 'react';

/** Returns a 0–1 value that updates every second based on wall-clock progress between two timestamps. */
export function useLivePercent(startAt: string | null | undefined, endAt: string | null | undefined): number {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!startAt || !endAt) { setPct(0); return; }
    const update = () => {
      const now   = Date.now();
      const start = new Date(startAt).getTime();
      const end   = new Date(endAt).getTime();
      if (end <= start) { setPct(1); return; }
      setPct(Math.min(1, Math.max(0, (now - start) / (end - start))));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startAt, endAt]);

  return pct;
}

/**
 * Smooth client-side interpolation for production progress.
 * Starts from the server's last-known progress and increments at the recipe rate.
 * Snaps back to server value on each tick update.
 * Returns a 0–1 value — wraps to 0 when a batch completes so the bar resets cleanly.
 */
export function useInterpolatedProgress(serverProgress: number, timeMinutes: number): number {
  const [pct, setPct] = useState(serverProgress);

  // Snap to server value whenever a tick updates it
  useState(() => { setPct(serverProgress); });

  useEffect(() => {
    setPct(serverProgress);
  }, [serverProgress]);

  useEffect(() => {
    if (!timeMinutes) return;
    const ratePerMs = 1 / (timeMinutes * 60 * 1000);
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      setPct((p) => {
        const next = p + ratePerMs * delta;
        return next >= 1 ? next - 1 : next; // carryover so bar resets and restarts
      });
    }, 100);
    return () => clearInterval(id);
  }, [timeMinutes]);

  return pct;
}

/** Returns a 0–1 looping value since lastAt with the given period in seconds. */
export function useTickPercent(lastAt: string | null | undefined, intervalSeconds: number): number {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!lastAt || !intervalSeconds) { setPct(0); return; }
    const update = () => {
      const now     = Date.now();
      const last    = new Date(lastAt).getTime();
      const elapsed = (now - last) % (intervalSeconds * 1000);
      setPct(elapsed / (intervalSeconds * 1000));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [lastAt, intervalSeconds]);

  return pct;
}

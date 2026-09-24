/**
 * Who hands the loop its frames.
 *
 * Behind a token rather than reaching for the global, because Angular's own zoneless
 * change detection also schedules animation frames. A test that stubs the global
 * intercepts both and can no longer tell the game loop's frames from the framework's.
 */

import { InjectionToken } from '@angular/core';

export interface FrameScheduler {
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
}

export const FRAME_SCHEDULER = new InjectionToken<FrameScheduler>('FRAME_SCHEDULER', {
  providedIn: 'root',
  factory: () => ({
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  }),
});

/** A scheduler the caller drives by hand. Used by the loop's tests. */
export function manualFrameScheduler(): FrameScheduler & {
  pending: Map<number, (now: number) => void>;
  run(now: number): void;
} {
  const pending = new Map<number, (now: number) => void>();
  let nextHandle = 0;
  return {
    pending,
    request(callback) {
      const handle = ++nextHandle;
      pending.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      pending.delete(handle);
    },
    run(now) {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, callback] of due) {
        callback(now);
      }
    },
  };
}

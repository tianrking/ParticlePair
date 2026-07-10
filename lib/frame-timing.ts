export interface FrameTimingSnapshot {
  fps: number;
  frameIntervalMs: number;
  jitterMs: number;
  pairToleranceMs: number;
  state: "measuring" | "stable" | "jittery";
}

const DEFAULT_TOLERANCE_MS = 120;
const MIN_TOLERANCE_MS = 72;
const MAX_TOLERANCE_MS = 145;

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Robust camera cadence estimator; isolated stalls cannot dominate the window. */
export class FrameTimingEstimator {
  private intervals: number[] = [];
  private lastTimestamp: number | null = null;

  reset(): void { this.intervals = []; this.lastTimestamp = null; }

  observe(timestamp: number): FrameTimingSnapshot {
    if (this.lastTimestamp !== null) {
      const interval = timestamp - this.lastTimestamp;
      if (interval >= 4 && interval <= 500) {
        this.intervals.push(interval);
        if (this.intervals.length > 15) this.intervals.shift();
      }
    }
    this.lastTimestamp = timestamp;
    return this.snapshot();
  }

  snapshot(): FrameTimingSnapshot {
    if (this.intervals.length < 4) return { fps: 0, frameIntervalMs: 0, jitterMs: 0, pairToleranceMs: DEFAULT_TOLERANCE_MS, state: "measuring" };
    const frameIntervalMs = median(this.intervals);
    const jitterMs = median(this.intervals.map((interval) => Math.abs(interval - frameIntervalMs)));
    const pairToleranceMs = Math.round(Math.max(MIN_TOLERANCE_MS, Math.min(MAX_TOLERANCE_MS, 44 + frameIntervalMs * 0.52 + jitterMs * 3)));
    return { fps: Math.round(1000 / frameIntervalMs), frameIntervalMs, jitterMs, pairToleranceMs, state: jitterMs > Math.max(9, frameIntervalMs * 0.28) ? "jittery" : "stable" };
  }
}

export function selectPhaseReference<T extends { timestamp: number }>(history: readonly T[], timestamp: number, phaseDurationMs: number, toleranceMs: number): T | undefined {
  let best: T | undefined; let bestDistance = Number.POSITIVE_INFINITY;
  for (const frame of history) {
    const distance = Math.abs(timestamp - frame.timestamp - phaseDurationMs);
    if (distance <= toleranceMs && distance < bestDistance) { best = frame; bestDistance = distance; }
  }
  return best;
}

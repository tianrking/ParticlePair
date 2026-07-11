import { PHASE_DURATION_MS } from "./optical-layout";

export interface OpticalPhaseSnapshot {
  phase: "A" | "B";
  progress: number;
  remainingMs: number;
}

export function opticalPhaseSnapshot(timeMs: number): OpticalPhaseSnapshot {
  const phaseIndex = Math.floor(timeMs / PHASE_DURATION_MS);
  const elapsed = ((timeMs % PHASE_DURATION_MS) + PHASE_DURATION_MS) % PHASE_DURATION_MS;
  return { phase: phaseIndex % 2 === 0 ? "A" : "B", progress: elapsed / PHASE_DURATION_MS, remainingMs: PHASE_DURATION_MS - elapsed };
}

/** Schedules choreography on the next complete A+B pair boundary after dwell. */
export function phaseSafeShowcaseDelay(nowMs: number, minimumDwellMs = 4200): number {
  const pairDuration = PHASE_DURATION_MS * 2;
  const earliest = nowMs + Math.max(pairDuration, minimumDwellMs);
  const boundary = Math.ceil((earliest + 0.0001) / pairDuration) * pairDuration;
  return boundary - nowMs;
}

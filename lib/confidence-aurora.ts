export type ConfidenceAuroraState = "idle" | "acquiring" | "aligning" | "collecting" | "ready" | "degraded";

export interface ConfidenceAuroraInput {
  captureHealth: number | null;
  captureState: "healthy" | "clipped" | "dark" | "flat" | null;
  complete: boolean;
  consensus: number;
  consensusState: "measuring" | "stable" | "ambiguous";
  evidenceCount: number;
  focus: number | null;
  payloadCoverage: number | null;
  running: boolean;
  sync: number;
  timingState: "measuring" | "stable" | "jittery";
}

export interface ConfidenceAuroraSnapshot {
  bottleneck: "capture" | "sync" | "geometry" | "evidence" | "payload" | "none";
  metrics: { capture: number; sync: number; geometry: number; evidence: number; payload: number };
  score: number;
  state: ConfidenceAuroraState;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Maps independent scanner evidence into an honest, non-protocol visual summary. */
export function confidenceAurora(input: ConfidenceAuroraInput): ConfidenceAuroraSnapshot {
  if (!input.running) return { bottleneck: "none", metrics: { capture: 0, sync: 0, geometry: 0, evidence: 0, payload: 0 }, score: 0, state: "idle" };
  if (input.complete) return { bottleneck: "none", metrics: { capture: 1, sync: 1, geometry: 1, evidence: 1, payload: 1 }, score: 100, state: "ready" };
  const capture = input.captureHealth === null ? 0.08 : clamp(input.captureHealth * (0.7 + clamp(input.focus ?? 0) * 0.3));
  const sync = clamp(input.sync / 100);
  const geometry = input.consensusState === "stable" ? clamp(input.consensus) : input.consensusState === "ambiguous" ? clamp(input.consensus * 0.35) : clamp(input.consensus * 0.55);
  const evidence = clamp(input.evidenceCount / 3);
  const payload = clamp(input.payloadCoverage ?? 0);
  const metrics = { capture, sync, geometry, evidence, payload };
  const score = Math.round((capture * 0.18 + sync * 0.28 + geometry * 0.2 + evidence * 0.14 + payload * 0.2) * 100);
  const bottleneck = (Object.entries(metrics) as [Exclude<ConfidenceAuroraSnapshot["bottleneck"], "none">, number][]).reduce((lowest, entry) => entry[1] < lowest[1] ? entry : lowest)[0];
  const degraded = input.captureState === "clipped" || input.captureState === "dark" || input.captureState === "flat" || input.timingState === "jittery" || input.consensusState === "ambiguous";
  const state: ConfidenceAuroraState = degraded ? "degraded" : score >= 78 && evidence >= 2 / 3 && payload >= 0.72 ? "ready" : evidence > 0 || payload > 0 ? "collecting" : sync >= 0.25 ? "aligning" : "acquiring";
  return { bottleneck, metrics, score, state };
}

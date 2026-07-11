import { RELIABILITY_CASE_COUNT, RELIABILITY_SECRET_COUNT, type ReliabilityEvidence } from "./reliability-evidence";
import { VISUAL_MODE_COUNT } from "./visual-modes";

export type ReliabilityDeltaState = "improved" | "regressed" | "stable";

export interface ReliabilityComparison {
  averageQualityDelta: number;
  cells: readonly { delta: number; state: ReliabilityDeltaState }[];
  improved: number;
  modes: readonly { averageDelta: number; improved: number; index: number; regressed: number; worstDelta: number }[];
  regressed: number;
  stable: number;
  verdict: "improved" | "regressed" | "mixed" | "stable";
}

const MEANINGFUL_DELTA = 0.02;

export function compareReliabilityEvidence(baseline: ReliabilityEvidence, candidate: ReliabilityEvidence): ReliabilityComparison {
  if (baseline.corpus.id !== candidate.corpus.id || baseline.results.length !== RELIABILITY_CASE_COUNT || candidate.results.length !== RELIABILITY_CASE_COUNT) throw new Error("Reliability evidence corpora are not comparable");
  const cells = baseline.results.map((before, index) => {
    const after = candidate.results[index];
    const delta = Number((after.quality - before.quality).toFixed(4));
    const state: ReliabilityDeltaState = !before.passed && after.passed ? "improved"
      : before.passed && !after.passed ? "regressed"
      : delta >= MEANINGFUL_DELTA ? "improved"
      : delta <= -MEANINGFUL_DELTA ? "regressed" : "stable";
    return { delta, state };
  });
  const improved = cells.filter((cell) => cell.state === "improved").length;
  const regressed = cells.filter((cell) => cell.state === "regressed").length;
  const stable = cells.length - improved - regressed;
  const averageQualityDelta = Number((cells.reduce((sum, cell) => sum + cell.delta, 0) / cells.length).toFixed(4));
  const modes = Array.from({ length: VISUAL_MODE_COUNT }, (_, index) => {
    const modeCells = Array.from({ length: RELIABILITY_SECRET_COUNT }, (_, secret) => cells[secret * VISUAL_MODE_COUNT + index]);
    return {
      averageDelta: Number((modeCells.reduce((sum, cell) => sum + cell.delta, 0) / modeCells.length).toFixed(4)),
      improved: modeCells.filter((cell) => cell.state === "improved").length,
      index,
      regressed: modeCells.filter((cell) => cell.state === "regressed").length,
      worstDelta: Math.min(...modeCells.map((cell) => cell.delta)),
    };
  }).sort((a, b) => b.regressed - a.regressed || a.averageDelta - b.averageDelta || a.index - b.index);
  const verdict = regressed === 0 && improved === 0 ? "stable" : regressed === 0 ? "improved" : improved === 0 ? "regressed" : "mixed";
  return { averageQualityDelta, cells, improved, modes, regressed, stable, verdict };
}

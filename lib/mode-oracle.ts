import { VISUAL_MODES, type VisualModeId } from "./visual-modes";

export interface ModeChannelObservation {
  corrected: number;
  mode: VisualModeId;
  passed: boolean;
  quality: number;
}

export interface RankedModeChannelObservation extends ModeChannelObservation {
  rank: number;
  score: number;
}

/** Exact recovery dominates; then higher sync quality and fewer repairs win. */
export function rankModeChannelObservations(observations: readonly ModeChannelObservation[]): RankedModeChannelObservation[] {
  return observations.map((observation) => ({ ...observation, score: observation.passed ? Math.round(observation.quality * 10_000) - observation.corrected * 12 : -10_000 + Math.round(observation.quality * 100) }))
    .sort((left, right) => right.score - left.score || VISUAL_MODES.findIndex((mode) => mode.id === left.mode) - VISUAL_MODES.findIndex((mode) => mode.id === right.mode))
    .map((observation, index) => ({ ...observation, rank: index + 1 }));
}

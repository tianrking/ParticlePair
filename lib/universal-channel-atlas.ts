import { VISUAL_MODES, type VisualModeId } from "./visual-modes";
import type { CameraChannelProfile } from "./rendered-pixel-loopback";

export interface AtlasObservation {
  corrected: number;
  mode: VisualModeId;
  passed: boolean;
  profile: CameraChannelProfile;
  quality: number;
}

export interface AtlasModeRank {
  averageQuality: number;
  mode: VisualModeId;
  passed: number;
  rank: number;
  totalCorrected: number;
  worstQuality: number;
}

/** Minimax ranking: complete CRC coverage, then the weakest channel, mean quality, and repair cost. */
export function rankUniversalChannelAtlas(observations: readonly AtlasObservation[]): AtlasModeRank[] {
  const grouped = new Map<VisualModeId, AtlasObservation[]>();
  for (const observation of observations) grouped.set(observation.mode, [...(grouped.get(observation.mode) ?? []), observation]);
  return VISUAL_MODES.map((mode) => {
    const cells = grouped.get(mode.id) ?? [];
    return {
      averageQuality: cells.length ? cells.reduce((sum, cell) => sum + cell.quality, 0) / cells.length : 0,
      mode: mode.id,
      passed: cells.filter((cell) => cell.passed).length,
      rank: 0,
      totalCorrected: cells.reduce((sum, cell) => sum + cell.corrected, 0),
      worstQuality: cells.length ? Math.min(...cells.map((cell) => cell.quality)) : 0,
    };
  }).sort((left, right) => right.passed - left.passed || right.worstQuality - left.worstQuality || right.averageQuality - left.averageQuality || left.totalCorrected - right.totalCorrected || VISUAL_MODES.findIndex((mode) => mode.id === left.mode) - VISUAL_MODES.findIndex((mode) => mode.id === right.mode))
    .map((result, index) => ({ ...result, averageQuality: Number(result.averageQuality.toFixed(4)), rank: index + 1, worstQuality: Number(result.worstQuality.toFixed(4)) }));
}

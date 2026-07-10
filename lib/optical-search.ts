import {
  analyzeDifferentialFrames,
  OPTICAL_TRANSFORMS,
  transformOpticalSamples,
  type DifferentialFrameAnalysis,
  type OpticalTransform,
} from "./optical-decoder";
import { CELL_COUNT } from "./optical-layout";
import type { CameraCaptureHealth } from "./perspective-sampling";

export interface OpticalSampleCandidate {
  captureHealth?: CameraCaptureHealth;
  key: string;
  values: number[];
}

export interface OpticalSampleFrame {
  candidates: OpticalSampleCandidate[];
  timestamp: number;
}

export interface RankedFrameAnalysis {
  analysis: DifferentialFrameAnalysis;
  captureHealth?: CameraCaptureHealth;
  key: string;
  transform: OpticalTransform;
}

export function rankOpticalFrameAnalyses(
  current: OpticalSampleFrame,
  reference: OpticalSampleFrame,
  resultCount = 3,
): RankedFrameAnalysis[] {
  const matches: RankedFrameAnalysis[] = [];

  for (let index = 0; index < current.candidates.length; index += 1) {
    const currentCandidate = current.candidates[index];
    const referenceCandidate = reference.candidates[index];
    if (!referenceCandidate || currentCandidate.key !== referenceCandidate.key) {
      continue;
    }

    for (const transform of OPTICAL_TRANSFORMS) {
      const canonicalCurrent = transformOpticalSamples(currentCandidate.values, transform);
      const canonicalReference = transformOpticalSamples(referenceCandidate.values, transform);
      const analysis = analyzeDifferentialFrames(canonicalCurrent, canonicalReference);
      matches.push({ analysis, captureHealth: currentCandidate.captureHealth, key: currentCandidate.key, transform });
    }
  }

  return matches
    .sort((left, right) => right.analysis.quality - left.analysis.quality)
    .slice(0, resultCount);
}

export function averageOpticalEvidence(frames: readonly number[][]): number[] {
  return Array.from({ length: CELL_COUNT }, (_, cellIndex) =>
    frames.reduce((sum, frame) => sum + frame[cellIndex], 0) / frames.length,
  );
}

export interface WeightedOpticalEvidence {
  confidence: number[];
  differences: number[];
}

/** Robust soft combiner: quality-weighted, cell-wise winsorized evidence. */
export function combineOpticalEvidence(
  frames: readonly { differences: readonly number[]; quality: number }[],
): WeightedOpticalEvidence {
  if (!frames.length) return { confidence: Array(CELL_COUNT).fill(0), differences: Array(CELL_COUNT).fill(0) };
  const differences = Array.from({ length: CELL_COUNT }, (_, cellIndex) => {
    const samples = frames.map((frame) => ({ value: frame.differences[cellIndex], weight: Math.max(0.05, frame.quality ** 2) })).sort((left, right) => left.value - right.value);
    const usable = samples.length >= 5 ? samples.slice(1, -1) : samples;
    const weight = usable.reduce((sum, sample) => sum + sample.weight, 0) || 1;
    return usable.reduce((sum, sample) => sum + sample.value * sample.weight, 0) / weight;
  });
  const magnitudes = differences.map(Math.abs).sort((left, right) => left - right);
  const reference = magnitudes[Math.floor(magnitudes.length * 0.72)] || 1;
  return { differences, confidence: differences.map((value) => Math.min(1, Math.abs(value) / reference)) };
}

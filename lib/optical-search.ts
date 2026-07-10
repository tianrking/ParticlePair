import {
  analyzeDifferentialDifferences,
  OPTICAL_TRANSFORMS,
  transformOpticalSamples,
  type DifferentialFrameAnalysis,
  type OpticalTransform,
} from "./optical-decoder";
import { CELL_COUNT } from "./optical-layout";

export interface OpticalSampleCandidate {
  key: string;
  values: number[];
}

export interface OpticalSampleFrame {
  candidates: OpticalSampleCandidate[];
  timestamp: number;
}

export interface RankedFrameAnalysis {
  analysis: DifferentialFrameAnalysis;
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

    const rawDifferences = currentCandidate.values.map(
      (value, cellIndex) => value - referenceCandidate.values[cellIndex],
    );

    for (const transform of OPTICAL_TRANSFORMS) {
      const canonicalDifferences = transformOpticalSamples(
        rawDifferences,
        transform,
      );
      const analysis = analyzeDifferentialDifferences(canonicalDifferences);
      matches.push({ analysis, key: currentCandidate.key, transform });
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

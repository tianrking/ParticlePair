import {
  CELL_COUNT,
  extractPayloadBits,
  isBorderCell,
  synchronizationBit,
  GRID_SIZE,
} from "./optical-layout";
import { decodeParticleCode, type DecodedParticleCode } from "./protocol";

export interface DifferentialFrameAnalysis {
  cells: boolean[];
  differences: number[];
  exposureGain: number;
  exposureShift: number;
  orientation: 1 | -1;
  rawSyncCorrelation: number;
  quality: number;
}

// The camera searches 25 crops in all 8 square symmetries. Taking the best of
// 200 sign correlations gives unrelated images a repeatable 30–40% apparent
// match. Treat correlations up to 50% as the multiple-candidate noise floor so
// the public quality value represents evidence above chance, not raw luck.
const RANDOM_SYNC_CORRELATION_FLOOR = 0.5;

export const OPTICAL_TRANSFORMS = [
  "identity",
  "rotate90",
  "rotate180",
  "rotate270",
  "mirror",
  "mirrorRotate90",
  "mirrorRotate180",
  "mirrorRotate270",
] as const;

export type OpticalTransform = (typeof OPTICAL_TRANSFORMS)[number];
export type OpticalQuadrant = "top-left" | "top-right" | "bottom-left" | "bottom-right";

function sourceCoordinates(outputRow: number, outputColumn: number, size: number, transform: OpticalTransform): { column: number; row: number } {
  const mirrored = transform.startsWith("mirror");
  const rotation = transform.endsWith("Rotate90") ? 1 : transform.endsWith("Rotate180") ? 2 : transform.endsWith("Rotate270") ? 3 : transform === "rotate90" ? 1 : transform === "rotate180" ? 2 : transform === "rotate270" ? 3 : 0;
  let row = outputRow; let column = outputColumn;
  if (rotation === 1) { row = size - 1 - outputColumn; column = outputRow; }
  else if (rotation === 2) { row = size - 1 - outputRow; column = size - 1 - outputColumn; }
  else if (rotation === 3) { row = outputColumn; column = size - 1 - outputRow; }
  if (mirrored) column = size - 1 - column;
  return { column, row };
}

/** Map a canonical decoded quadrant back into the camera-observed orientation. */
export function observedQuadrantForTransform(quadrant: OpticalQuadrant, transform: OpticalTransform): OpticalQuadrant {
  const outputRow = quadrant.startsWith("bottom") ? 1 : 0; const outputColumn = quadrant.endsWith("right") ? 1 : 0;
  const source = sourceCoordinates(outputRow, outputColumn, 2, transform);
  return `${source.row ? "bottom" : "top"}-${source.column ? "right" : "left"}` as OpticalQuadrant;
}

/** Apply one of the eight square-grid symmetries to observed optical samples. */
export function transformOpticalSamples(
  samples: readonly number[],
  transform: OpticalTransform,
): number[] {
  if (samples.length !== CELL_COUNT) {
    throw new Error(`Optical samples must contain exactly ${CELL_COUNT} cells`);
  }

  return Array.from({ length: CELL_COUNT }, (_, outputIndex) => {
    const outputRow = Math.floor(outputIndex / GRID_SIZE);
    const outputColumn = outputIndex % GRID_SIZE;
    const source = sourceCoordinates(outputRow, outputColumn, GRID_SIZE, transform);
    return samples[source.row * GRID_SIZE + source.column];
  });
}

/**
 * Compare two sampled optical frames.
 *
 * The known synchronization border is fitted as:
 *   difference = exposureShift + signalGain * expectedSign
 * This separates global exposure drift from the bipolar optical signal without
 * using the unknown payload cells to estimate the camera offset.
 */
export function analyzeDifferentialFrames(
  current: readonly number[],
  reference: readonly number[],
): DifferentialFrameAnalysis {
  if (current.length !== CELL_COUNT || reference.length !== CELL_COUNT) {
    throw new Error(`Optical samples must contain exactly ${CELL_COUNT} cells`);
  }

  const exposureGain = estimateExposureGain(current, reference);
  return analyzeDifferentialDifferences(
    current.map((value, index) => value - exposureGain * reference[index]),
    exposureGain,
  );
}

/** Fit camera auto-exposure gain on the known bipolar border without payload data. */
function estimateExposureGain(current: readonly number[], reference: readonly number[]): number {
  const samples = current
    .map((value, index) => ({ current: value, reference: reference[index], index }))
    .filter(({ index }) => isBorderCell(index));
  const groupMean = (source: "current" | "reference", sign: boolean) => {
    const group = samples.filter((sample) => synchronizationBit(sample.index) === sign);
    return group.reduce((sum, sample) => sum + sample[source], 0) / group.length;
  };
  // The alternating border has equal bright/dim populations. Their separation
  // is invariant to additive black-level shifts, so the ratio estimates only
  // multiplicative exposure/white-balance gain.
  const currentSeparation = Math.abs(groupMean("current", true) - groupMean("current", false));
  const referenceSeparation = Math.abs(groupMean("reference", true) - groupMean("reference", false));
  if (referenceSeparation < 1e-6) return 1;
  const gain = currentSeparation / referenceSeparation;
  return Math.min(2.5, Math.max(0.35, gain));
}

export function analyzeDifferentialDifferences(
  rawDifferences: readonly number[],
  exposureGain = 1,
): DifferentialFrameAnalysis {
  if (rawDifferences.length !== CELL_COUNT) {
    throw new Error(`Optical differences must contain exactly ${CELL_COUNT} cells`);
  }

  const borderSamples = rawDifferences
    .map((difference, index) => ({
      difference,
      expected: synchronizationBit(index) ? 1 : -1,
      index,
    }))
    .filter(({ index }) => isBorderCell(index));

  const meanExpected =
    borderSamples.reduce((sum, sample) => sum + sample.expected, 0) /
    borderSamples.length;
  const meanDifference =
    borderSamples.reduce((sum, sample) => sum + sample.difference, 0) /
    borderSamples.length;

  let covariance = 0;
  let expectedVariance = 0;
  for (const sample of borderSamples) {
    covariance +=
      (sample.expected - meanExpected) *
      (sample.difference - meanDifference);
    expectedVariance += (sample.expected - meanExpected) ** 2;
  }

  const signalGain = expectedVariance === 0 ? 0 : covariance / expectedVariance;
  const exposureShift = meanDifference - signalGain * meanExpected;
  const differences = rawDifferences.map((difference) => difference - exposureShift);
  const orientation: 1 | -1 = signalGain >= 0 ? 1 : -1;

  let signedMatches = 0;
  for (const sample of borderSamples) {
    const observedSign = Math.sign(differences[sample.index]);
    signedMatches += observedSign * sample.expected;
  }
  const signedCorrelation = signedMatches / borderSamples.length;
  const rawSyncCorrelation = Math.abs(signedCorrelation);
  const quality = Math.min(
    1,
    Math.max(
      0,
      (rawSyncCorrelation - RANDOM_SYNC_CORRELATION_FLOOR) /
        (1 - RANDOM_SYNC_CORRELATION_FLOOR),
    ),
  );
  const cells = differences.map(
    (difference) => difference * orientation > 0,
  );

  return {
    cells,
    differences,
    exposureGain,
    exposureShift,
    orientation,
    rawSyncCorrelation,
    quality,
  };
}

export function decodeDifferentialFrames(
  current: readonly number[],
  reference: readonly number[],
): { analysis: DifferentialFrameAnalysis; decoded: DecodedParticleCode } {
  const analysis = analyzeDifferentialFrames(current, reference);
  const decoded = decodeParticleCode(extractPayloadBits(analysis.cells));
  return { analysis, decoded };
}

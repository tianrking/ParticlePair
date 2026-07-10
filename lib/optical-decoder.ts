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
  exposureShift: number;
  orientation: 1 | -1;
  quality: number;
}

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

/** Apply one of the eight square-grid symmetries to observed optical samples. */
export function transformOpticalSamples(
  samples: readonly number[],
  transform: OpticalTransform,
): number[] {
  if (samples.length !== CELL_COUNT) {
    throw new Error(`Optical samples must contain exactly ${CELL_COUNT} cells`);
  }

  const mirrored = transform.startsWith("mirror");
  const rotation = transform.endsWith("Rotate90")
    ? 1
    : transform.endsWith("Rotate180")
      ? 2
      : transform.endsWith("Rotate270")
        ? 3
        : transform === "rotate90"
          ? 1
          : transform === "rotate180"
            ? 2
            : transform === "rotate270"
              ? 3
              : 0;

  return Array.from({ length: CELL_COUNT }, (_, outputIndex) => {
    const outputRow = Math.floor(outputIndex / GRID_SIZE);
    const outputColumn = outputIndex % GRID_SIZE;
    let sourceRow = outputRow;
    let sourceColumn = outputColumn;

    if (rotation === 1) {
      sourceRow = GRID_SIZE - 1 - outputColumn;
      sourceColumn = outputRow;
    } else if (rotation === 2) {
      sourceRow = GRID_SIZE - 1 - outputRow;
      sourceColumn = GRID_SIZE - 1 - outputColumn;
    } else if (rotation === 3) {
      sourceRow = outputColumn;
      sourceColumn = GRID_SIZE - 1 - outputRow;
    }

    if (mirrored) sourceColumn = GRID_SIZE - 1 - sourceColumn;
    return samples[sourceRow * GRID_SIZE + sourceColumn];
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

  return analyzeDifferentialDifferences(
    current.map((value, index) => value - reference[index]),
  );
}

export function analyzeDifferentialDifferences(
  rawDifferences: readonly number[],
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
  const quality = Math.min(1, Math.max(0, Math.abs(signedCorrelation)));
  const cells = differences.map(
    (difference) => difference * orientation > 0,
  );

  return { cells, differences, exposureShift, orientation, quality };
}

export function decodeDifferentialFrames(
  current: readonly number[],
  reference: readonly number[],
): { analysis: DifferentialFrameAnalysis; decoded: DecodedParticleCode } {
  const analysis = analyzeDifferentialFrames(current, reference);
  const decoded = decodeParticleCode(extractPayloadBits(analysis.cells));
  return { analysis, decoded };
}

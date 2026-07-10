import {
  CELL_COUNT,
  extractPayloadBits,
  isBorderCell,
  synchronizationBit,
} from "./optical-layout";
import { decodeParticleCode, type DecodedParticleCode } from "./protocol";

export interface DifferentialFrameAnalysis {
  cells: boolean[];
  differences: number[];
  exposureShift: number;
  orientation: 1 | -1;
  quality: number;
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

  const rawDifferences = current.map((value, index) => value - reference[index]);
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

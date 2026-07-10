import assert from "node:assert/strict";
import test from "node:test";
import {
  guideCropCandidates,
  objectFitCoverSourceRectangle,
} from "../lib/camera-geometry";
import { opticalPixelValue } from "../lib/optical-color";
import {
  CELL_COUNT,
  extractPayloadBits,
  isBorderCell,
  layoutBits,
  synchronizationBit,
} from "../lib/optical-layout";
import {
  analyzeDifferentialDifferences,
  decodeDifferentialFrames,
  OPTICAL_TRANSFORMS,
  transformOpticalSamples,
} from "../lib/optical-decoder";
import { combineOpticalEvidence, rankOpticalFrameAnalyses } from "../lib/optical-search";
import { decodeParticleCode, encodeParticleCode } from "../lib/protocol";
import { VISUAL_MODES } from "../lib/visual-modes";

const SECRET = Uint8Array.from({ length: 16 }, (_, index) => index * 11 + 3);

test("visual laboratory exposes exactly fifty documented unique modes", () => {
  assert.equal(VISUAL_MODES.length, 50);
  assert.equal(new Set(VISUAL_MODES.map((mode) => mode.id)).size, 50);
  for (const mode of VISUAL_MODES) {
    assert.ok(mode.algorithm.length > 24, `${mode.id} needs an algorithm explanation`);
    assert.ok(mode.extraction.length > 24, `${mode.id} needs a camera extraction explanation`);
    assert.ok(mode.robustness.length > 24, `${mode.id} needs a robustness explanation`);
    assert.equal(mode.colors.length, 3);
  }
});

test("robust soft evidence rejects a low-quality outlier frame", () => {
  const expected = Array.from({ length: CELL_COUNT }, (_, index) => index % 2 ? 12 : -12);
  const combined = combineOpticalEvidence([
    { differences: expected, quality: 0.92 }, { differences: expected.map((value) => value * 0.9), quality: 0.84 },
    { differences: expected.map((value) => value * 1.1), quality: 0.88 }, { differences: expected.map((value) => value + 1), quality: 0.8 },
    { differences: expected.map((value) => -value * 8), quality: 0.12 },
  ]);
  assert.ok(combined.differences.every((value, index) => Math.sign(value) === Math.sign(expected[index])));
  assert.ok(combined.confidence.every((value) => value > 0.5));
});

test("cyan carrier is separated from vivid galaxy colors", () => {
  const carrier = opticalPixelValue(35, 255, 218);
  const galaxyColors = [
    opticalPixelValue(48, 18, 255),
    opticalPixelValue(157, 8, 255),
    opticalPixelValue(255, 10, 166),
  ];

  assert.ok(galaxyColors.every((value) => carrier > value * 10));
});

test("camera guide maps to the visible part of landscape and portrait streams", () => {
  const landscape = objectFitCoverSourceRectangle(1920, 1080, 450, 300);
  assert.deepEqual(landscape, {
    height: 1080,
    width: 1620,
    x: 150,
    y: 0,
  });
  assert.equal(guideCropCandidates(landscape)[10].side, 1080 * 0.76);

  const portrait = objectFitCoverSourceRectangle(1080, 1920, 450, 300);
  assert.deepEqual(portrait, {
    height: 720,
    width: 1080,
    x: 0,
    y: 600,
  });
  assert.equal(guideCropCandidates(portrait)[10].side, 720 * 0.76);
});

test("particle protocol survives a clean optical layout round trip", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const decoded = decodeParticleCode(extractPayloadBits(cells));

  assert.deepEqual(decoded.secret, SECRET);
  assert.equal(decoded.correctedCodewords, 0);
});

test("differential pixel decoding removes exposure drift and restores the secret", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const reference = cells.map((cell, index) =>
    (cell ? 32 : 104) * (0.72 + (index % 11) * 0.018),
  );
  const current = cells.map((cell, index) =>
    (cell ? 104 : 32) * (0.72 + (index % 11) * 0.018) + 13,
  );

  const { analysis, decoded } = decodeDifferentialFrames(current, reference);
  assert.deepEqual(decoded.secret, SECRET);
  assert.ok(analysis.quality > 0.9);
});

test("chance-level border matches are removed from scanner confidence", () => {
  const differences = Array<number>(CELL_COUNT).fill(0);
  let borderIndex = 0;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!isBorderCell(index)) continue;
    const expectedSign = synchronizationBit(index) ? 1 : -1;
    // 48/68 matching signs produces a raw correlation of about 41%, which is
    // representative of the best false candidate seen in an empty camera view.
    differences[index] = expectedSign * (borderIndex < 48 ? 20 : -20);
    borderIndex += 1;
  }

  const analysis = analyzeDifferentialDifferences(differences);
  assert.ok(analysis.rawSyncCorrelation > 0.3);
  assert.ok(analysis.rawSyncCorrelation < 0.5);
  assert.equal(analysis.quality, 0);
});

test("sync search recovers rotated and mirrored optical frames", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const canonicalDifferences = cells.map((cell) => (cell ? 72 : -72));

  for (const appliedTransform of OPTICAL_TRANSFORMS) {
    const observed = transformOpticalSamples(
      canonicalDifferences,
      appliedTransform,
    );
    const best = OPTICAL_TRANSFORMS.map((candidateTransform) => {
      const canonical = transformOpticalSamples(observed, candidateTransform);
      return analyzeDifferentialDifferences(canonical);
    }).sort((left, right) => right.quality - left.quality)[0];

    const decoded = decodeParticleCode(extractPayloadBits(best.cells));
    assert.deepEqual(decoded.secret, SECRET);
    assert.ok(best.quality > 0.9);
  }
});

test("camera candidate ranking decodes transformed opposite-phase samples", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const reference = cells.map((cell) => (cell ? 28 : 112));
  const current = cells.map((cell) => (cell ? 121 : 37));

  for (const appliedTransform of OPTICAL_TRANSFORMS) {
    const ranked = rankOpticalFrameAnalyses(
      {
        candidates: [
          {
            key: "guided-crop",
            values: transformOpticalSamples(current, appliedTransform),
          },
        ],
        timestamp: 300,
      },
      {
        candidates: [
          {
            key: "guided-crop",
            values: transformOpticalSamples(reference, appliedTransform),
          },
        ],
        timestamp: 0,
      },
    );

    const decoded = decodeParticleCode(
      extractPayloadBits(ranked[0].analysis.cells),
    );
    assert.deepEqual(decoded.secret, SECRET);
    assert.ok(ranked[0].analysis.quality > 0.9);
  }
});

test("Hamming coding corrects one flipped bit in separate codewords", () => {
  const bits = encodeParticleCode(SECRET);
  bits[2] = !bits[2];
  bits[12 + 8] = !bits[12 + 8];
  bits[12 * 13 + 5] = !bits[12 * 13 + 5];

  const decoded = decodeParticleCode(bits);
  assert.deepEqual(decoded.secret, SECRET);
  assert.equal(decoded.correctedCodewords, 3);
});

test("CRC rejects corruption beyond the correction budget", () => {
  const bits = encodeParticleCode(SECRET);
  bits[24] = !bits[24];
  bits[25] = !bits[25];

  assert.throws(() => decodeParticleCode(bits));
});

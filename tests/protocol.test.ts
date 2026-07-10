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
import { derivePairingSas } from "../lib/pairing-sas";
import { buildDiagnosticReport } from "../lib/diagnostic-report";
import { decodeV2Fragment, encodeV2Fragment, v2PairUsesSameFragment, V2FountainDecoder } from "../lib/protocol-v2";
import { perspectiveCandidatesForCrop, projectUnitPoint, samplePerspectiveGrid, samplePerspectiveGridWithHealth, type PerspectiveQuad } from "../lib/perspective-sampling";
import { AdaptiveOpticalSearch, opticalSearchCandidateLabel } from "../lib/adaptive-optical-search";
import { FrameTimingEstimator, selectPhaseReference } from "../lib/frame-timing";
import { ScanLoadController } from "../lib/scan-load";

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

test("v2 fountain fragments recover out of order with loss and duplicates", () => {
  const minute = 30_000_000; const session = 0x8a4c12ef; const decoder = new V2FountainDecoder();
  const sequence = [4, 4, 5, 9, 1]; let result;
  for (const index of sequence) result = decoder.add(decodeV2Fragment(encodeV2Fragment(SECRET, session, minute, index), minute), minute);
  assert.equal(result?.complete, true); assert.deepEqual(result?.secret, SECRET);
});

test("v2 rejects expired fragments and completed-session replay", () => {
  const minute = 30_000_000; const session = 0x10203040; const decoder = new V2FountainDecoder();
  assert.throws(() => decodeV2Fragment(encodeV2Fragment(SECRET, session, minute, 0), minute + 11));
  for (let sequence = 0; sequence < 4; sequence += 1) decoder.add(decodeV2Fragment(encodeV2Fragment(SECRET, session, minute, sequence), minute), minute);
  assert.throws(() => decoder.add(decodeV2Fragment(encodeV2Fragment(SECRET, session, minute, 4), minute), minute));
});

test("v2 bounds concurrent sessions and rejects conflicting equations", () => {
  const minute = 30_000_000; const decoder = new V2FountainDecoder();
  for (let session = 1; session <= 20; session += 1) decoder.add(decodeV2Fragment(encodeV2Fragment(SECRET, session, minute, 0), minute), minute);
  assert.equal(decoder.diagnostics().activeSessions, 8);
  const fragment = decodeV2Fragment(encodeV2Fragment(SECRET, 99, minute, 0), minute);
  decoder.add(fragment, minute); fragment.payload[0] ^= 0xff;
  assert.throws(() => decoder.add(fragment, minute));
});

test("v2 dwell profiles align every usable pair to one fragment", () => {
  for (const dwell of [600, 900, 1200] as const) {
    for (let offset = 300; offset < dwell; offset += 30) assert.equal(v2PairUsesSameFragment(dwell * 3 + offset, dwell), true);
    assert.equal(v2PairUsesSameFragment(dwell * 3, dwell), false);
  }
});

test("short authentication string is deterministic and session-bound", async () => {
  const first = await derivePairingSas(SECRET, 0x12345678); const second = await derivePairingSas(SECRET, 0x12345678); const other = await derivePairingSas(SECRET, 0x12345679);
  assert.deepEqual(first, second); assert.notDeepEqual(first, other); assert.match(first.code, /^[0-9A-F]{6}$/); assert.equal(first.words.length, 3);
});

test("diagnostic report is explicitly redacted", () => {
  const report = buildDiagnosticReport({ createdAt: "2026-01-01T00:00:00.000Z", device: { deviceMemoryGiB: 8, hardwareConcurrency: 8, pixelRatio: 2, viewport: { height: 800, width: 1200 } }, transmitter: { modulationStrength: 0.8, protocolVersion: 2, renderQuality: "ultra", v2DwellMs: 900, visualMode: "galaxy" }, verification: { modeMatrix: "pass" } });
  const serialized = JSON.stringify(report);
  assert.equal(report.privacy.secretIncluded, false); assert.equal(report.privacy.sessionIdIncluded, false); assert.equal(report.privacy.cameraFramesIncluded, false); assert.doesNotMatch(serialized, /[0-9a-f]{32}/i);
});

test("homography sampling recovers an 18 by 18 trapezoid", () => {
  const width = 220; const height = 190; const pixels = new Uint8ClampedArray(width * height * 4); const quad: PerspectiveQuad = { topLeft: { x: 42, y: 18 }, topRight: { x: 178, y: 31 }, bottomRight: { x: 207, y: 171 }, bottomLeft: { x: 13, y: 156 } };
  const expected = Array.from({ length: CELL_COUNT }, (_, index) => (index * 7 + Math.floor(index / 18) * 31) % 256);
  expected.forEach((value, index) => { const point = projectUnitPoint(quad, (index % 18 + 0.5) / 18, (Math.floor(index / 18) + 0.5) / 18); const centerX = Math.round(point.x); const centerY = Math.round(point.y); for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const offset = ((centerY + dy) * width + centerX + dx) * 4; pixels[offset + 1] = value; pixels[offset + 3] = 255; } });
  const sampled = samplePerspectiveGrid(pixels, width, height, quad, 18);
  assert.ok(sampled.every((value, index) => Math.abs(value - expected[index]) < 1));
});

test("perspective samples still pass sync, orientation, and payload decode", () => {
  const width = 220; const height = 190; const quad: PerspectiveQuad = { topLeft: { x: 42, y: 18 }, topRight: { x: 178, y: 31 }, bottomRight: { x: 207, y: 171 }, bottomLeft: { x: 13, y: 156 } }; const cells = layoutBits(encodeParticleCode(SECRET));
  const paint = (values: readonly number[]) => { const pixels = new Uint8ClampedArray(width * height * 4); values.forEach((value, index) => { const point = projectUnitPoint(quad, (index % 18 + 0.5) / 18, (Math.floor(index / 18) + 0.5) / 18); const x = Math.round(point.x); const y = Math.round(point.y); for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const offset = ((y + dy) * width + x + dx) * 4; pixels[offset + 1] = value; pixels[offset + 3] = 255; } }); return pixels; };
  const current = samplePerspectiveGrid(paint(cells.map((cell) => cell ? 121 : 37)), width, height, quad, 18); const reference = samplePerspectiveGrid(paint(cells.map((cell) => cell ? 28 : 112)), width, height, quad, 18);
  const ranked = rankOpticalFrameAnalyses({ candidates: [{ key: "perspective", values: current }], timestamp: 300 }, { candidates: [{ key: "perspective", values: reference }], timestamp: 0 });
  const decoded = decodeParticleCode(extractPayloadBits(ranked[0].analysis.cells)); assert.deepEqual(decoded.secret, SECRET); assert.ok(ranked[0].analysis.quality > 0.9);
});

test("hierarchical perspective search stays inside the mobile candidate budget", () => {
  const crops = guideCropCandidates({ x: 0, y: 0, width: 1280, height: 720 });
  const candidateCount = crops.reduce((sum, crop) => sum + perspectiveCandidatesForCrop(crop.key, 36).length, 0);
  assert.equal(crops.length, 25); assert.equal(candidateCount, 61); assert.ok(candidateCount < 75);
});

test("adaptive geometry tiers preserve deterministic candidate budgets", () => {
  const crops = guideCropCandidates({ x: 0, y: 0, width: 1280, height: 720 });
  for (const [tier, expected] of [["acquire", 61], ["track", 45], ["lock", 25]] as const) {
    const count = crops.reduce((sum, crop) => sum + perspectiveCandidatesForCrop(crop.key, 36, tier).length, 0);
    assert.equal(count, expected); assert.equal(opticalSearchCandidateLabel(tier), expected);
  }
});

test("adaptive search contracts slowly and expands immediately after sync loss", () => {
  const search = new AdaptiveOpticalSearch();
  for (let frame = 0; frame < 5; frame += 1) search.observe({ bestKey: "1:0:0:flat", quality: 0.4, sampleDurationMs: 8 });
  assert.equal(search.tier, "track");
  for (let frame = 0; frame < 10; frame += 1) search.observe({ bestKey: "1:0:0:flat", quality: 0.72, sampleDurationMs: 7 });
  assert.equal(search.tier, "lock");
  search.observe({ bestKey: "1:0:0:flat", quality: 0.31, sampleDurationMs: 7 });
  assert.equal(search.tier, "track");
  search.observe({ quality: 0.12, sampleDurationMs: 7 });
  search.observe({ quality: 0.12, sampleDurationMs: 7 });
  assert.equal(search.tier, "acquire");
});

test("frame timing uses robust cadence and bounded phase tolerance", () => {
  const stable = new FrameTimingEstimator();
  for (let frame = 0; frame < 12; frame += 1) stable.observe(frame * (1000 / 60));
  const stableTiming = stable.snapshot();
  assert.equal(stableTiming.fps, 60); assert.equal(stableTiming.state, "stable"); assert.equal(stableTiming.pairToleranceMs, 72);

  const jittery = new FrameTimingEstimator(); let timestamp = 0; jittery.observe(timestamp);
  for (let frame = 0; frame < 12; frame += 1) { timestamp += frame % 2 ? 60 : 20; jittery.observe(timestamp); }
  const jitterTiming = jittery.snapshot();
  assert.equal(jitterTiming.state, "jittery"); assert.ok(jitterTiming.pairToleranceMs > stableTiming.pairToleranceMs); assert.ok(jitterTiming.pairToleranceMs <= 145);
});

test("adaptive phase reference recovers low-fps opposite frames and rejects distant history", () => {
  const history = [0, 167, 334].map((frameTimestamp) => ({ timestamp: frameTimestamp }));
  assert.equal(selectPhaseReference(history, 500, 300, 131)?.timestamp, 167);
  assert.equal(selectPhaseReference(history, 900, 300, 145), undefined);
});

test("scan load enters cooling with hysteresis, skips alternate frames, and recovers", () => {
  const load = new ScanLoadController();
  for (let frame = 0; frame < 3; frame += 1) assert.equal(load.observe(31, 33.3).state, "normal");
  assert.equal(load.observe(31, 33.3).state, "cooling");
  const decisions = Array.from({ length: 6 }, () => load.shouldProcess());
  assert.deepEqual(decisions, [true, false, true, false, true, false]);
  let snapshot = load.snapshot();
  for (let frame = 0; frame < 30 && snapshot.state === "cooling"; frame += 1) snapshot = load.observe(7, 33.3);
  assert.equal(snapshot.state, "normal"); assert.ok(snapshot.utilization < 0.48);
});

test("isolated scan cost spikes do not trigger thermal backpressure", () => {
  const load = new ScanLoadController();
  load.observe(8, 33.3); load.observe(55, 33.3); load.observe(8, 33.3); load.observe(8, 33.3);
  assert.equal(load.snapshot().state, "normal");
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

test("differential pixel decoding removes multiplicative exposure drift and restores the secret", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const reference = cells.map((cell, index) =>
    (cell ? 32 : 104) * (0.72 + (index % 11) * 0.018),
  );
  const current = cells.map((cell, index) =>
    (cell ? 104 : 32) * (0.72 + (index % 11) * 0.018) * 1.65 + 13,
  );

  const { analysis, decoded } = decodeDifferentialFrames(current, reference);
  assert.deepEqual(decoded.secret, SECRET);
  assert.ok(analysis.quality > 0.9);
  assert.ok(Math.abs(analysis.exposureGain - 1.65) < 0.08);
});

test("cyan opponent projection rejects white-balance contamination without erasing amplitude", () => {
  const dimCarrier = opticalPixelValue(18, 68, 58);
  const brightCarrier = opticalPixelValue(42, 210, 178);
  const blueNebula = opticalPixelValue(70, 26, 240);
  const magentaNebula = opticalPixelValue(230, 22, 190);
  assert.ok(brightCarrier - dimCarrier > 100);
  assert.ok(brightCarrier > blueNebula * 4);
  assert.ok(brightCarrier > magentaNebula * 4);
});

test("capture health separates useful range from clipping, darkness, and flat frames", () => {
  const size = 36; const quad: PerspectiveQuad = { topLeft: { x: 0, y: 0 }, topRight: { x: 35, y: 0 }, bottomRight: { x: 35, y: 35 }, bottomLeft: { x: 0, y: 35 } };
  const solid = (red: number, green: number, blue: number) => { const data = new Uint8ClampedArray(size * size * 4); for (let index = 0; index < size * size; index += 1) { data[index * 4] = red; data[index * 4 + 1] = green; data[index * 4 + 2] = blue; data[index * 4 + 3] = 255; } return data; };
  const healthyPixels = solid(18, 68, 58); for (let row = 0; row < size / 2; row += 1) for (let column = 0; column < size; column += 1) { const offset = (row * size + column) * 4; healthyPixels[offset] = 42; healthyPixels[offset + 1] = 210; healthyPixels[offset + 2] = 178; }
  const healthy = samplePerspectiveGridWithHealth(healthyPixels, size, size, quad, 18).health;
  const clipped = samplePerspectiveGridWithHealth(solid(255, 255, 255), size, size, quad, 18).health;
  const dark = samplePerspectiveGridWithHealth(solid(2, 3, 4), size, size, quad, 18).health;
  const flat = samplePerspectiveGridWithHealth(solid(80, 92, 88), size, size, quad, 18).health;
  assert.equal(healthy.state, "healthy"); assert.ok(healthy.score > 0.9);
  assert.equal(clipped.state, "clipped"); assert.equal(clipped.score, 0);
  assert.equal(dark.state, "dark"); assert.equal(flat.state, "flat");
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
  const current = cells.map((cell) => (cell ? 121 : 37) * 1.7 + 9);

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
    assert.ok(Math.abs(ranked[0].analysis.exposureGain - 1.7) < 0.02);
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

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
  observedQuadrantForTransform,
  OPTICAL_TRANSFORMS,
  transformOpticalSamples,
} from "../lib/optical-decoder";
import { combineOpticalEvidence, rankOpticalFrameAnalyses } from "../lib/optical-search";
import { bytesToHex, decodeParticleCode, encodeParticleCode } from "../lib/protocol";
import { VISUAL_MODES, visualModeVariant } from "../lib/visual-modes";
import { scoreVisualDistinctness, visualAuditPasses, type VisualQualityMetrics } from "../lib/visual-quality";
import { derivePairingSas } from "../lib/pairing-sas";
import { buildDiagnosticReport } from "../lib/diagnostic-report";
import { decodeV2Fragment, encodeV2Fragment, v2PairUsesSameFragment, V2FountainDecoder } from "../lib/protocol-v2";
import { perspectiveCandidatesForCrop, projectUnitPoint, samplePerspectiveGrid, samplePerspectiveGridWithHealth, type PerspectiveQuad } from "../lib/perspective-sampling";
import { AdaptiveOpticalSearch, opticalSearchCandidateLabel } from "../lib/adaptive-optical-search";
import { FrameTimingEstimator, selectPhaseReference } from "../lib/frame-timing";
import { ScanLoadController } from "../lib/scan-load";
import { CandidateConsensus } from "../lib/candidate-consensus";
import { CameraLifecycle, canResumeCameraTrack } from "../lib/camera-lifecycle";
import { cameraConstraintPlan, tuneCameraTrack } from "../lib/camera-tuning";
import { ResolutionGovernor, resolutionConstraints, resolutionProfileFromWidth } from "../lib/resolution-governor";
import { EvidenceDiversityGate } from "../lib/evidence-diversity";
import { analyzePayloadConfidence } from "../lib/payload-confidence";
import { deriveVisualDna } from "../lib/visual-dna";
import { decorativeQualityFor, RenderPerformanceGovernor } from "../lib/render-performance";
import { confidenceAurora } from "../lib/confidence-aurora";
import { pairingSasMatches, verificationCeremony } from "../lib/verification-ceremony";
import { decodeStudioPreset, encodeStudioPreset, studioPresetId, studioPresetUrl, type StudioPreset } from "../lib/studio-preset";
import { rankModeChannelObservations } from "../lib/mode-oracle";
import { opticalPhaseSnapshot, phaseSafeShowcaseDelay } from "../lib/optical-clock";
import { receiverGuidance } from "../lib/receiver-guidance";
import { reliabilitySecretCorpus, summarizeReliability } from "../lib/reliability-marathon";
import { buildReliabilityEvidence, verifyReliabilityEvidence } from "../lib/reliability-evidence";

const SECRET = Uint8Array.from({ length: 16 }, (_, index) => index * 11 + 3);

test("reliability evidence seal is deterministic and detects result tampering", async () => {
  const cells = Array.from({ length: 400 }, (_, index) => ({ passed: true, quality: 0.7 + (index % 7) * 0.01 })); const first = await buildReliabilityEvidence("2026-07-11T00:00:00.000Z", 0.9, cells); const second = await buildReliabilityEvidence("2026-07-11T00:00:00.000Z", 0.9, cells);
  assert.equal(first.seal.digest, second.seal.digest); assert.equal(await verifyReliabilityEvidence(first), true); const tampered = { ...structuredClone(first), results: [...first.results] }; tampered.results[0] = { passed: false, quality: 0 }; assert.equal(await verifyReliabilityEvidence(tampered), false);
});

test("reliability evidence is explicitly redacted and refuses partial runs", async () => {
  const cells = Array.from({ length: 400 }, () => ({ passed: true, quality: 0.9 })); const evidence = await buildReliabilityEvidence("2026-07-11T00:00:00.000Z", 0.9, cells); const serialized = JSON.stringify(evidence);
  assert.deepEqual(evidence.privacy, { cameraFramesIncluded: false, sasIncluded: false, secretIncluded: false, sessionIdIncluded: false }); assert.ok(!serialized.includes("secretHex")); assert.ok(!serialized.includes("00112233445566778899AABBCCDDEEFF")); assert.ok(!serialized.includes("ABCD-EFGH")); assert.equal(evidence.seal.trust, "integrity-only-not-attestation"); await assert.rejects(() => buildReliabilityEvidence("2026-07-11T00:00:00.000Z", 0.9, cells.slice(0, 399)));
});

test("reliability marathon corpus is deterministic and contains unique 128-bit secrets", () => {
  const first = reliabilitySecretCorpus(); const second = reliabilitySecretCorpus(); assert.equal(first.length, 8); assert.deepEqual(first, second); assert.equal(new Set(first.map((secret) => bytesToHex(secret))).size, 8); assert.ok(first.every((secret) => secret.length === 16));
});

test("reliability marathon summary reports exact pass rate and worst quality", () => {
  assert.deepEqual(summarizeReliability([{ passed: true, quality: 0.91 }, { passed: false, quality: 0.38 }, { passed: true, quality: 0.72 }]), { minimumQuality: 0.38, passed: 2, rate: 2 / 3, total: 3 }); assert.deepEqual(summarizeReliability([]), { minimumQuality: 0, passed: 0, rate: 0, total: 0 });
});

test("immersive receiver guidance prioritizes physical occlusion", () => {
  const base = { bottleneck: "sync" as const, metrics: { capture: 0.8, sync: 0.2, geometry: 0.7, evidence: 0.5, payload: 0.6 }, score: 52, state: "aligning" as const };
  assert.deepEqual(receiverGuidance(base, "top-right"), { action: "CLEAR TOP-RIGHT", detail: "Move fingers or reflections away from the highlighted corner." }); assert.equal(receiverGuidance(base, null).action, "CENTER THE SQUARE");
});

test("immersive receiver guidance maps independent bottlenecks to actions", () => {
  const snapshot = (bottleneck: "capture" | "geometry" | "evidence" | "payload") => ({ bottleneck, metrics: { capture: 0.5, sync: 0.5, geometry: 0.5, evidence: 0.5, payload: 0.5 }, score: 50, state: "collecting" as const });
  assert.equal(receiverGuidance(snapshot("capture"), null).action, "IMPROVE EXPOSURE"); assert.equal(receiverGuidance(snapshot("geometry"), null).action, "HOLD PARALLEL"); assert.equal(receiverGuidance(snapshot("evidence"), null).action, "HOLD STILL"); assert.equal(receiverGuidance(snapshot("payload"), null).action, "IMPROVE VISIBILITY");
});

test("optical chronograph follows exact A and B phase boundaries", () => {
  assert.deepEqual(opticalPhaseSnapshot(0), { phase: "A", progress: 0, remainingMs: 300 });
  assert.equal(opticalPhaseSnapshot(299).phase, "A"); assert.equal(opticalPhaseSnapshot(300).phase, "B"); assert.equal(opticalPhaseSnapshot(600).phase, "A");
  const middle = opticalPhaseSnapshot(450); assert.equal(middle.phase, "B"); assert.equal(middle.progress, 0.5); assert.equal(middle.remainingMs, 150);
});

test("showcase scheduling lands only on complete dual-phase boundaries", () => {
  for (const now of [0, 17, 299, 300, 599, 1234.5]) { const delay = phaseSafeShowcaseDelay(now); const target = now + delay; assert.ok(delay >= 4200 && delay <= 4800); assert.ok(Math.abs(target % 600) < 0.0001 || Math.abs(target % 600 - 600) < 0.0001); }
});

test("environment oracle ranks exact CRC recovery before quality and repair count", () => {
  const ranked = rankModeChannelObservations([
    { corrected: 0, mode: "galaxy", passed: false, quality: 0.99 },
    { corrected: 2, mode: "portal", passed: true, quality: 0.82 },
    { corrected: 0, mode: "jellyfish", passed: true, quality: 0.82 },
    { corrected: 0, mode: "anemone", passed: true, quality: 0.76 },
  ]);
  assert.deepEqual(ranked.map((result) => result.mode), ["jellyfish", "portal", "anemone", "galaxy"]); assert.deepEqual(ranked.map((result) => result.rank), [1, 2, 3, 4]);
});

test("environment oracle is stable for exact score ties", () => {
  const ranked = rankModeChannelObservations([{ corrected: 0, mode: "portal", passed: true, quality: 0.8 }, { corrected: 0, mode: "galaxy", passed: true, quality: 0.8 }]);
  assert.deepEqual(ranked.map((result) => result.mode), ["galaxy", "portal"]);
});

test("studio capsule round-trips allowlisted visual configuration", () => {
  const preset: StudioPreset = { dwell: 900, mode: "portal", protocol: 2, quality: "auto", strength: 0.87 };
  const encoded = encodeStudioPreset(preset); assert.deepEqual(decodeStudioPreset(encoded), preset); assert.match(studioPresetId(preset), /^[0-9A-F]{8}$/);
  assert.equal(decodeStudioPreset("pp1~unknown~2~900~87~auto"), null); assert.equal(decodeStudioPreset("pp1~portal~3~900~87~auto"), null); assert.equal(decodeStudioPreset("pp1~portal~2~700~87~auto"), null); assert.equal(decodeStudioPreset("pp1~portal~2~900~4~auto"), null);
});

test("studio capsule URL strips all unrelated and potentially secret material", () => {
  const preset: StudioPreset = { dwell: 600, mode: "galaxy", protocol: 1, quality: "balanced", strength: 0.9 };
  const url = studioPresetUrl("https://pair.example/lab?secret=DEADBEEF&sas=A1B2C3&campaign=x#session-key", preset);
  const parsed = new URL(url); assert.deepEqual([...parsed.searchParams.keys()], ["studio"]); assert.equal(parsed.searchParams.get("studio"), encodeStudioPreset(preset)); assert.equal(parsed.hash, ""); assert.ok(!url.includes("DEADBEEF")); assert.ok(!url.includes("A1B2C3")); assert.ok(!url.includes("session-key"));
});

test("verification ceremony requires matching SAS and an explicit human decision", () => {
  const sas = { code: "A1B2C3", words: ["AURORA", "NOVA", "PRISM"] as const };
  assert.equal(verificationCeremony(false, null, null, "pending").state, "waiting");
  assert.equal(verificationCeremony(true, sas, null, "pending").state, "deriving");
  const compare = verificationCeremony(true, sas, { ...sas }, "pending"); assert.equal(compare.state, "compare"); assert.equal(compare.canAccept, true); assert.deepEqual(compare.stages, [true, true, true, false, false]);
  const accepted = verificationCeremony(true, sas, { ...sas }, "accept"); assert.equal(accepted.state, "accepted"); assert.deepEqual(accepted.stages, [true, true, true, true, true]);
  assert.equal(verificationCeremony(true, sas, { ...sas }, "reject").state, "rejected");
});

test("verification ceremony blocks acceptance when any SAS symbol differs", () => {
  const sender = { code: "A1B2C3", words: ["AURORA", "NOVA", "PRISM"] as const };
  const receiver = { code: "A1B2C4", words: ["AURORA", "NOVA", "PRISM"] as const };
  assert.equal(pairingSasMatches(sender, receiver), false);
  const mismatch = verificationCeremony(true, sender, receiver, "accept"); assert.equal(mismatch.state, "mismatch"); assert.equal(mismatch.canAccept, false);
});

test("confidence aurora exposes the weakest independent scanner layer", () => {
  const snapshot = confidenceAurora({ captureHealth: 0.9, captureState: "healthy", complete: false, consensus: 0.88, consensusState: "stable", evidenceCount: 2, focus: 0.9, payloadCoverage: 0.42, running: true, sync: 81, timingState: "stable" });
  assert.equal(snapshot.bottleneck, "payload"); assert.equal(snapshot.state, "collecting"); assert.ok(snapshot.score > 60);
  const degraded = confidenceAurora({ captureHealth: 0.92, captureState: "healthy", complete: false, consensus: 0.8, consensusState: "ambiguous", evidenceCount: 2, focus: 0.9, payloadCoverage: 0.8, running: true, sync: 80, timingState: "stable" });
  assert.equal(degraded.state, "degraded"); assert.equal(degraded.bottleneck, "geometry");
});

test("confidence aurora distinguishes idle and integrity-complete states", () => {
  const base = { captureHealth: null, captureState: null, consensus: 0, consensusState: "measuring" as const, evidenceCount: 0, focus: null, payloadCoverage: null, sync: 0, timingState: "measuring" as const };
  assert.deepEqual(confidenceAurora({ ...base, complete: false, running: false }), { bottleneck: "none", metrics: { capture: 0, sync: 0, geometry: 0, evidence: 0, payload: 0 }, score: 0, state: "idle" });
  const complete = confidenceAurora({ ...base, complete: true, running: true }); assert.equal(complete.state, "ready"); assert.equal(complete.score, 100); assert.equal(complete.bottleneck, "none");
});

test("render governor degrades quickly and restores slowly without touching carrier quality", () => {
  const governor = new RenderPerformanceGovernor(); let timestamp = 0; governor.sample(timestamp);
  for (let index = 0; index < 24; index += 1) { timestamp += 34; governor.sample(timestamp); }
  assert.equal(governor.profile, "efficient");
  governor.reset("efficient"); governor.sample(timestamp);
  for (let index = 0; index < 119; index += 1) { timestamp += 16; governor.sample(timestamp); }
  assert.equal(governor.profile, "efficient");
  timestamp += 16; governor.sample(timestamp); assert.equal(governor.profile, "balanced");
  governor.reset("balanced"); governor.sample(timestamp);
  for (let index = 0; index < 149; index += 1) { timestamp += 16; governor.sample(timestamp); }
  assert.equal(governor.profile, "balanced");
  timestamp += 16; governor.sample(timestamp); assert.equal(governor.profile, "ultra");
  assert.deepEqual([decorativeQualityFor("efficient"), decorativeQualityFor("balanced"), decorativeQualityFor("ultra")], [0.46, 0.72, 1]);
});

test("render governor ignores background-tab cadence gaps", () => {
  const governor = new RenderPerformanceGovernor(); governor.sample(0);
  for (let index = 1; index <= 10; index += 1) governor.sample(index * 16);
  governor.sample(5000); assert.equal(governor.profile, "balanced");
});

test("visual DNA is deterministic, payload-sensitive, and bounded", () => {
  const frame = layoutBits(encodeParticleCode(SECRET));
  const first = deriveVisualDna(frame); const second = deriveVisualDna(frame);
  assert.deepEqual(first, second);
  const changed = [...frame]; changed[91] = !changed[91];
  assert.notEqual(deriveVisualDna(changed).fingerprint, first.fingerprint);
  assert.match(first.fingerprint, /^[0-9A-F]{8}$/);
  assert.ok(first.symmetry >= 3 && first.symmetry <= 8);
  assert.ok(first.orbitBias >= -1 && first.orbitBias <= 1);
  assert.ok(first.chromaShift >= 0 && first.chromaShift <= 1);
});

test("visual laboratory exposes exactly fifty documented unique modes", () => {
  assert.equal(VISUAL_MODES.length, 50);
  assert.equal(new Set(VISUAL_MODES.map((mode) => mode.id)).size, 50);
  for (const mode of VISUAL_MODES) {
    assert.ok(mode.algorithm.length > 24, `${mode.id} needs an algorithm explanation`);
    assert.ok(mode.extraction.length > 24, `${mode.id} needs a camera extraction explanation`);
    assert.ok(mode.robustness.length > 24, `${mode.id} needs a robustness explanation`);
    assert.equal(mode.colors.length, 3);
  }
  for (const kind of new Set(VISUAL_MODES.map((mode) => mode.kind))) {
    const family = VISUAL_MODES.filter((mode) => mode.kind === kind);
    const variants = family.map((mode) => visualModeVariant(mode.id));
    assert.equal(new Set(variants).size, family.length, `${kind} needs unique structural variants`);
    assert.equal(new Set(family.map((mode) => mode.algorithm)).size, family.length, `${kind} needs unique algorithm descriptions`);
    assert.ok(variants.every((variant) => variant > 0 && variant < 1));
  }
});

test("visual distinctness scores nearest neighbors within each renderer family", () => {
  const metric = (fingerprint: number[]): VisualQualityMetrics => ({ contrast: 80, coverage: 80, distinctness: 0, fingerprint, grade: 80, motion: 80, vibrancy: 80 });
  const duplicate = scoreVisualDistinctness({ galaxy: metric([0, 0, 0]), andromeda: metric([0, 0, 0]) });
  assert.equal(duplicate.galaxy.distinctness, 0); assert.equal(duplicate.andromeda.distinctness, 0);
  const separated = scoreVisualDistinctness({ galaxy: metric([-1, -1, -1]), andromeda: metric([1, 1, 1]) });
  assert.equal(separated.galaxy.distinctness, 100); assert.equal(separated.andromeda.distinctness, 100);
});

test("visual audit gate requires all fifty modes to clear quality and distinctness floors", () => {
  const metric = (grade = 60, distinctness = 40): VisualQualityMetrics => ({ contrast: 80, coverage: 80, distinctness, fingerprint: [0], grade, motion: 80, vibrancy: 80 });
  const passing = Object.fromEntries(VISUAL_MODES.map((mode) => [mode.id, metric()]));
  assert.equal(visualAuditPasses(passing), true);
  assert.equal(visualAuditPasses({ ...passing, galaxy: metric(59, 40) }), false);
  assert.equal(visualAuditPasses({ ...passing, galaxy: metric(60, 39) }), false);
  assert.equal(visualAuditPasses(Object.fromEntries(Object.entries(passing).slice(1))), false);
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

test("candidate consensus permits crop movement while locking orientation", () => {
  const consensus = new CandidateConsensus();
  for (const key of ["crop-left", "crop-center", "crop-right"]) consensus.observe([
    { key, quality: 0.82, transform: "rotate90" },
    { key, quality: 0.8, transform: "mirror" },
  ]);
  const snapshot = consensus.snapshot();
  assert.equal(snapshot.state, "stable"); assert.equal(snapshot.dominantTransform, "rotate90");
  assert.ok(snapshot.geometryStability < 0.5); assert.equal(consensus.canDecode("rotate90"), true); assert.equal(consensus.canDecode("mirror"), false);
});

test("candidate consensus rejects alternating orientation winners and resets on loss", () => {
  const consensus = new CandidateConsensus();
  for (const transform of ["identity", "mirror", "identity", "mirror"]) consensus.observe([
    { key: "crop", quality: 0.8, transform },
    { key: "crop", quality: 0.77, transform: transform === "identity" ? "mirror" : "identity" },
  ]);
  assert.equal(consensus.snapshot().state, "ambiguous"); assert.equal(consensus.canDecode("identity"), false); assert.equal(consensus.canDecode("mirror"), false);
  consensus.observe([{ key: "noise", quality: 0.12, transform: "identity" }]);
  assert.equal(consensus.snapshot().state, "measuring"); assert.equal(consensus.snapshot().confidence, 0);
});

test("camera lifecycle only resumes a suspended live foreground track", () => {
  const lifecycle = new CameraLifecycle();
  assert.equal(lifecycle.transition("resume"), "idle");
  assert.equal(lifecycle.transition("start"), "running");
  assert.equal(lifecycle.transition("suspend"), "suspended");
  assert.equal(lifecycle.transition("resume"), "running");
  assert.equal(lifecycle.transition("end"), "ended");
  assert.equal(lifecycle.transition("resume"), "ended");
  assert.equal(lifecycle.transition("start"), "running");
  assert.equal(lifecycle.transition("stop"), "idle");
});

test("camera resume guard rejects hidden, muted, or ended tracks", () => {
  assert.equal(canResumeCameraTrack("visible", "live", false), true);
  assert.equal(canResumeCameraTrack("hidden", "live", false), false);
  assert.equal(canResumeCameraTrack("visible", "live", true), false);
  assert.equal(canResumeCameraTrack("visible", "ended", false), false);
});

test("camera tuning plans only capabilities that explicitly support continuous mode", () => {
  const plan = cameraConstraintPlan({ focusMode: ["manual", "continuous"], exposureMode: ["single-shot"], whiteBalanceMode: ["continuous"] });
  assert.deepEqual(plan.map((step) => step.feature), ["focus", "white-balance"]);
  assert.deepEqual(cameraConstraintPlan({}), []);
});

test("camera tuning isolates failed enhancements and preserves successful ones", async () => {
  const calls: unknown[] = [];
  const result = await tuneCameraTrack({
    getCapabilities: () => ({ focusMode: ["continuous"], exposureMode: ["continuous"], whiteBalanceMode: ["continuous"] }) as MediaTrackCapabilities,
    applyConstraints: async (constraints) => { calls.push(constraints); if (JSON.stringify(constraints).includes("exposureMode")) throw new Error("unsupported by driver"); },
  });
  assert.equal(calls.length, 3); assert.equal(result.status, "partial");
  assert.deepEqual(result.applied, ["focus", "white-balance"]); assert.deepEqual(result.failed, ["exposure"]);
});

test("camera tuning fails open when capability discovery is absent or throws", async () => {
  let calls = 0;
  const native = await tuneCameraTrack({ applyConstraints: async () => { calls += 1; } });
  const guarded = await tuneCameraTrack({ getCapabilities: () => { throw new Error("driver"); }, applyConstraints: async () => { calls += 1; } });
  assert.equal(native.status, "native"); assert.equal(guarded.status, "native"); assert.equal(calls, 0);
});

test("resolution governor degrades slowly and restores with longer hysteresis", () => {
  const governor = new ResolutionGovernor(); governor.reset("hd");
  const hot = { processingMs: 32, state: "cooling" as const, utilization: 0.8 };
  for (let observation = 0; observation < 5; observation += 1) assert.equal(governor.observe(hot), null);
  assert.equal(governor.observe(hot), "eco"); governor.confirm("eco");
  const cool = { processingMs: 8, state: "normal" as const, utilization: 0.24 };
  for (let observation = 0; observation < 19; observation += 1) assert.equal(governor.observe(cool), null);
  assert.equal(governor.observe(cool), "hd"); governor.disable();
  for (let observation = 0; observation < 30; observation += 1) assert.equal(governor.observe(hot), null);
});

test("resolution targets clamp to camera ranges and reflect actual settings", () => {
  const eco = resolutionConstraints("eco", { width: { min: 800, max: 1920 }, height: { min: 480, max: 1080 } });
  const hd = resolutionConstraints("hd", { width: { min: 320, max: 1000 }, height: { min: 240, max: 600 } });
  assert.deepEqual(eco, { width: { ideal: 800 }, height: { ideal: 480 } });
  assert.deepEqual(hd, { width: { ideal: 1000 }, height: { ideal: 600 } });
  assert.equal(resolutionProfileFromWidth(1280), "hd"); assert.equal(resolutionProfileFromWidth(960), "eco");
});

test("evidence diversity rejects repeated source frames despite new callbacks", () => {
  const gate = new EvidenceDiversityGate();
  assert.deepEqual(gate.observe({ callbackTimeMs: 0, frameIntervalMs: 33, mediaTimeSeconds: 1 }), { accepted: true, reason: "independent" });
  assert.deepEqual(gate.observe({ callbackTimeMs: 20, frameIntervalMs: 33, mediaTimeSeconds: 1 }), { accepted: false, reason: "duplicate-source" });
  assert.deepEqual(gate.observe({ callbackTimeMs: 34, frameIntervalMs: 33, mediaTimeSeconds: 1.034 }), { accepted: true, reason: "independent" });
});

test("evidence diversity falls back to cadence spacing and resets cleanly", () => {
  const gate = new EvidenceDiversityGate();
  assert.equal(gate.observe({ callbackTimeMs: 0, frameIntervalMs: 100, mediaTimeSeconds: 0 }).accepted, true);
  assert.deepEqual(gate.observe({ callbackTimeMs: 54, frameIntervalMs: 100, mediaTimeSeconds: 0 }), { accepted: false, reason: "too-close" });
  assert.equal(gate.observe({ callbackTimeMs: 55, frameIntervalMs: 100, mediaTimeSeconds: 0 }).accepted, true);
  gate.reset(); assert.equal(gate.observe({ callbackTimeMs: 1, frameIntervalMs: 100, mediaTimeSeconds: 0 }).accepted, true);
});

test("payload confidence tolerates sparse weak cells but detects localized occlusion", () => {
  const sparse = Array<number>(CELL_COUNT).fill(1); let payloadIndex = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) if (!isBorderCell(index)) { if (payloadIndex % 11 === 0) sparse[index] = 0.1; payloadIndex += 1; }
  const healthy = analyzePayloadConfidence(sparse);
  assert.equal(healthy.state, "healthy"); assert.equal(healthy.canDecode, true); assert.ok(healthy.coverage > 0.88);

  const blocked = Array<number>(CELL_COUNT).fill(1);
  for (let row = 5; row < 9; row += 1) for (let column = 5; column < 9; column += 1) blocked[row * 18 + column] = 0.05;
  const occluded = analyzePayloadConfidence(blocked);
  assert.equal(occluded.state, "occluded"); assert.equal(occluded.canDecode, false); assert.equal(occluded.maxWeakWindow, 1); assert.equal(occluded.weakestQuadrant, "top-left");
});

test("canonical occlusion quadrants map back through every camera transform", () => {
  const expected = { identity: "top-left", rotate90: "bottom-left", rotate180: "bottom-right", rotate270: "top-right", mirror: "top-right", mirrorRotate90: "bottom-right", mirrorRotate180: "bottom-left", mirrorRotate270: "top-left" } as const;
  for (const transform of OPTICAL_TRANSFORMS) {
    assert.equal(observedQuadrantForTransform("top-left", transform), expected[transform]);
    const mapped = (["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((quadrant) => observedQuadrantForTransform(quadrant, transform));
    assert.equal(new Set(mapped).size, 4);
  }
});

test("payload confidence labels diffuse low coverage separately from occlusion", () => {
  const confidence = Array<number>(CELL_COUNT).fill(1); let payloadIndex = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) if (!isBorderCell(index)) { if (payloadIndex % 3 === 0) confidence[index] = 0.1; payloadIndex += 1; }
  const summary = analyzePayloadConfidence(confidence);
  assert.equal(summary.state, "weak"); assert.equal(summary.canDecode, false); assert.ok(summary.coverage > 0.64 && summary.coverage < 0.68);
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

test("known synchronization border measures focus independently of vivid interior", () => {
  const size = 36; const quad: PerspectiveQuad = { topLeft: { x: 0, y: 0 }, topRight: { x: 35, y: 0 }, bottomRight: { x: 35, y: 35 }, bottomLeft: { x: 0, y: 35 } };
  const paint = (softBorder: boolean) => { const data = new Uint8ClampedArray(size * size * 4); for (let cell = 0; cell < CELL_COUNT; cell += 1) { const row = Math.floor(cell / 18); const column = cell % 18; const bright = isBorderCell(cell) ? synchronizationBit(cell) : (row + column) % 4 < 2; const color = isBorderCell(cell) && softBorder ? bright ? [30, 128, 108] : [28, 112, 96] : bright ? [36, 220, 184] : [18, 65, 54]; for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) { const offset = (((row * 2 + dy) * size) + column * 2 + dx) * 4; data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2]; data[offset + 3] = 255; } } return data; };
  const sharp = samplePerspectiveGridWithHealth(paint(false), size, size, quad, 18).health;
  const soft = samplePerspectiveGridWithHealth(paint(true), size, size, quad, 18).health;
  assert.equal(sharp.focusState, "sharp"); assert.ok(sharp.focusScore > 0.8);
  assert.equal(soft.focusState, "soft"); assert.ok(soft.focusScore < 0.35); assert.equal(soft.state, "healthy");
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

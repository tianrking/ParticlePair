"use client";

/* eslint-disable @next/next/no-img-element -- These are client-generated PNG evidence frames, not network assets. */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { ParticleCloud } from "./ParticleCloud";
import { PhaseChronograph } from "./PhaseChronograph";
import { OpticalScanner } from "./OpticalScanner";
import { extractPayloadBits, isBorderCell, layoutBits } from "../lib/optical-layout";
import {
  bytesToHex,
  createRandomSecret,
  decodeParticleCode,
  encodeParticleCode,
  hexToBytes,
  type DecodedParticleCode,
} from "../lib/protocol";
import {
  CAMERA_CHANNEL_PROFILES,
  runRenderedPixelAssessment,
  runRenderedPixelLoopback,
  runRenderedV2FountainLoopback,
  type CameraChannelProfile,
  type RenderedPixelLoopbackResult,
} from "../lib/rendered-pixel-loopback";
import {
  isLanguage,
  LANGUAGE_OPTIONS,
  UI_COPY,
  type Language,
} from "../lib/i18n";
import { VISUAL_CATEGORIES, VISUAL_MODES, visualMode as getVisualMode, type VisualCategory, type VisualModeId } from "../lib/visual-modes";
import { analyzeVisualModeQuality, scoreVisualDistinctness, visualAuditPasses, type VisualQualityMetrics } from "../lib/visual-quality";
import { encodeV2Fragment, v2MaskForSequence, v2MinuteNow, v2SequenceAtTime } from "../lib/protocol-v2";
import { derivePairingSas, type PairingSas } from "../lib/pairing-sas";
import { buildDiagnosticReport } from "../lib/diagnostic-report";
import { deriveVisualDna } from "../lib/visual-dna";
import type { RenderPerformanceSnapshot, RenderQualitySetting } from "../lib/render-performance";
import { pairingSasMatches, verificationCeremony, type VerificationDecision } from "../lib/verification-ceremony";
import { decodeStudioPreset, studioPresetId, studioPresetUrl, type StudioPreset } from "../lib/studio-preset";
import { rankModeChannelObservations, type RankedModeChannelObservation } from "../lib/mode-oracle";
import { phaseSafeShowcaseDelay } from "../lib/optical-clock";
import { reliabilitySecretCorpus, summarizeReliability, type ReliabilityCell } from "../lib/reliability-marathon";
import { buildReliabilityEvidence, inspectReliabilityEvidence, type ReliabilityEvidence } from "../lib/reliability-evidence";
import { compareReliabilityEvidence } from "../lib/reliability-comparator";
import { rankUniversalChannelAtlas, type AtlasModeRank, type AtlasObservation } from "../lib/universal-channel-atlas";
import { selectSignalArchitecture, SIGNAL_STRENGTH_CANDIDATES, type SignalArchitecture, type SignalArchitectureObservation } from "../lib/adaptive-signal-architect";

const LANGUAGE_STORAGE_KEY = "particlepair-language";
const MODE_STORAGE_KEY = "particlepair-visual-mode";
const RELIABILITY_CORPUS = reliabilitySecretCorpus();

type TestStatus = "idle" | "running" | "success" | "error";
type EvidenceInspectionState = { status: "idle" | "reading" | "verified" | "tampered" | "invalid"; detail: string; evidence?: ReliabilityEvidence; name?: string; digest?: string; passed?: number };
const EMPTY_EVIDENCE_INSPECTION: EvidenceInspectionState = { status: "idle", detail: "Choose a sealed reliability JSON." };
type LoopDetail =
  | { kind: "idle" | "new-secret" | "running" | "error" }
  | { kind: "success"; corrected: number };
type PixelDetail =
  | { kind: "idle" | "new-secret" | "running" | "mismatch" | "error" }
  | { kind: "success"; corrected: number; quality: number };
type Copy = (typeof UI_COPY)[Language];

function randomSecretHex(): string {
  return bytesToHex(createRandomSecret());
}

function randomSessionId(): number {
  const value = new Uint32Array(1); crypto.getRandomValues(value); return value[0];
}

function loopDetailText(detail: LoopDetail, copy: Copy): string {
  switch (detail.kind) {
    case "new-secret":
      return copy.loopNewSecret;
    case "running":
      return copy.loopRunning;
    case "success":
      return copy.loopSuccess(detail.corrected);
    case "error":
      return copy.loopError;
    default:
      return copy.loopIdle;
  }
}

function pixelDetailText(detail: PixelDetail, copy: Copy): string {
  switch (detail.kind) {
    case "new-secret":
      return copy.pixelNewSecret;
    case "running":
      return copy.pixelRunningDetail;
    case "success":
      return copy.pixelSuccessDetail(detail.quality, detail.corrected);
    case "mismatch":
      return copy.pixelMismatch;
    case "error":
      return copy.pixelGenericError;
    default:
      return copy.pixelIdleDetail;
  }
}

export function ParticlePairLab() {
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const immersiveLaunchRef = useRef<HTMLButtonElement>(null);
  const immersiveCloseRef = useRef<HTMLButtonElement>(null);
  const immersiveStageRef = useRef<HTMLElement>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [secretHex, setSecretHex] = useState("");
  const [strength, setStrength] = useState(0.9);
  const [paused, setPaused] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualModeId>("galaxy");
  const [modeQuery, setModeQuery] = useState("");
  const [modeCategory, setModeCategory] = useState<"All" | VisualCategory>("All");
  const [autoShowcase, setAutoShowcase] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [renderQuality, setRenderQuality] = useState<RenderQualitySetting>("auto");
  const [renderPerformance, setRenderPerformance] = useState<RenderPerformanceSnapshot>({ fps: null, profile: "balanced" });
  const [capsuleStatus, setCapsuleStatus] = useState<"idle" | "copied" | "error">("idle");
  const [labTool, setLabTool] = useState<"compatibility" | "camera" | "oracle" | "aesthetics">("compatibility");
  const [matrixStatus, setMatrixStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [matrixProgress, setMatrixProgress] = useState(0);
  const [matrixFailures, setMatrixFailures] = useState<string[]>([]);
  const [marathonStatus, setMarathonStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [marathonProgress, setMarathonProgress] = useState(0);
  const [marathonCells, setMarathonCells] = useState<ReliabilityCell[]>([]);
  const [marathonEvidence, setMarathonEvidence] = useState<ReliabilityEvidence | null>(null);
  const [baselineInspection, setBaselineInspection] = useState<EvidenceInspectionState>(EMPTY_EVIDENCE_INSPECTION);
  const [evidenceInspection, setEvidenceInspection] = useState<EvidenceInspectionState>(EMPTY_EVIDENCE_INSPECTION);
  const [channelStatus, setChannelStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [channelResults, setChannelResults] = useState<Partial<Record<CameraChannelProfile, { ok: boolean; quality: number; corrected: number }>>>({});
  const [oracleProfile, setOracleProfile] = useState<CameraChannelProfile>("low-light");
  const [oracleStatus, setOracleStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [oracleProgress, setOracleProgress] = useState(0);
  const [oracleResults, setOracleResults] = useState<RankedModeChannelObservation[]>([]);
  const [atlasStatus, setAtlasStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [atlasProgress, setAtlasProgress] = useState(0);
  const [atlasObservations, setAtlasObservations] = useState<AtlasObservation[]>([]);
  const [atlasResults, setAtlasResults] = useState<AtlasModeRank[]>([]);
  const [qualityAuditStatus, setQualityAuditStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [qualityAuditProgress, setQualityAuditProgress] = useState(0);
  const [visualGrades, setVisualGrades] = useState<Record<string, VisualQualityMetrics>>({});
  const [calibrationStatus, setCalibrationStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [calibrationFloor, setCalibrationFloor] = useState<number | null>(null);
  const [calibrationCells, setCalibrationCells] = useState<SignalArchitectureObservation[]>([]);
  const [signalArchitecture, setSignalArchitecture] = useState<SignalArchitecture | null>(null);
  const [protocolMode, setProtocolMode] = useState<1 | 2>(1);
  const [v2SessionId, setV2SessionId] = useState(0);
  const [v2IssuedMinute, setV2IssuedMinute] = useState(0);
  const [v2Sequence, setV2Sequence] = useState(0);
  const [v2Dwell, setV2Dwell] = useState<600 | 900 | 1200>(900);
  const [v2Test, setV2Test] = useState<{ status: "idle" | "running" | "success" | "error"; detail: string }>({ status: "idle", detail: "Rendered fountain path not tested" });
  const [result, setResult] = useState<DecodedParticleCode | null>(null);
  const [senderSas, setSenderSas] = useState<(PairingSas & { key: string }) | null>(null);
  const [receiverSas, setReceiverSas] = useState<(PairingSas & { key: string }) | null>(null);
  const [verificationDecision, setVerificationDecision] = useState<VerificationDecision>("pending");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testDetail, setTestDetail] = useState<LoopDetail>({ kind: "idle" });
  const [pixelTestStatus, setPixelTestStatus] = useState<TestStatus>("idle");
  const [pixelTestDetail, setPixelTestDetail] = useState<PixelDetail>({ kind: "idle" });
  const [pixelResult, setPixelResult] = useState<RenderedPixelLoopbackResult | null>(null);
  const copy = UI_COPY[language];
  const senderSasKey = /^[0-9a-f]{32}$/i.test(secretHex) ? `${secretHex.toLowerCase()}:${protocolMode === 2 ? v2SessionId : 0}` : "";
  const receiverSasKey = result ? `${result.secretHex}:${result.protocolVersion === 2 ? result.sessionId ?? 0 : 0}` : "";

  useEffect(() => {
    // Generate the initial secret only after hydration so it never appears in
    // server-rendered HTML and cannot diverge between the server and iOS Safari.
    const initializationFrame = window.requestAnimationFrame(() => {
      setSecretHex(randomSecretHex());
      setV2SessionId(randomSessionId()); setV2IssuedMinute(v2MinuteNow());
      try {
        const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isLanguage(savedLanguage)) {
          setLanguage(savedLanguage);
        }
        const capsule = decodeStudioPreset(new URL(window.location.href).searchParams.get("studio"));
        if (capsule) { setVisualMode(capsule.mode); setProtocolMode(capsule.protocol); setV2Dwell(capsule.dwell); setStrength(capsule.strength); setRenderQuality(capsule.quality); }
        else { const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY); if (savedMode && VISUAL_MODES.some((mode) => mode.id === savedMode)) setVisualMode(savedMode); }
      } catch {
        // Language persistence is optional when storage is blocked.
      }
    });

    return () => window.cancelAnimationFrame(initializationFrame);
  }, []);

  useEffect(() => {
    if (!autoShowcase) return;
    let timeout = 0;
    const advance = () => {
      setVisualMode((current) => {
        const index = VISUAL_MODES.findIndex((mode) => mode.id === current);
        return VISUAL_MODES[(index + 1) % VISUAL_MODES.length].id;
      });
      timeout = window.setTimeout(advance, phaseSafeShowcaseDelay(performance.now()));
    };
    timeout = window.setTimeout(advance, phaseSafeShowcaseDelay(performance.now()));
    return () => window.clearTimeout(timeout);
  }, [autoShowcase]);

  useEffect(() => {
    if (protocolMode !== 2 || paused) return;
    const updateSequence = () => setV2Sequence(v2SequenceAtTime(performance.now(), v2Dwell));
    updateSequence(); const interval = window.setInterval(updateSequence, 60);
    return () => window.clearInterval(interval);
  }, [paused, protocolMode, v2Dwell]);

  useEffect(() => {
    if (protocolMode !== 2) return;
    const rotateSession = window.setInterval(() => {
      if (v2MinuteNow() - v2IssuedMinute >= 8) { setV2SessionId(randomSessionId()); setV2IssuedMinute(v2MinuteNow()); setV2Sequence(0); }
    }, 30_000);
    return () => window.clearInterval(rotateSession);
  }, [protocolMode, v2IssuedMinute]);

  useEffect(() => {
    if (!immersive) return;
    let wakeLock: WakeLockSentinel | null = null;
    let disposed = false;
    const launchButton = immersiveLaunchRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setImmersive(false); return; }
      if (event.key !== "Tab") return;
      const controls = [...(immersiveStageRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.classList.add("is-immersive");
    window.addEventListener("keydown", onKeyDown);
    const focusFrame = window.requestAnimationFrame(() => immersiveCloseRef.current?.focus());
    navigator.wakeLock?.request("screen").then((sentinel) => { if (disposed) void sentinel.release(); else { wakeLock = sentinel; setWakeLockActive(true); sentinel.addEventListener("release", () => setWakeLockActive(false)); } }).catch(() => setWakeLockActive(false));
    return () => { disposed = true; window.cancelAnimationFrame(focusFrame); setWakeLockActive(false); void wakeLock?.release(); document.body.classList.remove("is-immersive"); window.removeEventListener("keydown", onKeyDown); launchButton?.focus(); };
  }, [immersive]);

  useEffect(() => {
    const option = LANGUAGE_OPTIONS.find(({ code }) => code === language);
    document.documentElement.lang = option?.htmlLang ?? "en";
  }, [language]);

  useEffect(() => {
    if (!senderSasKey) return;
    let cancelled = false; derivePairingSas(hexToBytes(secretHex), protocolMode === 2 ? v2SessionId : 0).then((sas) => { if (!cancelled) setSenderSas({ ...sas, key: senderSasKey }); });
    return () => { cancelled = true; };
  }, [protocolMode, secretHex, senderSasKey, v2SessionId]);

  useEffect(() => {
    if (!result || !receiverSasKey) return;
    let cancelled = false; derivePairingSas(result.secret, result.protocolVersion === 2 ? result.sessionId ?? 0 : 0).then((sas) => { if (!cancelled) setReceiverSas({ ...sas, key: receiverSasKey }); });
    return () => { cancelled = true; };
  }, [receiverSasKey, result]);

  const validationFrame = useMemo(() => {
    try {
      return layoutBits(encodeParticleCode(hexToBytes(secretHex)));
    } catch {
      return layoutBits(encodeParticleCode(new Uint8Array(16)));
    }
  }, [secretHex]);

  const frame = useMemo(() => {
    if (protocolMode === 1) return validationFrame;
    try { return layoutBits(encodeV2Fragment(hexToBytes(secretHex), v2SessionId, v2IssuedMinute, v2Sequence)); }
    catch { return validationFrame; }
  }, [protocolMode, secretHex, v2IssuedMinute, v2Sequence, v2SessionId, validationFrame]);
  const visualDna = useMemo(() => deriveVisualDna(frame), [frame]);

  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The UI can still switch languages when storage is unavailable.
    }
  };

  const regenerate = () => {
    setSecretHex(randomSecretHex());
    setV2SessionId(randomSessionId()); setV2IssuedMinute(v2MinuteNow()); setV2Sequence(0);
    setResult(null);
    setVerificationDecision("pending");
    setPixelResult(null);
    setPixelTestStatus("idle");
    setPixelTestDetail({ kind: "new-secret" });
    setTestStatus("idle");
    setTestDetail({ kind: "new-secret" });
  };

  const storeDecodedResult = (decoded: DecodedParticleCode) => { setVerificationDecision("pending"); setResult(decoded); };

  const validSecret = /^[0-9a-f]{32}$/i.test(secretHex);
  const v2Mask = v2MaskForSequence(v2Sequence);
  const v2ActiveBlocks = Array.from({ length: 4 }, (_, block) => (v2Mask & (1 << block)) !== 0);
  const selectedVisualMode = getVisualMode(visualMode);
  const activeSenderSas = senderSas?.key === senderSasKey ? senderSas : null;
  const activeReceiverSas = receiverSas?.key === receiverSasKey ? receiverSas : null;
  const ceremony = verificationCeremony(Boolean(result), activeSenderSas, activeReceiverSas, verificationDecision);
  const oracleDockStatus = oracleStatus === "running" || atlasStatus === "running" ? "running" : oracleStatus === "error" || atlasStatus === "error" ? "error" : oracleStatus === "success" || atlasStatus === "success" ? "success" : "idle";
  const labBusy = matrixStatus === "running" || marathonStatus === "running" || channelStatus === "running" || oracleStatus === "running" || atlasStatus === "running" || qualityAuditStatus === "running";
  const marathonSummary = summarizeReliability(marathonCells);
  const evidenceComparison = useMemo(() => baselineInspection.evidence && evidenceInspection.evidence ? compareReliabilityEvidence(baselineInspection.evidence, evidenceInspection.evidence) : null, [baselineInspection.evidence, evidenceInspection.evidence]);
  const compatibilityStatus = marathonStatus === "running" || matrixStatus === "running" ? "running" : marathonStatus === "error" || matrixStatus === "error" ? "error" : marathonStatus === "success" && matrixStatus === "success" ? "success" : marathonStatus !== "idle" ? marathonStatus : matrixStatus;
  const studioPreset: StudioPreset = { dwell: v2Dwell, mode: visualMode, protocol: protocolMode, quality: renderQuality, strength };
  const capsuleId = studioPresetId(studioPreset);
  const filteredModes = VISUAL_MODES.filter((mode) => {
    const categoryMatches = modeCategory === "All" || mode.category === modeCategory;
    const query = modeQuery.trim().toLowerCase();
    return categoryMatches && (!query || `${mode.name} ${mode.subtitle} ${mode.category}`.toLowerCase().includes(query));
  });

  const selectVisualMode = (mode: VisualModeId) => {
    setVisualMode(mode);
    setAutoShowcase(false);
    try { window.localStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* Persistence is optional. */ }
  };

  const copyStudioCapsule = async () => {
    const url = studioPresetUrl(window.location.href, studioPreset);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else { const textarea = document.createElement("textarea"); textarea.value = url; textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.append(textarea); textarea.select(); if (!document.execCommand("copy")) throw new Error("Copy unavailable"); textarea.remove(); }
      setCapsuleStatus("copied"); window.setTimeout(() => setCapsuleStatus("idle"), 1800);
    } catch { setCapsuleStatus("error"); }
  };

  const stepVisualMode = (direction: -1 | 1) => {
    const current = VISUAL_MODES.findIndex((mode) => mode.id === visualMode);
    selectVisualMode(VISUAL_MODES[(current + direction + VISUAL_MODES.length) % VISUAL_MODES.length].id);
  };

  const runPixelLoopbackTest = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;

    setPixelTestStatus("running");
    setPixelTestDetail({ kind: "running" });
    setPixelResult(null);

    try {
      const decoded = await runRenderedPixelLoopback(canvas, validationFrame, strength, secretHex, visualMode);
      setPixelResult(decoded);
      storeDecodedResult({
        correctedCodewords: decoded.correctedCodewords,
        secret: hexToBytes(decoded.recoveredSecretHex),
        secretHex: decoded.recoveredSecretHex,
      });

      if (!decoded.matchesExpected) {
        setPixelTestStatus("error");
        setPixelTestDetail({ kind: "mismatch" });
        return;
      }

      setPixelTestStatus("success");
      setPixelTestDetail({
        kind: "success",
        corrected: decoded.correctedCodewords,
        quality: Math.round(decoded.quality * 100),
      });
    } catch {
      setPixelTestStatus("error");
      setPixelTestDetail({ kind: "error" });
    }
  };

  const runV2Loopback = async () => {
    const canvas = particleCanvasRef.current; if (!canvas || !validSecret) return;
    setV2Test({ status: "running", detail: "Rendering fountain equations…" });
    try {
      const decoded = await runRenderedV2FountainLoopback(canvas, hexToBytes(secretHex), strength, visualMode, v2SessionId, v2IssuedMinute);
      if (decoded.recoveredSecretHex !== secretHex.toLowerCase()) throw new Error("Recovered secret mismatch");
      setV2Test({ status: "success", detail: `${decoded.fragments} optical fragments · rank ${decoded.ranks.join("→")} · CRC passed` });
    } catch { setV2Test({ status: "error", detail: "Rendered fountain recovery failed" }); }
  };

  const runModeMatrix = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;
    setMatrixStatus("running"); setMatrixProgress(0); setMatrixFailures([]); setAutoShowcase(false);
    const failures: string[] = [];
    for (let index = 0; index < VISUAL_MODES.length; index += 1) {
      const mode = VISUAL_MODES[index];
      try {
        const decoded = await runRenderedPixelAssessment(canvas, validationFrame, strength, secretHex, mode.id);
        if (!decoded.matchesExpected) failures.push(mode.name);
      } catch { failures.push(mode.name); }
      setMatrixProgress(index + 1);
      if (index % 4 === 3) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    setMatrixFailures(failures);
    setMatrixStatus(failures.length ? "error" : "success");
  };

  const runReliabilityMarathon = async () => {
    const canvas = particleCanvasRef.current; if (!canvas) return;
    setMarathonStatus("running"); setMarathonProgress(0); setMarathonCells([]); setMarathonEvidence(null); setAutoShowcase(false);
    const cells: ReliabilityCell[] = [];
    for (let secretIndex = 0; secretIndex < RELIABILITY_CORPUS.length; secretIndex += 1) {
      const corpusSecret = RELIABILITY_CORPUS[secretIndex]; const corpusHex = bytesToHex(corpusSecret); const corpusFrame = layoutBits(encodeParticleCode(corpusSecret));
      for (let modeIndex = 0; modeIndex < VISUAL_MODES.length; modeIndex += 1) {
        try { const decoded = await runRenderedPixelAssessment(canvas, corpusFrame, strength, corpusHex, VISUAL_MODES[modeIndex].id); cells.push({ passed: decoded.matchesExpected, quality: decoded.quality }); }
        catch { cells.push({ passed: false, quality: 0 }); }
        const progress = cells.length; setMarathonProgress(progress); if (progress % 10 === 0) setMarathonCells([...cells]); if (progress % 8 === 0) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }
    const evidence = await buildReliabilityEvidence(new Date().toISOString(), strength, cells); setMarathonCells(cells); setMarathonEvidence(evidence); setMarathonStatus(cells.every((cell) => cell.passed) ? "success" : "error");
  };

  const exportReliabilityEvidence = () => {
    if (!marathonEvidence) return; const url = URL.createObjectURL(new Blob([JSON.stringify(marathonEvidence, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `particlepair-reliability-${marathonEvidence.seal.digest.slice(0, 12)}.json`; anchor.hidden = true; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const pinMarathonEvidence = (slot: "baseline" | "candidate") => {
    if (!marathonEvidence) return;
    const pinned: EvidenceInspectionState = { status: "verified", detail: "Pinned from this browser's completed marathon.", evidence: marathonEvidence, name: `LIVE RUN · ${marathonEvidence.createdAt}`, digest: marathonEvidence.seal.digest.slice(0, 12), passed: marathonEvidence.summary.passed };
    (slot === "baseline" ? setBaselineInspection : setEvidenceInspection)(pinned);
  };

  const inspectEvidenceFile = async (event: ChangeEvent<HTMLInputElement>, slot: "baseline" | "candidate") => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const update = slot === "baseline" ? setBaselineInspection : setEvidenceInspection;
    if (file.size > 256_000) { update({ status: "invalid", detail: "File exceeds the 256 KB local inspection limit.", name: file.name }); return; }
    update({ status: "reading", detail: "Recomputing the canonical SHA-256 seal locally…", name: file.name });
    try {
      const inspection = await inspectReliabilityEvidence(JSON.parse(await file.text()));
      update(inspection.status === "verified"
        ? { status: "verified", detail: inspection.detail, evidence: inspection.evidence, name: file.name, digest: inspection.evidence.seal.digest.slice(0, 12), passed: inspection.evidence.summary.passed }
        : { status: inspection.status, detail: inspection.detail, name: file.name });
    } catch { update({ status: "invalid", detail: "The selected file is not valid JSON.", name: file.name }); }
  };

  const runChannelSuite = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;
    setChannelStatus("running"); setChannelResults({});
    const results: Partial<Record<CameraChannelProfile, { ok: boolean; quality: number; corrected: number }>> = {};
    for (const profile of CAMERA_CHANNEL_PROFILES) {
      try {
        const decoded = await runRenderedPixelAssessment(canvas, validationFrame, strength, secretHex, visualMode, profile);
        results[profile] = { ok: decoded.matchesExpected, quality: Math.round(decoded.quality * 100), corrected: decoded.correctedCodewords };
      } catch { results[profile] = { ok: false, quality: 0, corrected: 0 }; }
      setChannelResults({ ...results });
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    setChannelStatus(Object.values(results).every((result) => result.ok) ? "success" : "error");
  };

  const runModeOracle = async () => {
    const canvas = particleCanvasRef.current; if (!canvas || !validSecret) return;
    setOracleStatus("running"); setOracleProgress(0); setOracleResults([]); setAutoShowcase(false);
    const observations = [];
    for (let index = 0; index < VISUAL_MODES.length; index += 1) {
      const mode = VISUAL_MODES[index];
      try { const decoded = await runRenderedPixelAssessment(canvas, validationFrame, strength, secretHex, mode.id, oracleProfile); observations.push({ corrected: decoded.correctedCodewords, mode: mode.id, passed: decoded.matchesExpected, quality: decoded.quality }); }
      catch { observations.push({ corrected: 99, mode: mode.id, passed: false, quality: 0 }); }
      setOracleProgress(index + 1); if (index % 4 === 3) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    const ranked = rankModeChannelObservations(observations); setOracleResults(ranked); setOracleStatus(ranked.some((result) => result.passed) ? "success" : "error");
  };

  const runUniversalChannelAtlas = async () => {
    const canvas = particleCanvasRef.current; if (!canvas || !validSecret) return;
    setAtlasStatus("running"); setAtlasProgress(0); setAtlasObservations([]); setAtlasResults([]); setAutoShowcase(false);
    const observations: AtlasObservation[] = [];
    for (const profile of CAMERA_CHANNEL_PROFILES) {
      for (const mode of VISUAL_MODES) {
        try { const decoded = await runRenderedPixelAssessment(canvas, validationFrame, strength, secretHex, mode.id, profile); observations.push({ corrected: decoded.correctedCodewords, mode: mode.id, passed: decoded.matchesExpected, profile, quality: decoded.quality }); }
        catch { observations.push({ corrected: 99, mode: mode.id, passed: false, profile, quality: 0 }); }
        const progress = observations.length; setAtlasProgress(progress); if (progress % 25 === 0) setAtlasObservations([...observations]); if (progress % 8 === 0) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }
    const ranked = rankUniversalChannelAtlas(observations); setAtlasObservations(observations); setAtlasResults(ranked); setAtlasStatus(observations.every((cell) => cell.passed) ? "success" : "error");
  };

  const runVisualQualityAudit = async () => {
    setQualityAuditStatus("running"); setQualityAuditProgress(0); setAutoShowcase(false);
    const grades: Record<string, VisualQualityMetrics> = {};
    for (let index = 0; index < VISUAL_MODES.length; index += 1) {
      const mode = VISUAL_MODES[index]; grades[mode.id] = analyzeVisualModeQuality(validationFrame, strength, mode.id);
      setVisualGrades({ ...grades }); setQualityAuditProgress(index + 1);
      if (index % 3 === 2) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    const scored = scoreVisualDistinctness(grades);
    setVisualGrades(scored); setQualityAuditStatus(visualAuditPasses(scored) ? "success" : "error");
  };

  const calibrateModulation = async () => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !validSecret) return;
    setCalibrationStatus("running"); setCalibrationFloor(null); setCalibrationCells([]); setSignalArchitecture(null); setAutoShowcase(false);
    const observations: SignalArchitectureObservation[] = [];
    for (const candidate of SIGNAL_STRENGTH_CANDIDATES) for (const profile of CAMERA_CHANNEL_PROFILES) {
      try { const decoded = await runRenderedPixelAssessment(canvas, validationFrame, candidate, secretHex, visualMode, profile); observations.push({ passed: decoded.matchesExpected, profile, quality: decoded.quality, strength: candidate }); }
      catch { observations.push({ passed: false, profile, quality: 0, strength: candidate }); }
      setCalibrationCells([...observations]); if (observations.length % 6 === 0) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    const architecture = selectSignalArchitecture(observations, CAMERA_CHANNEL_PROFILES);
    if (!architecture) { setCalibrationStatus("error"); return; }
    setSignalArchitecture(architecture); setCalibrationFloor(architecture.floor); setStrength(architecture.operatingStrength); setCalibrationStatus("success");
  };

  const exportDiagnosticReport = () => {
    const graded = Object.values(visualGrades);
    const report = buildDiagnosticReport({
      createdAt: new Date().toISOString(),
      transmitter: { modulationStrength: strength, protocolVersion: protocolMode, renderQuality, v2DwellMs: protocolMode === 2 ? v2Dwell : null, visualMode },
      verification: {
        adaptiveSignal: signalArchitecture ? { cases: calibrationCells.length, floor: signalArchitecture.floor, minimumQuality: signalArchitecture.minimumQuality, operatingStrength: signalArchitecture.operatingStrength, status: calibrationStatus } : { cases: calibrationCells.length, status: calibrationStatus },
        channelAtlas: { cases: atlasObservations.length, passed: atlasObservations.filter((cell) => cell.passed).length, status: atlasStatus, topMode: atlasResults[0]?.mode ?? null },
        cameraChannel: { results: channelResults, status: channelStatus }, canvasPixel: pixelTestStatus, fountainCanvas: v2Test,
        modeMatrix: { failedModes: matrixFailures, progress: matrixProgress, status: matrixStatus }, reliabilityEvidence: marathonEvidence ? { cases: marathonEvidence.summary.total, passed: marathonEvidence.summary.passed, seal: marathonEvidence.seal.digest, trust: marathonEvidence.seal.trust } : null,
        visualAudit: { average: graded.length ? Math.round(graded.reduce((sum, grade) => sum + grade.grade, 0) / graded.length) : null, minimum: graded.length ? Math.min(...graded.map((grade) => grade.grade)) : null, modesMeasured: graded.length, status: qualityAuditStatus },
      },
      device: { deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null, hardwareConcurrency: navigator.hardwareConcurrency, pixelRatio: window.devicePixelRatio, viewport: { height: window.innerHeight, width: window.innerWidth } },
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `particlepair-diagnostic-${Date.now()}.json`; anchor.hidden = true; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const runLoopbackTest = () => {
    setTestStatus("running");
    setTestDetail({ kind: "running" });

    window.setTimeout(() => {
      try {
        const noisyCells = [...validationFrame];
        const payloadIndices = noisyCells
          .map((_, index) => index)
          .filter((index) => !isBorderCell(index));

        // Flip three bits in separate Hamming codewords to exercise correction.
        [13, 91, 181].forEach((payloadOffset) => {
          const cellIndex = payloadIndices[payloadOffset];
          noisyCells[cellIndex] = !noisyCells[cellIndex];
        });

        const decoded = decodeParticleCode(extractPayloadBits(noisyCells));
        storeDecodedResult(decoded);
        setTestStatus("success");
        setTestDetail({ kind: "success", corrected: decoded.correctedCodewords });
      } catch {
        setTestStatus("error");
        setTestDetail({ kind: "error" });
      }
    }, 650);
  };

  const linkStatusTitle =
    testStatus === "success"
      ? copy.linkSuccess
      : testStatus === "error"
        ? copy.linkError
        : testStatus === "running"
          ? copy.linkRunning
          : copy.linkIdle;
  const pixelStatusTitle =
    pixelTestStatus === "success"
      ? copy.pixelSuccess
      : pixelTestStatus === "error"
        ? copy.pixelError
        : pixelTestStatus === "running"
          ? copy.pixelRunning
          : copy.pixelIdle;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.homeLabel}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span>PARTICLEPAIR</span>
        </a>
        <div className="protocol-pill"><span /> Optical OOB · v1</div>
        <div className="topbar-actions">
          <a className="text-link" href="#protocol">{copy.protocolLink} <span>↗</span></a>
          <nav className="language-switcher" aria-label={copy.languageSelector}>
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                className={language === option.code ? "is-active" : ""}
                type="button"
                key={option.code}
                aria-pressed={language === option.code}
                title={option.name}
                onClick={() => selectLanguage(option.code)}
              >
                {option.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.heroLineOne}<br /><em>{copy.heroLineTwo}</em></h1>
          <p className="lede">{copy.heroDescription}</p>
          <div className="hero-metrics">
            <div><strong>128</strong><span>{copy.metricSecret}</span></div>
            <div><strong>300</strong><span>{copy.metricPhase}</span></div>
            <div><strong>CRC</strong><span>CCITT</span></div>
          </div>
        </div>

        <div className="transmitter-card" style={{ "--mode-a": selectedVisualMode.colors[0], "--mode-b": selectedVisualMode.colors[1], "--mode-c": selectedVisualMode.colors[2] } as CSSProperties}>
          <div className="card-heading">
            <div><span className="section-index">01</span><h2>{copy.broadcastTitle}</h2></div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? copy.resumeAnimation : copy.pauseAnimation}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          </div>
          <div className="protocol-mode" aria-label="Optical protocol version">
            <button type="button" aria-pressed={protocolMode === 1} className={protocolMode === 1 ? "is-active" : ""} onClick={() => setProtocolMode(1)}><span>V1</span><strong>STABLE FRAME</strong><small>Single-frame compatibility</small></button>
            <button type="button" aria-pressed={protocolMode === 2} className={protocolMode === 2 ? "is-active" : ""} onClick={() => setProtocolMode(2)}><span>V2</span><strong>FOUNTAIN STREAM</strong><small>Loss-tolerant · anti-replay</small></button>
            <div><span>SESSION</span><code>{v2SessionId.toString(16).padStart(8, "0")}</code><i>{protocolMode === 2 ? `EQ ${v2Sequence + 1}/15` : "READY"}</i></div>
          </div>
          <div className={`v2-proof ${v2Test.status}`} role="status" aria-live="polite" aria-busy={v2Test.status === "running"}><button type="button" disabled={!validSecret || v2Test.status === "running" || paused} onClick={runV2Loopback}>{v2Test.status === "running" ? "TESTING V2…" : "V2 CANVAS PROOF"}</button><div><span>FOUNTAIN RECOVERY</span><strong>{v2Test.detail}</strong></div></div>
          {protocolMode === 2 ? <div className="fountain-visualizer">
            <div className="fountain-heading"><span>LIVE EQUATION MATRIX</span><strong>{v2ActiveBlocks.map((active, index) => active ? `B${index}` : "").filter(Boolean).join(" ⊕ ")} → P</strong><i>TTL {Math.max(0, 10 - (v2MinuteNow() - v2IssuedMinute))} MIN</i></div>
            <div className="source-blocks">{v2ActiveBlocks.map((active, index) => <div key={index} className={active ? "is-active" : ""}><span>B{index}</span><i>{secretHex.slice(index * 8, index * 8 + 8) || "00000000"}</i></div>)}<b>⊕</b><div className="parity-block"><span>P</span><i>MASK {v2Mask.toString(2).padStart(4, "0")}</i></div></div>
            <div className="equation-schedule" aria-label="Fountain equation schedule">{Array.from({ length: 15 }, (_, index) => <span key={index} className={index === v2Sequence ? "is-current" : index < v2Sequence ? "is-past" : ""}>{v2MaskForSequence(index).toString(16).toUpperCase()}</span>)}</div>
            <div className="dwell-selector" aria-label="Fountain fragment timing">{([{ value: 600, label: "FAST", detail: "600 ms" }, { value: 900, label: "BALANCED", detail: "900 ms" }, { value: 1200, label: "ROBUST", detail: "1200 ms" }] as const).map((option) => <button type="button" key={option.value} aria-pressed={v2Dwell === option.value} className={v2Dwell === option.value ? "is-active" : ""} onClick={() => setV2Dwell(option.value)}><strong>{option.label}</strong><small>{option.detail}</small></button>)}</div>
            <p>Four independent equations reconstruct the 128-bit secret. Duplicate masks do not increase rank.</p>
          </div> : null}
          {activeSenderSas ? <div className="sas-signature"><div><span>HUMAN AUTHENTICATION</span><strong>{activeSenderSas.words.join(" · ")}</strong></div><code>{activeSenderSas.code}</code><i>Compare on both devices</i></div> : null}
          <div className="watch-frame">
            <ParticleCloud ariaLabel={copy.particleCanvasLabel} canvasRef={particleCanvasRef} cells={frame} strength={strength} paused={paused || immersive} mode={visualMode} renderQuality={renderQuality} onPerformance={setRenderPerformance} />
            <div className="optical-boundary" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="watch-glass" />
            <PhaseChronograph />
            <span className="broadcast-label"><i /> {copy.liveSignal}</span>
          </div>
          <div className="mode-toolbar">
            <label><span>SEARCH MODES</span><input value={modeQuery} onChange={(event) => setModeQuery(event.target.value)} placeholder="Galaxy, organic, glyph…" /></label>
            <button type="button" className={autoShowcase ? "is-active" : ""} onClick={() => setAutoShowcase((value) => !value)}>{autoShowcase ? "STOP CHOREOGRAPHY" : "PHASE-SAFE SHOWCASE"}</button>
          </div>
          <button ref={immersiveLaunchRef} className="immersive-launch" type="button" onClick={() => setImmersive(true)}><span>◉</span><strong>IMMERSIVE TRANSMIT</strong><small>Distraction-free optical stage</small></button>
          <div className="mode-categories" aria-label="Mode categories">
            {VISUAL_CATEGORIES.map((category) => <button key={category} type="button" className={modeCategory === category ? "is-active" : ""} onClick={() => setModeCategory(category)}>{category}</button>)}
          </div>
          <div className="mode-picker" aria-label="Visual transmission mode">
            {filteredModes.map((mode) => (
              <button key={mode.id} type="button" className={visualMode === mode.id ? "is-active" : ""} style={{ "--tile-a": mode.colors[0], "--tile-b": mode.colors[1], "--tile-c": mode.colors[2] } as CSSProperties} onClick={() => selectVisualMode(mode.id)} aria-pressed={visualMode === mode.id}>
                <span>{mode.icon}</span><strong>{mode.name}</strong><small>{mode.subtitle}</small>
              </button>
            ))}
          </div>
          <div className="mode-intelligence">
            <div className="mode-intelligence-heading"><span>{selectedVisualMode.category}</span><strong>{selectedVisualMode.name}</strong><i>{VISUAL_MODES.findIndex((mode) => mode.id === visualMode) + 1}/50</i></div>
            <div className="mode-palette" aria-label="Mode color palette">{selectedVisualMode.colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}</div>
            <div className="visual-dna" aria-label={`Visual DNA ${visualDna.label} ${visualDna.fingerprint}`}><span>VISUAL DNA</span><strong>{visualDna.label}</strong><code>{visualDna.fingerprint}</code><small>{visualDna.symmetry}-fold topology · payload-derived · not authentication</small></div>
            <dl><div><dt>GENERATIVE ALGORITHM</dt><dd>{selectedVisualMode.algorithm}</dd></div><div><dt>CAMERA EXTRACTION</dt><dd>{selectedVisualMode.extraction}</dd></div><div><dt>ROBUSTNESS</dt><dd>{selectedVisualMode.robustness}</dd></div></dl>
          </div>
          <div className="strength-row">
            <label htmlFor="strength">{copy.modulationStrength}</label>
            <input
              id="strength"
              type="range"
              min="0.25"
              max="1"
              step="0.01"
              value={strength}
              onChange={(event) => setStrength(Number(event.target.value))}
            />
            <output>{Math.round(strength * 100)}%</output>
          </div>
          <div className={`adaptive-calibration signal-architect ${calibrationStatus}`} role="status" aria-live="polite" aria-busy={calibrationStatus === "running"}><button type="button" onClick={calibrateModulation} disabled={!validSecret || calibrationStatus === "running" || paused}>{calibrationStatus === "running" ? `ARCHITECTING ${calibrationCells.length}/42…` : "ARCHITECT SIGNAL"}</button><div><span>ADAPTIVE SIGNAL ARCHITECT</span><strong>{calibrationStatus === "success" && calibrationFloor !== null ? `FLOOR ${Math.round(calibrationFloor * 100)}% · OPERATING ${Math.round(strength * 100)}%` : calibrationStatus === "error" ? "NO UNIVERSAL SAFE MARGIN" : "Find the quietest signal that survives all six channels"}</strong></div>{calibrationCells.length ? <div className="signal-spectrum" aria-label={`${calibrationCells.filter((cell) => cell.passed).length} of ${calibrationCells.length} signal calibration cases passed`}>{SIGNAL_STRENGTH_CANDIDATES.map((candidate, row) => <div key={candidate}><b>{Math.round(candidate * 100)}%</b>{CAMERA_CHANNEL_PROFILES.map((profile, column) => { const cell = calibrationCells[row * 6 + column]; return <i key={profile} className={cell ? cell.passed && cell.quality >= 0.47 ? "pass" : "fail" : undefined} title={`${Math.round(candidate * 100)}% · ${profile}${cell ? ` · ${Math.round(cell.quality * 100)}% · ${cell.passed ? "CRC PASS" : "REJECTED"}` : " · pending"}`} />; })}</div>)}</div> : null}{signalArchitecture ? <small>6/6 CHANNELS · {Math.round(signalArchitecture.minimumQuality * 100)}% WORST QUALITY · +{Math.round(signalArchitecture.margin * 100)}% SAFETY</small> : null}</div>
          <div className="render-budget" aria-label="Decorative render quality"><div><span>ADAPTIVE MOTION ENGINE</span><strong>{renderPerformance.fps ?? "—"} FPS · {renderPerformance.profile.toUpperCase()} · carrier always full resolution</strong></div>{(["auto", "efficient", "balanced", "ultra"] as const).map((profile) => <button type="button" key={profile} aria-pressed={renderQuality === profile} className={renderQuality === profile ? "is-active" : ""} onClick={() => setRenderQuality(profile)}>{profile}</button>)}</div>
          <div className={`studio-capsule ${capsuleStatus}`}><div><span>STUDIO CAPSULE</span><strong>{selectedVisualMode.name} · V{protocolMode} · {Math.round(strength * 100)}%</strong><code>{capsuleId}</code><small>Visual configuration only · zero secret material</small></div><button type="button" onClick={copyStudioCapsule}>{capsuleStatus === "copied" ? "COPIED ✓" : capsuleStatus === "error" ? "COPY FAILED" : "COPY STUDIO LINK"}</button></div>
        </div>
      </section>

      <section className="workspace">
        <article className="panel sender-panel">
          <div className="panel-title"><span className="section-index">02</span><div><h2>{copy.sendTitle}</h2><p>{copy.sendDescription}</p></div></div>
          <label className="field-label" htmlFor="secret">{copy.pairingSecret}</label>
          <div className={`secret-field ${validSecret ? "" : "has-error"}`}>
            <input
              id="secret"
              spellCheck={false}
              value={secretHex}
              maxLength={32}
              onChange={(event) => setSecretHex(event.target.value.replaceAll(/[^0-9a-f]/gi, "").toLowerCase())}
            />
            <span>{secretHex.length}/32</span>
          </div>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={regenerate}>{copy.generateSecret}</button>
            <button className="secondary-button" type="button" disabled={!validSecret} onClick={runLoopbackTest}>{copy.loopbackTest}</button>
          </div>
          <div className={`test-result ${testStatus}`} role="status" aria-live="polite" aria-busy={testStatus === "running"}>
            <span className="status-orb" />
            <div><strong>{linkStatusTitle}</strong><p>{loopDetailText(testDetail, copy)}</p></div>
          </div>
          <button
            className="secondary-button full-width pixel-test-button"
            type="button"
            disabled={!validSecret || pixelTestStatus === "running" || paused}
            onClick={runPixelLoopbackTest}
          >
            {pixelTestStatus === "running" ? copy.pixelButtonRunning : copy.pixelButton}
          </button>
          <div className={`pixel-test-result ${pixelTestStatus}`} role="status" aria-live="polite" aria-busy={pixelTestStatus === "running"}>
            <div className="pixel-test-heading">
              <span className="status-orb" />
              <div><strong>{pixelStatusTitle}</strong><p>{pixelDetailText(pixelTestDetail, copy)}</p></div>
            </div>
            {pixelResult ? (
              <div className="pixel-evidence">
                <figure><img src={pixelResult.referenceImage} alt={copy.phaseAAlt} /><figcaption>PHASE A · PNG</figcaption></figure>
                <figure><img src={pixelResult.currentImage} alt={copy.phaseBAlt} /><figcaption>PHASE B · PNG</figcaption></figure>
                <figure><img src={pixelResult.differenceImage} alt={copy.differenceAlt} /><figcaption>18×18 DIFF</figcaption></figure>
                <div className="pixel-key-compare">
                  <span>{copy.recoveredKey}</span>
                  <code>{pixelResult.recoveredSecretHex.match(/.{1,8}/g)?.join(" ")}</code>
                  <strong>{pixelResult.matchesExpected ? copy.keyMatches : copy.keyMismatch}</strong>
                </div>
              </div>
            ) : null}
          </div>
          <nav className="lab-dock" aria-label="Optical laboratory tools">{([['compatibility', 'COMPAT', compatibilityStatus], ['camera', 'CAMERA', channelStatus], ['oracle', 'ORACLE', oracleDockStatus], ['aesthetics', 'AESTHETICS', qualityAuditStatus]] as const).map(([tool, label, status]) => <button type="button" key={tool} disabled={labBusy} aria-pressed={labTool === tool} className={labTool === tool ? "is-active" : ""} onClick={() => setLabTool(tool)}><i className={status} /><span>{label}</span></button>)}</nav>
          <section className="lab-module" hidden={labTool !== "compatibility"} aria-label="Compatibility matrix laboratory">
          <button className="secondary-button full-width matrix-button" type="button" disabled={!validSecret || matrixStatus === "running" || paused} onClick={runModeMatrix}>
            {matrixStatus === "running" ? `VALIDATING ${matrixProgress}/50` : "VALIDATE ALL 50 VISUAL MODES"}
          </button>
          <div className={`matrix-result ${matrixStatus}`} role="status" aria-live="polite" aria-busy={matrixStatus === "running"}><span /><p>{matrixStatus === "success" ? "50/50 modes recovered the exact secret and passed CRC." : matrixStatus === "error" ? `${matrixFailures.length} modes need calibration: ${matrixFailures.join(", ")}` : "Full optical compatibility matrix has not run yet."}</p></div>
          <div className={`reliability-marathon ${marathonStatus}`} role="status" aria-live="polite" aria-busy={marathonStatus === "running"}><div className="marathon-heading"><span>RELIABILITY MARATHON</span><strong>{marathonStatus === "running" ? `${marathonProgress}/400` : marathonCells.length ? `${marathonSummary.passed}/${marathonSummary.total} · ${Math.round(marathonSummary.minimumQuality * 100)}% FLOOR` : "8 SECRETS × 50 MODES"}</strong></div><button type="button" disabled={marathonStatus === "running" || paused} onClick={runReliabilityMarathon}>{marathonStatus === "running" ? "RUNNING DETERMINISTIC CORPUS…" : "RUN 400-CASE MARATHON"}</button>{marathonCells.length ? <div className="marathon-map" aria-label={`${marathonSummary.passed} of ${marathonSummary.total} marathon cases passed`}>{RELIABILITY_CORPUS.map((_, row) => <div key={row}><b>S{row + 1}</b>{VISUAL_MODES.map((mode, column) => { const cell = marathonCells[row * 50 + column]; return <i key={mode.id} className={cell ? cell.passed ? "pass" : "fail" : undefined} title={`${mode.name} · secret ${row + 1}${cell ? ` · ${Math.round(cell.quality * 100)}% · ${cell.passed ? "PASS" : "FAIL"}` : " · pending"}`} />; })}</div>)}</div> : <p>Fixed corpus · real pixels · exact secret · Hamming · CRC</p>}{marathonEvidence ? <div className="evidence-seal"><span>SHA-256 EVIDENCE SEAL</span><code>{marathonEvidence.seal.digest.slice(0, 12)}</code><small>Integrity only · not a signature or remote attestation</small><div className="seal-actions"><button type="button" onClick={() => pinMarathonEvidence("baseline")}>PIN A</button><button type="button" onClick={() => pinMarathonEvidence("candidate")}>PIN B</button><button type="button" onClick={exportReliabilityEvidence}>EXPORT JSON</button></div></div> : null}</div>
          <div className={`evidence-inspector comparator ${evidenceComparison?.verdict ?? "idle"}`} role="status" aria-live="polite">
            <div className="evidence-orb" aria-hidden="true"><i /><i /><i /></div><div className="comparator-heading"><span>RELIABILITY CONSTELLATION</span><strong>{evidenceComparison ? `${evidenceComparison.verdict.toUpperCase()} · ${evidenceComparison.averageQualityDelta >= 0 ? "+" : ""}${Math.round(evidenceComparison.averageQualityDelta * 100)}%` : "LOCAL A/B EVIDENCE"}</strong><p>Verify two sealed 400-case records, then reveal every meaningful quality drift.</p></div>
            <div className="evidence-slots">{([['baseline', 'A · BASELINE', baselineInspection], ['candidate', 'B · CANDIDATE', evidenceInspection]] as const).map(([slot, label, inspection]) => <label className={inspection.status} key={slot}><input type="file" accept="application/json,.json" disabled={inspection.status === "reading"} onChange={(event) => inspectEvidenceFile(event, slot)} /><span>{label}</span><b>{inspection.status === "verified" ? `${inspection.passed}/400 · ${inspection.digest}` : inspection.status === "reading" ? "INSPECTING…" : inspection.status === "tampered" ? "TAMPERED" : inspection.status === "invalid" ? "INVALID JSON" : "CHOOSE JSON"}</b><small>{inspection.name ?? inspection.detail}</small></label>)}</div>
            {evidenceComparison ? <div className="comparison-result"><div className="comparison-stats"><span><b>{evidenceComparison.improved}</b>IMPROVED</span><span><b>{evidenceComparison.stable}</b>STABLE</span><span><b>{evidenceComparison.regressed}</b>REGRESSED</span></div><div className="comparison-map" aria-label={`${evidenceComparison.improved} improved, ${evidenceComparison.regressed} regressed, ${evidenceComparison.stable} stable cases`}>{evidenceComparison.cells.map((cell, index) => <i className={cell.state} key={index} title={`Case ${index + 1} · ${cell.delta >= 0 ? "+" : ""}${Math.round(cell.delta * 100)}%`} />)}</div>{evidenceComparison.regressed ? <ol>{evidenceComparison.modes.filter((mode) => mode.regressed).slice(0, 3).map((mode) => <li key={mode.index}><span>{VISUAL_MODES[mode.index].name}</span><b>{mode.regressed}/8 REGRESSED · {Math.round(mode.averageDelta * 100)}% AVG</b></li>)}</ol> : <p className="comparison-clear">No meaningful regression across the shared corpus.</p>}</div> : null}
          </div>
          </section>
          <section className="lab-module" hidden={labTool !== "camera"} aria-label="Camera channel laboratory">
          <button className="secondary-button full-width channel-button" type="button" disabled={!validSecret || channelStatus === "running" || paused} onClick={runChannelSuite}>{channelStatus === "running" ? "SIMULATING CAMERA CHANNEL…" : "RUN CAMERA STRESS SUITE"}</button>
          <div className={`channel-suite ${channelStatus}`} role="status" aria-live="polite" aria-busy={channelStatus === "running"}>
            <div className="channel-suite-heading"><span>CAMERA CHANNEL LAB</span><strong>{selectedVisualMode.name}</strong><i>{channelStatus === "success" ? "6/6 PASS" : channelStatus === "error" ? `${Object.values(channelResults).filter((result) => result.ok).length}/6 PASS` : "NOT RUN"}</i></div>
            <div className="channel-profiles">{CAMERA_CHANNEL_PROFILES.map((profile) => { const result = channelResults[profile]; return <div key={profile} className={result ? result.ok ? "pass" : "fail" : ""}><span>{profile.replaceAll("-", " ")}</span><strong>{result ? `${result.quality}%` : "—"}</strong><small>{result ? result.ok ? `CRC · ${result.corrected} FIX` : "REJECTED" : "WAITING"}</small></div>; })}</div>
          </div>
          </section>
          <section className="lab-module" hidden={labTool !== "oracle"} aria-label="Environmental mode oracle laboratory">
          <section className={`mode-oracle ${oracleStatus}`} aria-label="Environmental visual mode oracle" aria-busy={oracleStatus === "running"}>
            <div className="mode-oracle-heading"><span>ENVIRONMENTAL MODE ORACLE</span><strong>{oracleStatus === "running" ? `${oracleProgress}/50` : oracleResults.length ? `${oracleResults.filter((result) => result.passed).length}/50 CRC PASS` : "REAL PIXEL RANKING"}</strong></div>
            <div className="oracle-profiles">{CAMERA_CHANNEL_PROFILES.filter((profile) => profile !== "clean").map((profile) => <button type="button" key={profile} disabled={oracleStatus === "running"} aria-pressed={oracleProfile === profile} className={oracleProfile === profile ? "is-active" : ""} onClick={() => { setOracleProfile(profile); setOracleStatus("idle"); setOracleResults([]); }}>{profile.replaceAll("-", " ")}</button>)}</div>
            <button className="oracle-run" type="button" disabled={!validSecret || oracleStatus === "running" || paused} onClick={runModeOracle}>{oracleStatus === "running" ? `TESTING ${oracleProgress}/50 MODES…` : "FIND THE STRONGEST VISUAL"}</button>
            {oracleResults.length ? <ol>{oracleResults.slice(0, 3).map((result) => { const mode = getVisualMode(result.mode); return <li key={result.mode}><span>#{result.rank}</span><div><strong>{mode.name}</strong><small>{Math.round(result.quality * 100)}% sync · {result.corrected} repair · {result.passed ? "CRC pass" : "rejected"}</small></div><button type="button" onClick={() => selectVisualMode(result.mode)}>APPLY</button></li>; })}</ol> : <p>Runs all 50 renderers through the selected synthetic camera channel. Rankings require exact secret recovery and CRC.</p>}
          </section>
          <section className={`channel-atlas ${atlasStatus}`} aria-label="Universal camera channel atlas" aria-busy={atlasStatus === "running"}>
            <div className="atlas-heading"><span>UNIVERSAL CHANNEL ATLAS</span><strong>{atlasStatus === "running" ? `${atlasProgress}/300` : atlasResults.length ? `${atlasObservations.filter((cell) => cell.passed).length}/300 CRC` : "6 CHANNELS × 50 MODES"}</strong></div>
            <button type="button" disabled={!validSecret || atlasStatus === "running" || oracleStatus === "running" || paused} onClick={runUniversalChannelAtlas}>{atlasStatus === "running" ? `MAPPING ${atlasProgress}/300 PIXEL PATHS…` : "MAP THE UNIVERSAL ROBUSTNESS FIELD"}</button>
            {atlasObservations.length ? <div className="atlas-map" aria-label={`${atlasObservations.filter((cell) => cell.passed).length} of ${atlasObservations.length} channel atlas cases passed`}>{CAMERA_CHANNEL_PROFILES.map((profile, row) => <div key={profile}><b>{profile.replace("white-balance", "WB").replace("motion-blur", "MOTION").toUpperCase()}</b>{VISUAL_MODES.map((mode, column) => { const cell = atlasObservations[row * 50 + column]; return <i key={mode.id} className={cell ? cell.passed ? "pass" : "fail" : undefined} title={`${mode.name} · ${profile}${cell ? ` · ${Math.round(cell.quality * 100)}% · ${cell.passed ? "CRC PASS" : "REJECTED"}` : " · pending"}`} />; })}</div>)}</div> : <p>Minimax ranking protects the weakest camera condition, not the prettiest average.</p>}
            {atlasResults.length ? <ol>{atlasResults.slice(0, 3).map((result) => <li key={result.mode}><span>#{result.rank}</span><div><strong>{getVisualMode(result.mode).name}</strong><small>{result.passed}/6 CRC · {Math.round(result.worstQuality * 100)}% FLOOR · {Math.round(result.averageQuality * 100)}% AVG</small></div><button type="button" onClick={() => selectVisualMode(result.mode)}>APPLY</button></li>)}</ol> : null}
          </section>
          </section>
          <section className="lab-module" hidden={labTool !== "aesthetics"} aria-label="Visual aesthetics laboratory">
          <button className="secondary-button full-width visual-audit-button" type="button" disabled={!validSecret || qualityAuditStatus === "running" || paused} onClick={runVisualQualityAudit}>{qualityAuditStatus === "running" ? `ANALYZING VISUALS ${qualityAuditProgress}/50` : "AUDIT ALL 50 VISUALS"}</button>
          <div className={`visual-audit ${qualityAuditStatus}`} role="status" aria-live="polite" aria-busy={qualityAuditStatus === "running"}>
            <div className="visual-audit-heading"><span>VISUAL QUALITY ENGINE</span><strong>{qualityAuditStatus === "success" || qualityAuditStatus === "error" ? `${Math.min(...Object.values(visualGrades).map((grade) => grade.grade))} MIN · ${Math.round(Object.values(visualGrades).reduce((sum, grade) => sum + grade.grade, 0) / 50)} AVG · ${Math.min(...Object.values(visualGrades).map((grade) => grade.distinctness))} D` : "PIXEL METRICS PENDING"}</strong></div>
            <div className="visual-grade-map">{VISUAL_MODES.map((mode) => { const grade = visualGrades[mode.id]; const tier = grade ? grade.grade >= 70 && grade.distinctness >= 60 ? "excellent" : grade.grade >= 60 && grade.distinctness >= 40 ? "good" : "review" : ""; return <button type="button" key={mode.id} title={`${mode.name}${grade ? ` · Q${grade.grade} · D${grade.distinctness}` : ""}`} className={tier} onClick={() => selectVisualMode(mode.id)} aria-label={`${mode.name} visual grade ${grade?.grade ?? "pending"}${grade ? ` distinctness ${grade.distinctness}` : ""}`}>{grade?.grade ?? "·"}</button>; })}</div>
            {visualGrades[visualMode] ? <dl className="current-visual-metrics"><div><dt>VIBRANCY</dt><dd>{visualGrades[visualMode].vibrancy}</dd></div><div><dt>CONTRAST</dt><dd>{visualGrades[visualMode].contrast}</dd></div><div><dt>COLOR RANGE</dt><dd>{visualGrades[visualMode].coverage}</dd></div><div><dt>MOTION</dt><dd>{visualGrades[visualMode].motion}</dd></div><div><dt>DISTINCT</dt><dd>{visualGrades[visualMode].distinctness}</dd></div><div><dt>GRADE</dt><dd>{visualGrades[visualMode].grade}</dd></div></dl> : null}
          </div>
          </section>
          <button className="diagnostic-export" type="button" onClick={exportDiagnosticReport}><span>↓</span><div><strong>EXPORT LOCAL DIAGNOSTIC</strong><small>Redacted JSON · no secret · no camera frames</small></div></button>
        </article>

        <article className="panel receiver-panel">
          <div className="panel-title"><span className="section-index">03</span><div><h2>{copy.receiveTitle}</h2><p>{copy.receiveDescription}</p></div></div>
          <OpticalScanner language={language} onDecoded={storeDecodedResult} />
        </article>

        <article className="panel decoded-panel">
          <div className="panel-title"><span className="section-index">04</span><div><h2>{copy.decodedTitle}</h2><p>{copy.decodedDescription}</p></div></div>
          {result ? (
            <div className="decoded-success">
              <span className="success-ring">✓</span>
              <p>{copy.validFrame}</p>
              <code>{result.secretHex.match(/.{1,8}/g)?.join(" ")}</code>
              {activeReceiverSas ? <div className="receiver-sas"><span>COMPARE ON SENDER</span><strong>{activeReceiverSas.words.join(" · ")}</strong><code>{activeReceiverSas.code}</code></div> : null}
              <dl><div><dt>{copy.correctedCodewords}</dt><dd>{result.correctedCodewords}</dd></div><div><dt>{copy.integrity}</dt><dd>CRC-16 ✓</dd></div></dl>
              <section className={`verification-ceremony state-${ceremony.state}`} aria-label={`Verification ceremony ${ceremony.state}`}>
                <div className="ceremony-heading"><span>VERIFICATION CONSTELLATION</span><strong>{ceremony.state === "accepted" ? "PAIR ACCEPTED" : ceremony.state === "rejected" ? "PAIR REJECTED" : ceremony.state === "mismatch" ? "SAS MISMATCH" : ceremony.state === "deriving" ? "DERIVING SAS" : "HUMAN CHECK REQUIRED"}</strong></div>
                <ol>{["OPTICAL", "CRC", "SAS", "COMPARE", "ACCEPT"].map((stage, index) => <li key={stage} className={ceremony.stages[index] ? "is-complete" : index === ceremony.stages.findIndex((complete) => !complete) ? "is-current" : undefined}><i /><span>{stage}</span></li>)}</ol>
                <p>{ceremony.state === "accepted" ? "Human comparison recorded locally. Continue with an authenticated key exchange." : ceremony.state === "rejected" || ceremony.state === "mismatch" ? "Do not pair. Restart with the intended device and compare both displays again." : "Compare all three words and the six-digit fingerprint on both physical devices."}</p>
                <div className="ceremony-actions"><button type="button" disabled={!ceremony.canAccept || verificationDecision !== "pending"} onClick={() => setVerificationDecision("accept")}>WORDS MATCH</button><button type="button" disabled={verificationDecision !== "pending"} onClick={() => setVerificationDecision("reject")}>REJECT</button></div>
                <small>{pairingSasMatches(activeSenderSas, activeReceiverSas) ? "SAS values agree locally · human comparison is still mandatory" : "Waiting for independently derived SAS values"}</small>
              </section>
            </div>
          ) : (
            <div className="empty-result"><span /><p>{copy.emptyResult}</p><small>{copy.emptyResultDetail}</small></div>
          )}
        </article>
      </section>

      <section className="protocol-section" id="protocol">
        <div><p className="eyebrow">{copy.pipelineEyebrow}</p><h2>{copy.pipelineTitle}</h2></div>
        <ol>
          {copy.protocolSteps.map((step, index) => (
            <li key={step.title}><span>{index + 1}</span><strong>{step.title}</strong><p>{step.description}</p></li>
          ))}
        </ol>
        <p className="security-note">{copy.securityNote}</p>
      </section>

      <footer><span>PARTICLEPAIR / {copy.footerTagline}</span><span>ORBITACERO · PARTICLEPAIR · 2026</span></footer>
      {immersive ? (
        <section ref={immersiveStageRef} className="immersive-stage" style={{ "--mode-a": selectedVisualMode.colors[0], "--mode-b": selectedVisualMode.colors[1], "--mode-c": selectedVisualMode.colors[2] } as CSSProperties} role="dialog" aria-modal="true" aria-label={`${selectedVisualMode.name} immersive optical transmitter`}>
          <ParticleCloud ariaLabel={`${selectedVisualMode.name} optical transmission`} cells={frame} strength={strength} mode={visualMode} renderQuality={renderQuality} onPerformance={setRenderPerformance} />
          <div className="immersive-glass" aria-hidden="true" />
          <header><div className="immersive-brand"><span /><div><strong>PARTICLEPAIR</strong><small>LIVE OPTICAL LINK · {wakeLockActive ? "SCREEN AWAKE" : "WAKE LOCK OPTIONAL"}</small></div></div><button ref={immersiveCloseRef} type="button" onClick={() => setImmersive(false)} aria-label="Exit immersive transmitter">ESC <i>×</i></button></header>
          <div className="immersive-meta"><span>{selectedVisualMode.category} · {visualDna.label} · {visualDna.fingerprint}</span><h2>{selectedVisualMode.name}</h2><p>{selectedVisualMode.subtitle}</p><div className="immersive-palette">{selectedVisualMode.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</div></div>
          <div className="immersive-controls"><button type="button" onClick={() => stepVisualMode(-1)} aria-label="Previous visual mode">←</button><PhaseChronograph compact /><button type="button" onClick={() => stepVisualMode(1)} aria-label="Next visual mode">→</button></div>
          <div className="immersive-boundary" aria-hidden="true"><i /><i /><i /><i /></div>
        </section>
      ) : null}
    </main>
  );
}

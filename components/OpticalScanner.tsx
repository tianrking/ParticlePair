"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractPayloadBits,
  GRID_SIZE,
  PHASE_DURATION_MS,
} from "../lib/optical-layout";
import {
  combineOpticalEvidence,
  rankOpticalFrameAnalyses,
  type OpticalSampleCandidate,
  type OpticalSampleFrame,
} from "../lib/optical-search";
import {
  guideCropCandidates,
  objectFitCoverSourceRectangle,
} from "../lib/camera-geometry";
import { perspectiveCandidatesForCrop, samplePerspectiveGridWithHealth, type CameraCaptureHealth } from "../lib/perspective-sampling";
import {
  AdaptiveOpticalSearch,
  opticalSearchCandidateLabel,
  type OpticalSearchTier,
} from "../lib/adaptive-optical-search";
import { decodeParticleCode, type DecodedParticleCode } from "../lib/protocol";
import { decodeV2Fragment, V2FountainDecoder } from "../lib/protocol-v2";
import { UI_COPY, type Language, type ScannerCopy } from "../lib/i18n";
import { FrameTimingEstimator, selectPhaseReference, type FrameTimingSnapshot } from "../lib/frame-timing";
import { ScanLoadController, type ScanLoadSnapshot } from "../lib/scan-load";
import { CandidateConsensus, type CandidateConsensusSnapshot } from "../lib/candidate-consensus";
import { CameraLifecycle, canResumeCameraTrack } from "../lib/camera-lifecycle";
import { tuneCameraTrack, type CameraTuningResult } from "../lib/camera-tuning";
import { ResolutionGovernor, resolutionConstraints, resolutionProfileFromWidth, type CaptureResolutionProfile } from "../lib/resolution-governor";
import { EvidenceDiversityGate } from "../lib/evidence-diversity";
import { analyzePayloadConfidence, type PayloadConfidenceSummary } from "../lib/payload-confidence";

interface OpticalScannerProps {
  language: Language;
  onDecoded: (result: DecodedParticleCode) => void;
}

interface EvidenceBucket {
  diversity: EvidenceDiversityGate;
  frames: { differences: number[]; quality: number }[];
  lastTimestamp: number;
}

type ScannerMessage =
  | { kind: "align" | "stopped" | "none" | "synchronizing" | "insecure" | "unsupported" | "searching" | "permission" | "overexposed" | "underexposed" | "softfocus" | "timing" | "ambiguous" | "background" | "interrupted" | "occluded" | "coverage" }
  | { kind: "success"; corrected: number; percent: number }
  | { kind: "boundary"; frames: number; percent: number }
  | { kind: "fountain"; rank: number; percent: number }
  | { kind: "candidate" | "noise"; percent: number };

const HISTORY_DURATION_MS = 900;
const MAX_ACCUMULATED_FRAMES = 5;
const SIGNAL_QUALITY = 0.3;
const DECODE_QUALITY = 0.47;
const PERSPECTIVE_PATCH_SIZE = 36;
const INITIAL_TIMING: FrameTimingSnapshot = { fps: 0, frameIntervalMs: 0, jitterMs: 0, pairToleranceMs: 120, state: "measuring" };
const INITIAL_LOAD: ScanLoadSnapshot = { processingMs: 0, state: "normal", utilization: 0 };
const INITIAL_CONSENSUS: CandidateConsensusSnapshot = { confidence: 0, dominantTransform: null, geometryStability: 0, margin: 0, state: "measuring" };
const INITIAL_TUNING: CameraTuningResult = { applied: [], attempted: [], failed: [], status: "native" };

function scannerMessageText(message: ScannerMessage, copy: ScannerCopy, language: Language): string {
  switch (message.kind) {
    case "stopped":
      return copy.stopped;
    case "success":
      return copy.success(message.percent, message.corrected);
    case "boundary":
      return copy.boundary(message.percent, message.frames);
    case "fountain":
      return language === "zh"
        ? `Fountain v2 ${message.percent}% · 方程秩 ${message.rank}/4 · 正在收集独立分片`
        : language === "es"
          ? `Fountain v2 ${message.percent}% · rango ${message.rank}/4 · recopilando fragmentos`
          : `Fountain v2 ${message.percent}% · equation rank ${message.rank}/4 · collecting fragments`;
    case "candidate":
      return copy.candidate(message.percent);
    case "none":
      return copy.none;
    case "noise":
      return copy.noise(message.percent);
    case "synchronizing":
      return copy.synchronizing;
    case "insecure":
      return copy.insecure;
    case "unsupported":
      return copy.unsupported;
    case "searching":
      return copy.searching;
    case "permission":
      return copy.permission;
    case "overexposed":
      return language === "zh" ? "画面高光溢出 · 请降低屏幕亮度或稍微拉远" : language === "es" ? "Altas luces saturadas · reduce el brillo o aumenta la distancia" : "Highlights clipped · lower screen brightness or move slightly farther away";
    case "underexposed":
      return language === "zh" ? "有效动态范围不足 · 请避开强背光并保持屏幕完整入框" : language === "es" ? "Rango dinámico insuficiente · evita el contraluz y encuadra toda la pantalla" : "Dynamic range too low · avoid backlight and keep the full screen in frame";
    case "softfocus":
      return language === "zh" ? "同步边框清晰度不足 · 请轻点屏幕对焦或稍微拉远" : language === "es" ? "Borde de sincronía desenfocado · toca para enfocar o aumenta un poco la distancia" : "Sync border is soft · tap to focus or move slightly farther away";
    case "timing":
      return language === "zh" ? "相机帧间隔波动较大 · 请保持页面在前台并关闭省电模式" : language === "es" ? "Cadencia de cámara inestable · mantén la página visible y desactiva el ahorro de energía" : "Camera cadence is unstable · keep the page visible and disable battery saver";
    case "ambiguous":
      return language === "zh" ? "方向候选存在歧义 · 请保持设备稳定并让四角完整入框" : language === "es" ? "Orientación ambigua · mantén el dispositivo estable y encuadra las cuatro esquinas" : "Orientation is ambiguous · hold steady and keep all four corners in frame";
    case "background":
      return language === "zh" ? "扫描已安全暂停 · 返回前台后将重新同步" : language === "es" ? "Escaneo pausado de forma segura · se resincronizará al volver" : "Scanning safely paused · synchronization restarts when you return";
    case "interrupted":
      return language === "zh" ? "相机连接已中断 · 请重新启动扫描" : language === "es" ? "Conexión de cámara interrumpida · reinicia el escaneo" : "Camera connection interrupted · restart the scanner";
    case "occluded":
      return language === "zh" ? "检测到局部遮挡 · 请移开手指并露出完整光学方框" : language === "es" ? "Oclusión localizada · retira los dedos y muestra el cuadro óptico completo" : "Localized occlusion detected · uncover the complete optical square";
    case "coverage":
      return language === "zh" ? "载荷覆盖率不足 · 请保持稳定并改善屏幕可见度" : language === "es" ? "Cobertura de carga insuficiente · mantén la estabilidad y mejora la visibilidad" : "Payload coverage is weak · hold steady and improve screen visibility";
    default:
      return copy.align;
  }
}

function sampleVideoCandidates(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  tier: OpticalSearchTier,
): OpticalSampleCandidate[] {
  canvas.width = PERSPECTIVE_PATCH_SIZE;
  canvas.height = PERSPECTIVE_PATCH_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const visible = objectFitCoverSourceRectangle(
    video.videoWidth,
    video.videoHeight,
    video.clientWidth || video.videoWidth,
    video.clientHeight || video.videoHeight,
  );
  const candidates: OpticalSampleCandidate[] = [];

  for (const crop of guideCropCandidates(visible)) {
    context.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    context.drawImage(
      video,
      crop.x,
      crop.y,
      crop.side,
      crop.side,
      0,
      0,
      PERSPECTIVE_PATCH_SIZE,
      PERSPECTIVE_PATCH_SIZE,
    );

    const pixels = context.getImageData(
      0,
      0,
      PERSPECTIVE_PATCH_SIZE,
      PERSPECTIVE_PATCH_SIZE,
    ).data;
    for (const perspective of perspectiveCandidatesForCrop(crop.key, PERSPECTIVE_PATCH_SIZE, tier)) {
      const sampled = samplePerspectiveGridWithHealth(pixels, PERSPECTIVE_PATCH_SIZE, PERSPECTIVE_PATCH_SIZE, perspective.quad, GRID_SIZE);
      candidates.push({ captureHealth: sampled.health, key: `${crop.key}:${perspective.key}`, values: sampled.values });
    }
  }

  return candidates;
}

function timedVideoCandidates(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  tier: OpticalSearchTier,
): { candidates: OpticalSampleCandidate[]; durationMs: number } {
  const started = performance.now();
  const candidates = sampleVideoCandidates(video, canvas, tier);
  return { candidates, durationMs: performance.now() - started };
}

function timedFrameAnalyses(current: OpticalSampleFrame, reference: OpticalSampleFrame): { durationMs: number; ranked: ReturnType<typeof rankOpticalFrameAnalyses> } {
  const started = performance.now();
  const ranked = rankOpticalFrameAnalyses(current, reference);
  return { durationMs: performance.now() - started, ranked };
}

export function OpticalScanner({ language, onDecoded }: OpticalScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const frameRef = useRef(0);
  const schedulerRef = useRef<"animation" | "video">("animation");
  const historyRef = useRef<OpticalSampleFrame[]>([]);
  const evidenceRef = useRef<Map<string, EvidenceBucket>>(new Map());
  const lastSuccessRef = useRef(0);
  const v2DecoderRef = useRef(new V2FountainDecoder());
  const adaptiveSearchRef = useRef(new AdaptiveOpticalSearch());
  const timingRef = useRef(new FrameTimingEstimator());
  const loadRef = useRef(new ScanLoadController());
  const consensusRef = useRef(new CandidateConsensus());
  const lifecycleRef = useRef(new CameraLifecycle());
  const resolutionGovernorRef = useRef(new ResolutionGovernor());
  const resolutionChangingRef = useRef(false);
  const lastTelemetryRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [cameraTuning, setCameraTuning] = useState<CameraTuningResult>(INITIAL_TUNING);
  const [captureProfile, setCaptureProfile] = useState<CaptureResolutionProfile | null>(null);
  const [quality, setQuality] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [payloadConfidence, setPayloadConfidence] = useState<PayloadConfidenceSummary | null>(null);
  const [telemetry, setTelemetry] = useState<{ candidates: number; consensus: CandidateConsensusSnapshot; exposureGain: number; health: CameraCaptureHealth | null; load: ScanLoadSnapshot; tier: OpticalSearchTier; timing: FrameTimingSnapshot }>({ candidates: 61, consensus: INITIAL_CONSENSUS, exposureGain: 1, health: null, load: INITIAL_LOAD, tier: "acquire", timing: INITIAL_TIMING });
  const [message, setMessage] = useState<ScannerMessage>({ kind: "align" });
  const copy = UI_COPY[language].scanner;

  const cancelScheduledFrame = () => {
    const video = videoRef.current;
    if (
      schedulerRef.current === "video" &&
      video &&
      typeof video.cancelVideoFrameCallback === "function"
    ) {
      video.cancelVideoFrameCallback(frameRef.current);
    } else {
      cancelAnimationFrame(frameRef.current);
    }
  };

  const resetScannerEvidence = () => {
    historyRef.current = [];
    evidenceRef.current.clear();
    v2DecoderRef.current = new V2FountainDecoder();
    adaptiveSearchRef.current.reset();
    timingRef.current.reset();
    loadRef.current.reset();
    consensusRef.current.reset();
    lastTelemetryRef.current = 0;
    setQuality(0);
    setEvidenceCount(0);
    setPayloadConfidence(null);
    setTelemetry({ candidates: 61, consensus: INITIAL_CONSENSUS, exposureGain: 1, health: null, load: INITIAL_LOAD, tier: "acquire", timing: INITIAL_TIMING });
  };

  const detachTrackHandlers = () => streamRef.current?.getVideoTracks().forEach((track) => { track.onended = null; track.onmute = null; track.onunmute = null; });

  const stop = () => {
    cancelScheduledFrame();
    detachTrackHandlers();
    lifecycleRef.current.transition("stop");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    runningRef.current = false;
    setCameraTuning(INITIAL_TUNING);
    setCaptureProfile(null);
    resetScannerEvidence();
    setRunning(false);
    setMessage({ kind: "stopped" });
  };

  const suspend = (kind: "background" | "interrupted") => {
    if (lifecycleRef.current.state !== "running") return;
    lifecycleRef.current.transition("suspend");
    cancelScheduledFrame();
    resetScannerEvidence();
    setMessage({ kind });
  };

  const resume = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || lifecycleRef.current.state !== "suspended" || !canResumeCameraTrack(document.visibilityState, track.readyState, track.muted)) return;
    lifecycleRef.current.transition("resume");
    resetScannerEvidence();
    setMessage({ kind: "searching" });
    scheduleNextFrame();
  };

  const handleTrackEnded = () => {
    cancelScheduledFrame();
    lifecycleRef.current.transition("end");
    detachTrackHandlers();
    streamRef.current = null;
    runningRef.current = false;
    setCameraTuning(INITIAL_TUNING);
    setCaptureProfile(null);
    resetScannerEvidence();
    setRunning(false);
    setMessage({ kind: "interrupted" });
  };

  useEffect(() => {
    const handleVisibility = () => document.visibilityState === "hidden" ? suspend("background") : resume();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  });

  useEffect(() => {
    const video = videoRef.current;
    const lifecycle = lifecycleRef.current;
    return () => {
      if (
        schedulerRef.current === "video" &&
        video &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(frameRef.current);
      } else {
        cancelAnimationFrame(frameRef.current);
      }
      detachTrackHandlers();
      lifecycle.transition("stop");
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function scheduleNextFrame(): void {
    const video = videoRef.current;
    if (!video || !runningRef.current || lifecycleRef.current.state !== "running") return;

    if (typeof video.requestVideoFrameCallback === "function") {
      schedulerRef.current = "video";
      frameRef.current = video.requestVideoFrameCallback((now) => {
        // Use WebKit's monotonic callback clock. mediaTime is not reliable for
        // every live MediaStream implementation and can remain at zero on iOS.
        sample(now);
      });
    } else {
      schedulerRef.current = "animation";
      frameRef.current = requestAnimationFrame(sample);
    }
  }

  function considerResolution(load: ScanLoadSnapshot): void {
    const target = resolutionGovernorRef.current.observe(load);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!target || !track || resolutionChangingRef.current || lifecycleRef.current.state === "ended") return;
    resolutionChangingRef.current = true;
    let capabilities: MediaTrackCapabilities = {};
    try { capabilities = track.getCapabilities?.() ?? {}; } catch { capabilities = {}; }
    void track.applyConstraints(resolutionConstraints(target, capabilities)).then(() => {
      if (streamRef.current?.getVideoTracks()[0] !== track) return;
      const actualProfile = resolutionProfileFromWidth(track.getSettings().width);
      if (actualProfile === target) resolutionGovernorRef.current.confirm(actualProfile);
      else resolutionGovernorRef.current.disable();
      setCaptureProfile(actualProfile);
      resetScannerEvidence();
      if (lifecycleRef.current.state === "running") setMessage({ kind: "searching" });
    }).catch(() => resolutionGovernorRef.current.disable()).finally(() => { resolutionChangingRef.current = false; });
  }

  function sample(timestamp: number): void {
    const video = videoRef.current;
    if (
      !video ||
      !runningRef.current ||
      lifecycleRef.current.state !== "running" ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      if (lifecycleRef.current.state === "running") scheduleNextFrame();
      return;
    }

    const canvas =
      samplingCanvasRef.current ?? document.createElement("canvas");
    samplingCanvasRef.current = canvas;
    const timing = timingRef.current.observe(timestamp);
    if (!loadRef.current.shouldProcess()) {
      scheduleNextFrame();
      return;
    }
    const tier = adaptiveSearchRef.current.tier;
    const mediaTimeSeconds = video.currentTime;
    const sampled = timedVideoCandidates(video, canvas, tier);
    const current: OpticalSampleFrame = {
      candidates: sampled.candidates,
      timestamp,
    };
    let processingDurationMs = sampled.durationMs;

    const history = historyRef.current;
    const reference = selectPhaseReference(history, timestamp, PHASE_DURATION_MS, timing.pairToleranceMs);

    history.push(current);
    historyRef.current = history.filter(
      (frame) => timestamp - frame.timestamp <= HISTORY_DURATION_MS,
    );

    if (reference) {
      const rankedResult = timedFrameAnalyses(current, reference);
      const ranked = rankedResult.ranked;
      processingDurationMs += rankedResult.durationMs;
      const load = loadRef.current.observe(processingDurationMs, timing.frameIntervalMs);
      considerResolution(load);
      const best = ranked[0];
      const consensus = consensusRef.current.observe(ranked.map((candidate) => ({ key: candidate.key, quality: candidate.analysis.quality, transform: candidate.transform })));
      const score = best?.analysis.quality ?? 0;
      const percent = Math.round(score * 100);
      setQuality(percent);

      if (timestamp - lastTelemetryRef.current >= 250) {
        lastTelemetryRef.current = timestamp;
        setTelemetry({
          candidates: current.candidates.length,
          consensus,
          exposureGain: best?.analysis.exposureGain ?? 1,
          health: best?.captureHealth ?? null,
          load,
          tier,
          timing,
        });
      }

      const decision = adaptiveSearchRef.current.observe({
        bestKey: best ? `${best.key}:${best.transform}` : undefined,
        quality: score,
        sampleDurationMs: processingDurationMs,
      });
      if (decision.changed) {
        historyRef.current = [];
        evidenceRef.current.clear();
        setEvidenceCount(0);
        setPayloadConfidence(null);
        setTelemetry({
          candidates: opticalSearchCandidateLabel(decision.tier),
          consensus,
          exposureGain: best?.analysis.exposureGain ?? 1,
          health: best?.captureHealth ?? null,
          load,
          tier: decision.tier,
          timing,
        });
      }

      for (const [key, bucket] of evidenceRef.current) {
        if (timestamp - bucket.lastTimestamp > 1200) {
          evidenceRef.current.delete(key);
        }
      }

      if (best && score > SIGNAL_QUALITY) {
        let recovered: DecodedParticleCode | null = null;
        let accumulatedFrames = 0;
        let v2Rank = 0;
        let coverageSummary: PayloadConfidenceSummary | null = null;

        for (const candidate of ranked) {
          if (
            candidate.analysis.quality < SIGNAL_QUALITY ||
            candidate.analysis.quality < score - 0.08
          ) {
            continue;
          }

          const evidenceKey = `${candidate.key}:${candidate.transform}`;
          const bucket = evidenceRef.current.get(evidenceKey) ?? {
            diversity: new EvidenceDiversityGate(),
            frames: [],
            lastTimestamp: timestamp,
          };
          const diversity = bucket.diversity.observe({ callbackTimeMs: timestamp, frameIntervalMs: timing.frameIntervalMs, mediaTimeSeconds });
          if (!diversity.accepted) continue;
          const oriented = candidate.analysis.differences.map(
            (difference) => difference * candidate.analysis.orientation,
          );
          bucket.frames.push({ differences: oriented, quality: candidate.analysis.quality });
          bucket.lastTimestamp = timestamp;
          if (bucket.frames.length > MAX_ACCUMULATED_FRAMES) {
            bucket.frames.shift();
          }
          evidenceRef.current.set(evidenceKey, bucket);
          accumulatedFrames = Math.max(accumulatedFrames, bucket.frames.length);
          setEvidenceCount(Math.min(3, accumulatedFrames));

          const combined = bucket.frames.length >= 2 ? combineOpticalEvidence(bucket.frames) : null;
          const confidence = combined ? analyzePayloadConfidence(combined.confidence) : null;
          if (confidence && !coverageSummary) { coverageSummary = confidence; setPayloadConfidence(confidence); }

          const canAttemptDecode =
            candidate.analysis.quality >= DECODE_QUALITY &&
            bucket.frames.length >= 2 &&
            confidence?.canDecode === true &&
            consensusRef.current.canDecode(candidate.transform) &&
            timestamp - lastSuccessRef.current > 1200;
          if (!canAttemptDecode) continue;

          try {
            if (!combined) continue;
            const cells = combined.differences.map((difference) => difference > 0);
            const bits = extractPayloadBits(cells);
            try {
              recovered = decodeParticleCode(bits);
            } catch {
              const fragment = decodeV2Fragment(bits);
              const progress = v2DecoderRef.current.add(fragment, fragment.issuedMinute);
              v2Rank = progress.rank;
              evidenceRef.current.clear();
              if (progress.complete && progress.secret && progress.secretHex) recovered = {
                correctedCodewords: fragment.correctedCodewords,
                protocolVersion: 2,
                sessionId: progress.sessionId,
                secret: progress.secret,
                secretHex: progress.secretHex,
              };
            }
            break;
          } catch {
            // Keep collecting soft evidence for this crop and orientation.
          }
        }

        if (recovered) {
          lastSuccessRef.current = timestamp;
          setMessage({
            kind: "success",
            corrected: recovered.correctedCodewords,
            percent,
          });
          onDecoded(recovered);
        } else if (v2Rank > 0) {
          setMessage({ kind: "fountain", rank: v2Rank, percent });
        } else if (coverageSummary?.state === "occluded") {
          setMessage({ kind: "occluded" });
        } else if (coverageSummary?.state === "weak") {
          setMessage({ kind: "coverage" });
        } else if (score >= DECODE_QUALITY && consensus.state === "ambiguous") {
          setMessage({ kind: "ambiguous" });
        } else if (score >= DECODE_QUALITY) {
          setMessage({
            kind: "boundary",
            frames: v2Rank || Math.min(3, accumulatedFrames),
            percent,
          });
        } else {
          setMessage({ kind: "candidate", percent });
        }
      } else {
        consensusRef.current.observe([]);
        setEvidenceCount(0);
        setPayloadConfidence(null);
        const healthState = best?.captureHealth?.state;
        setMessage(healthState === "clipped" ? { kind: "overexposed" } : healthState === "dark" || healthState === "flat" ? { kind: "underexposed" } : best?.captureHealth?.focusState === "soft" ? { kind: "softfocus" } : percent === 0 ? { kind: "none" } : { kind: "noise", percent });
      }
    } else {
      considerResolution(loadRef.current.observe(processingDurationMs, timing.frameIntervalMs));
      setMessage(timing.state === "jittery" ? { kind: "timing" } : { kind: "synchronizing" });
    }

    scheduleNextFrame();
  }

  const start = async () => {
    if (!window.isSecureContext) {
      setMessage({ kind: "insecure" });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage({ kind: "unsupported" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      setCameraTuning(track ? await tuneCameraTrack(track) : INITIAL_TUNING);
      const initialProfile = resolutionProfileFromWidth(track?.getSettings().width);
      resolutionGovernorRef.current.reset(initialProfile);
      resolutionChangingRef.current = false;
      setCaptureProfile(initialProfile);
      await video.play();
      resetScannerEvidence();
      runningRef.current = true;
      lifecycleRef.current.transition("start");
      if (track) { track.onended = handleTrackEnded; track.onmute = () => suspend("interrupted"); track.onunmute = resume; }
      setRunning(true);
      setMessage({ kind: "searching" });
      scheduleNextFrame();
    } catch {
      detachTrackHandlers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      runningRef.current = false;
      setCameraTuning(INITIAL_TUNING);
      setCaptureProfile(null);
      lifecycleRef.current.transition("stop");
      resetScannerEvidence();
      setRunning(false);
      setMessage({ kind: "permission" });
    }
  };

  return (
    <div className="scanner-shell">
      <div className={["camera-stage", running && "is-running", lifecycleRef.current.state === "suspended" && "is-suspended"].filter(Boolean).join(" ")}>
        <video ref={videoRef} muted playsInline aria-label={copy.cameraView} />
        <div className="camera-placeholder" aria-hidden={running}>
          <span className="scanner-orbit" />
          <span>CAMERA</span>
        </div>
        <div className="scan-frame" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <span className="scan-quality-label">SYNC {quality}%</span>
        <div className={`evidence-meter ${payloadConfidence?.state ?? "measuring"}`} aria-label={`${evidenceCount} of 3 independent evidence frames${payloadConfidence ? `, ${Math.round(payloadConfidence.coverage * 100)} percent payload coverage` : ""}`}>
          <span>EVIDENCE{payloadConfidence ? ` · Q${Math.round(payloadConfidence.coverage * 100)}` : ""}</span>
          {[0, 1, 2].map((index) => <i key={index} className={index < evidenceCount ? "is-active" : undefined} />)}
        </div>
        <div className={`scanner-telemetry health-${telemetry.health?.state ?? "idle"} focus-${telemetry.health?.focusState ?? "unknown"}`} aria-label="Scanner performance, dynamic range, and focus telemetry">
          <span>{telemetry.tier.toUpperCase()}</span>
          <span className={captureProfile === "eco" ? "resolution-eco" : undefined}>GEO{telemetry.candidates}·{captureProfile?.toUpperCase() ?? "—"}</span>
          <span>{telemetry.timing.fps ? `${telemetry.load.processingMs.toFixed(1)}MS · ${telemetry.timing.fps}F` : "—MS · —F"}</span>
          <span className={cameraTuning.applied.includes("focus") ? "camera-tuned" : undefined} title={cameraTuning.applied.length ? `Camera enhancements: ${cameraTuning.applied.join(", ")}` : "Native camera automation"}>{cameraTuning.applied.includes("focus") ? "AF·" : ""}AE×{telemetry.exposureGain.toFixed(2)}</span>
          <span className="health-pill">{telemetry.health ? `DR${Math.round(telemetry.health.score * 100)} · F${Math.round(telemetry.health.focusScore * 100)}` : "DR— · F—"}</span>
          <span className={`consensus-pill ${telemetry.consensus.state}`}>C{telemetry.consensus.state === "measuring" ? "—" : Math.round(telemetry.consensus.confidence * 100)}</span>
          <span className={`timing-pill ${telemetry.timing.state} ${telemetry.load.state}`}>{telemetry.timing.state === "measuring" ? "J— · L—" : `J${Math.round(telemetry.timing.jitterMs)} · L${Math.round(telemetry.load.utilization * 100)}`}</span>
        </div>
        <div
          className="scan-quality"
          role="progressbar"
          aria-label={copy.syncQuality}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={quality}
        >
          <span style={{ width: `${quality}%` }} />
        </div>
      </div>
      <p className="scanner-message" role="status" aria-live="polite">{scannerMessageText(message, copy, language)}</p>
      <button className="secondary-button full-width" type="button" onClick={running ? stop : start}>
        {running ? copy.stop : copy.start}
      </button>
    </div>
  );
}

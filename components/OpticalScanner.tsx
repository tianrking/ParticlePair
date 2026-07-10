"use client";

import { useEffect, useRef, useState } from "react";
import {
  CELL_COUNT,
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
import { opticalPixelValue } from "../lib/optical-color";
import { decodeParticleCode, type DecodedParticleCode } from "../lib/protocol";
import { decodeV2Fragment, V2FountainDecoder } from "../lib/protocol-v2";
import { UI_COPY, type Language, type ScannerCopy } from "../lib/i18n";

interface OpticalScannerProps {
  language: Language;
  onDecoded: (result: DecodedParticleCode) => void;
}

interface EvidenceBucket {
  frames: { differences: number[]; quality: number }[];
  lastTimestamp: number;
}

type ScannerMessage =
  | { kind: "align" | "stopped" | "none" | "synchronizing" | "insecure" | "unsupported" | "searching" | "permission" }
  | { kind: "success"; corrected: number; percent: number }
  | { kind: "boundary"; frames: number; percent: number }
  | { kind: "fountain"; rank: number; percent: number }
  | { kind: "candidate" | "noise"; percent: number };

const HISTORY_DURATION_MS = 900;
const PHASE_TOLERANCE_MS = 120;
const MAX_ACCUMULATED_FRAMES = 5;
const SIGNAL_QUALITY = 0.3;
const DECODE_QUALITY = 0.47;

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
    default:
      return copy.align;
  }
}

function sampleVideoCandidates(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): OpticalSampleCandidate[] {
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
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
      GRID_SIZE,
      GRID_SIZE,
    );

    const pixels = context.getImageData(
      0,
      0,
      GRID_SIZE,
      GRID_SIZE,
    ).data;
    const values = Array.from({ length: CELL_COUNT }, (_, index) => {
      const pixelOffset = index * 4;
      return opticalPixelValue(
        pixels[pixelOffset],
        pixels[pixelOffset + 1],
        pixels[pixelOffset + 2],
      );
    });
    candidates.push({
      key: crop.key,
      values,
    });
  }

  return candidates;
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
  const [running, setRunning] = useState(false);
  const [quality, setQuality] = useState(0);
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

  const stop = () => {
    cancelScheduledFrame();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    runningRef.current = false;
    historyRef.current = [];
    evidenceRef.current.clear();
    v2DecoderRef.current = new V2FountainDecoder();
    setRunning(false);
    setQuality(0);
    setMessage({ kind: "stopped" });
  };

  useEffect(() => {
    const video = videoRef.current;
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function scheduleNextFrame(): void {
    const video = videoRef.current;
    if (!video || !runningRef.current) return;

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

  function sample(timestamp: number): void {
    const video = videoRef.current;
    if (
      !video ||
      !runningRef.current ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      scheduleNextFrame();
      return;
    }

    const canvas =
      samplingCanvasRef.current ?? document.createElement("canvas");
    samplingCanvasRef.current = canvas;
    const current: OpticalSampleFrame = {
      candidates: sampleVideoCandidates(video, canvas),
      timestamp,
    };

    const history = historyRef.current;
    const reference = history
      .filter((frame) => {
        const delta = timestamp - frame.timestamp;
        return (
          delta >= PHASE_DURATION_MS - PHASE_TOLERANCE_MS &&
          delta <= PHASE_DURATION_MS + PHASE_TOLERANCE_MS
        );
      })
      .sort(
        (left, right) =>
          Math.abs(timestamp - left.timestamp - PHASE_DURATION_MS) -
          Math.abs(timestamp - right.timestamp - PHASE_DURATION_MS),
      )[0];

    history.push(current);
    historyRef.current = history.filter(
      (frame) => timestamp - frame.timestamp <= HISTORY_DURATION_MS,
    );

    if (reference) {
      const ranked = rankOpticalFrameAnalyses(current, reference);
      const best = ranked[0];
      const score = best?.analysis.quality ?? 0;
      const percent = Math.round(score * 100);
      setQuality(percent);

      for (const [key, bucket] of evidenceRef.current) {
        if (timestamp - bucket.lastTimestamp > 1200) {
          evidenceRef.current.delete(key);
        }
      }

      if (best && score > SIGNAL_QUALITY) {
        let recovered: DecodedParticleCode | null = null;
        let accumulatedFrames = 0;
        let v2Rank = 0;

        for (const candidate of ranked) {
          if (
            candidate.analysis.quality < SIGNAL_QUALITY ||
            candidate.analysis.quality < score - 0.08
          ) {
            continue;
          }

          const evidenceKey = `${candidate.key}:${candidate.transform}`;
          const bucket = evidenceRef.current.get(evidenceKey) ?? {
            frames: [],
            lastTimestamp: timestamp,
          };
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

          const canAttemptDecode =
            candidate.analysis.quality >= DECODE_QUALITY &&
            timestamp - lastSuccessRef.current > 1200;
          if (!canAttemptDecode) continue;

          try {
            const combined = combineOpticalEvidence(bucket.frames);
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
        setMessage(percent === 0 ? { kind: "none" } : { kind: "noise", percent });
      }
    } else {
      setMessage({ kind: "synchronizing" });
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
      await video.play();
      historyRef.current = [];
      evidenceRef.current.clear();
      v2DecoderRef.current = new V2FountainDecoder();
      runningRef.current = true;
      setRunning(true);
      setMessage({ kind: "searching" });
      scheduleNextFrame();
    } catch {
      setMessage({ kind: "permission" });
    }
  };

  return (
    <div className="scanner-shell">
      <div className={`camera-stage ${running ? "is-running" : ""}`}>
        <video ref={videoRef} muted playsInline aria-label={copy.cameraView} />
        <div className="camera-placeholder" aria-hidden={running}>
          <span className="scanner-orbit" />
          <span>CAMERA</span>
        </div>
        <div className="scan-frame" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <span className="scan-quality-label">SYNC {quality}%</span>
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
      <p className="scanner-message">{scannerMessageText(message, copy, language)}</p>
      <button className="secondary-button full-width" type="button" onClick={running ? stop : start}>
        {running ? copy.stop : copy.start}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  CELL_COUNT,
  extractPayloadBits,
  GRID_SIZE,
  PHASE_DURATION_MS,
} from "../lib/optical-layout";
import {
  averageOpticalEvidence,
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

interface OpticalScannerProps {
  onDecoded: (result: DecodedParticleCode) => void;
}

interface EvidenceBucket {
  frames: number[][];
  lastTimestamp: number;
}

const HISTORY_DURATION_MS = 900;
const PHASE_TOLERANCE_MS = 120;
const MAX_ACCUMULATED_FRAMES = 5;
const SIGNAL_QUALITY = 0.3;
const DECODE_QUALITY = 0.47;

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

export function OpticalScanner({ onDecoded }: OpticalScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const frameRef = useRef(0);
  const schedulerRef = useRef<"animation" | "video">("animation");
  const historyRef = useRef<OpticalSampleFrame[]>([]);
  const evidenceRef = useRef<Map<string, EvidenceBucket>>(new Map());
  const lastSuccessRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [quality, setQuality] = useState(0);
  const [message, setMessage] = useState("将电脑上的完整粒子方框对准取景框");

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
    setRunning(false);
    setQuality(0);
    setMessage("扫描已停止");
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
          bucket.frames.push(oriented);
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
            const averaged = averageOpticalEvidence(bucket.frames);
            const cells = averaged.map((difference) => difference > 0);
            recovered = decodeParticleCode(extractPayloadBits(cells));
            break;
          } catch {
            // Keep collecting soft evidence for this crop and orientation.
          }
        }

        if (recovered) {
          lastSuccessRef.current = timestamp;
          setMessage(
            `识别成功 · ${percent}% · 修正 ${recovered.correctedCodewords} 个码字`,
          );
          onDecoded(recovered);
        } else if (score >= DECODE_QUALITY) {
          setMessage(
            `边界 ${percent}% · 正在累积 ${Math.min(3, accumulatedFrames)}/3 帧并校验CRC`,
          );
        } else {
          setMessage(`检测到同步候选 ${percent}% · 请保持手机稳定`);
        }
      } else {
        setMessage(
          percent === 0
            ? "未检测到粒子码 · 请将完整方框对准取景框"
            : `正在排除背景噪声 ${percent}% · 请对准完整方框`,
        );
      }
    } else {
      setMessage("已收到相机画面 · 正在同步300ms相反相位…");
    }

    scheduleNextFrame();
  }

  const start = async () => {
    if (!window.isSecureContext) {
      setMessage("摄像头需要HTTPS安全页面，请使用部署地址打开");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("当前浏览器不支持摄像头访问，请升级Chrome、Safari、Edge或Firefox");
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
      runningRef.current = true;
      setRunning(true);
      setMessage("正在搜索位置、比例与方向…");
      scheduleNextFrame();
    } catch {
      setMessage("无法打开摄像头，请在浏览器与系统设置中允许相机权限");
    }
  };

  return (
    <div className="scanner-shell">
      <div className={`camera-stage ${running ? "is-running" : ""}`}>
        <video ref={videoRef} muted playsInline />
        <div className="camera-placeholder" aria-hidden={running}>
          <span className="scanner-orbit" />
          <span>CAMERA</span>
        </div>
        <div className="scan-frame" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <span className="scan-quality-label">SYNC {quality}%</span>
        <div className="scan-quality"><span style={{ width: `${quality}%` }} /></div>
      </div>
      <p className="scanner-message">{message}</p>
      <button className="secondary-button full-width" type="button" onClick={running ? stop : start}>
        {running ? "停止扫描" : "打开摄像头扫描"}
      </button>
    </div>
  );
}

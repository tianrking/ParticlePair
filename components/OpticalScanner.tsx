"use client";

import { useEffect, useRef, useState } from "react";
import {
  CELL_COUNT,
  extractPayloadBits,
  GRID_SIZE,
} from "../lib/optical-layout";
import { analyzeDifferentialFrames } from "../lib/optical-decoder";
import { decodeParticleCode, type DecodedParticleCode } from "../lib/protocol";

interface OpticalScannerProps {
  onDecoded: (result: DecodedParticleCode) => void;
}

export function OpticalScanner({ onDecoded }: OpticalScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const frameRef = useRef<number>(0);
  const historyRef = useRef<number[][]>([]);
  const lastSuccessRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [quality, setQuality] = useState(0);
  const [message, setMessage] = useState("将另一台设备上的粒子云对准取景框");

  const stop = () => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    runningRef.current = false;
    historyRef.current = [];
    setRunning(false);
    setQuality(0);
    setMessage("扫描已停止");
  };

  useEffect(() => stop, []);

  const sample = (timestamp: number) => {
    const video = videoRef.current;
    if (!video || !runningRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRef.current = requestAnimationFrame(sample);
      return;
    }

    const canvas = samplingCanvasRef.current ?? document.createElement("canvas");
    samplingCanvasRef.current = canvas;
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const sourceSide = Math.min(video.videoWidth, video.videoHeight) * 0.76;
    const sourceX = (video.videoWidth - sourceSide) / 2;
    const sourceY = (video.videoHeight - sourceSide) / 2;
    context.drawImage(video, sourceX, sourceY, sourceSide, sourceSide, 0, 0, GRID_SIZE, GRID_SIZE);

    const pixels = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;
    const values = Array.from({ length: CELL_COUNT }, (_, index) => {
      const offset = index * 4;
      return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
    });

    const history = historyRef.current;
    history.push(values);
    if (history.length > 12) history.shift();

    if (history.length >= 8) {
      const reference = history[0];
      const analysis = analyzeDifferentialFrames(values, reference);
      const score = analysis.quality;
      setQuality(Math.round(score * 100));

      if (score > 0.52 && timestamp - lastSuccessRef.current > 1200) {
        try {
          const result = decodeParticleCode(extractPayloadBits(analysis.cells));
          lastSuccessRef.current = timestamp;
          setMessage(`识别成功 · 修正 ${result.correctedCodewords} 个码字`);
          onDecoded(result);
        } catch {
          setMessage("已锁定光学帧，正在校验数据…");
        }
      } else if (score > 0.3) {
        setMessage("发现粒子码信号，请保持稳定");
      }
    }

    frameRef.current = requestAnimationFrame(sample);
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("当前浏览器不支持摄像头访问");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      historyRef.current = [];
      runningRef.current = true;
      setRunning(true);
      setMessage("正在寻找同步边界…");
      frameRef.current = requestAnimationFrame(sample);
    } catch {
      setMessage("无法打开摄像头，请检查浏览器权限");
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
        <div className="scan-quality"><span style={{ width: `${quality}%` }} /></div>
      </div>
      <p className="scanner-message">{message}</p>
      <button className="secondary-button full-width" type="button" onClick={running ? stop : start}>
        {running ? "停止扫描" : "打开摄像头扫描"}
      </button>
    </div>
  );
}

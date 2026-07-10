"use client";

import { useEffect, useRef, type RefObject } from "react";
import { renderParticleFrame } from "../lib/particle-renderer";
import type { VisualModeId } from "../lib/visual-modes";
import { decorativeQualityFor, RenderPerformanceGovernor, type RenderPerformanceSnapshot, type RenderQualitySetting } from "../lib/render-performance";

interface ParticleCloudProps {
  ariaLabel: string;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  cells: readonly boolean[];
  strength: number;
  paused?: boolean;
  mode?: VisualModeId;
  renderQuality?: RenderQualitySetting;
  onPerformance?: (snapshot: RenderPerformanceSnapshot) => void;
}

export function ParticleCloud({ ariaLabel, canvasRef: externalCanvasRef, cells, strength, paused = false, mode = "galaxy", renderQuality = "auto", onPerformance }: ParticleCloudProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const cellsRef = useRef(cells);
  const strengthRef = useRef(strength);
  const modeRef = useRef(mode);
  const qualityRef = useRef(renderQuality);
  const performanceCallbackRef = useRef(onPerformance);
  const governorRef = useRef(new RenderPerformanceGovernor());
  const lastPerformanceReportRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const frozenTimeRef = useRef(0);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    strengthRef.current = strength;
  }, [strength]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => { qualityRef.current = renderQuality; if (renderQuality === "auto") governorRef.current.reset(); }, [renderQuality]);
  useEffect(() => { performanceCallbackRef.current = onPerformance; }, [onPerformance]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduceMotionRef.current = media.matches; }; update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let animationFrame = 0;
    const render = (timestamp: number) => {
      const measured = governorRef.current.sample(timestamp);
      const activeProfile = qualityRef.current === "auto" ? measured.profile : qualityRef.current;
      if (timestamp - lastPerformanceReportRef.current >= 750) { lastPerformanceReportRef.current = timestamp; performanceCallbackRef.current?.({ fps: measured.fps, profile: activeProfile }); }
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const time = paused ? frozenTimeRef.current : timestamp;
      if (!paused) frozenTimeRef.current = timestamp;
      renderParticleFrame({
        cells: cellsRef.current,
        context,
        height,
        pixelRatio,
        strength: strengthRef.current,
        time,
        width,
        mode: modeRef.current,
        decorativeQuality: decorativeQualityFor(activeProfile),
        reduceDecorativeMotion: reduceMotionRef.current,
      });

      if (!paused) animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [canvasRef, paused]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-label={ariaLabel} />;
}

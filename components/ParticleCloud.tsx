"use client";

import { useEffect, useRef, type RefObject } from "react";
import { renderParticleFrame } from "../lib/particle-renderer";
import type { VisualModeId } from "../lib/visual-modes";

interface ParticleCloudProps {
  ariaLabel: string;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  cells: readonly boolean[];
  strength: number;
  paused?: boolean;
  mode?: VisualModeId;
  renderQuality?: "ultra" | "balanced" | "efficient";
}

export function ParticleCloud({ ariaLabel, canvasRef: externalCanvasRef, cells, strength, paused = false, mode = "galaxy", renderQuality = "ultra" }: ParticleCloudProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const cellsRef = useRef(cells);
  const strengthRef = useRef(strength);
  const modeRef = useRef(mode);
  const qualityRef = useRef(renderQuality);
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

  useEffect(() => { qualityRef.current = renderQuality; }, [renderQuality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let animationFrame = 0;
    const render = (timestamp: number) => {
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
        decorativeQuality: qualityRef.current === "ultra" ? 1 : qualityRef.current === "balanced" ? 0.72 : 0.46,
      });

      if (!paused) animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [canvasRef, paused]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-label={ariaLabel} />;
}

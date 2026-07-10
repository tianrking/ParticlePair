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
}

export function ParticleCloud({ ariaLabel, canvasRef: externalCanvasRef, cells, strength, paused = false, mode = "galaxy" }: ParticleCloudProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const cellsRef = useRef(cells);
  const strengthRef = useRef(strength);
  const pausedRef = useRef(paused);
  const modeRef = useRef(mode);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    strengthRef.current = strength;
  }, [strength]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let animationFrame = 0;
    let frozenTime = 0;

    const render = (timestamp: number) => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const time = pausedRef.current ? frozenTime : timestamp;
      if (!pausedRef.current) frozenTime = timestamp;
      renderParticleFrame({
        cells: cellsRef.current,
        context,
        height,
        pixelRatio,
        strength: strengthRef.current,
        time,
        width,
        mode: modeRef.current,
      });

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [canvasRef]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-label={ariaLabel} />;
}

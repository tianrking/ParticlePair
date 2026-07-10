"use client";

import { useEffect, useRef, type RefObject } from "react";
import { renderParticleFrame } from "../lib/particle-renderer";

interface ParticleCloudProps {
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  cells: readonly boolean[];
  strength: number;
  paused?: boolean;
}

export function ParticleCloud({ canvasRef: externalCanvasRef, cells, strength, paused = false }: ParticleCloudProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const cellsRef = useRef(cells);
  const strengthRef = useRef(strength);
  const pausedRef = useRef(paused);

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
      });

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [canvasRef]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-label="正在广播的粒子配对码" />;
}

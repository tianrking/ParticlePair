"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { GRID_SIZE, PHASE_DURATION_MS } from "../lib/optical-layout";

interface ParticleCloudProps {
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  cells: readonly boolean[];
  strength: number;
  paused?: boolean;
}

interface Particle {
  angle: number;
  radius: number;
  depth: number;
  size: number;
  speed: number;
  hue: number;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function ParticleCloud({ canvasRef: externalCanvasRef, cells, strength, paused = false }: ParticleCloudProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;
  const cellsRef = useRef(cells);
  const strengthRef = useRef(strength);
  const pausedRef = useRef(paused);

  const particles = useMemo(() => {
    const random = mulberry32(0x50434f44);
    return Array.from({ length: 620 }, (): Particle => ({
      angle: random() * Math.PI * 2,
      radius: Math.pow(random(), 0.58),
      depth: random(),
      size: 0.45 + random() * 1.85,
      speed: 0.08 + random() * 0.24,
      hue: 184 + random() * 48,
    }));
  }, []);

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
      const phase = Math.floor(time / PHASE_DURATION_MS) % 2 === 1;
      const side = Math.min(width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const cellSize = side / GRID_SIZE;

      const background = context.createRadialGradient(centerX, centerY, side * 0.04, centerX, centerY, side * 0.68);
      background.addColorStop(0, "#07172a");
      background.addColorStop(0.55, "#030914");
      background.addColorStop(1, "#010307");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "lighter";
      const modulation = strengthRef.current;

      for (let index = 0; index < cellsRef.current.length; index += 1) {
        const row = Math.floor(index / GRID_SIZE);
        const column = index % GRID_SIZE;
        const x = centerX - side / 2 + (column + 0.5) * cellSize;
        const y = centerY - side / 2 + (row + 0.5) * cellSize;
        const positive = cellsRef.current[index] === phase;
        const alpha = 0.052 + (positive ? modulation : -modulation) * 0.13;
        const glow = context.createRadialGradient(x, y, 0, x, y, cellSize * 0.58);
        glow.addColorStop(0, `rgba(80, 222, 255, ${Math.max(0.012, alpha)})`);
        glow.addColorStop(1, "rgba(20, 94, 166, 0)");
        context.fillStyle = glow;
        context.fillRect(x - cellSize * 0.65, y - cellSize * 0.65, cellSize * 1.3, cellSize * 1.3);
      }

      const rotation = time * 0.00011;
      for (const particle of particles) {
        const wave = Math.sin(time * 0.0007 + particle.angle * 3.1) * 0.045;
        const radius = (particle.radius + wave) * side * 0.43;
        const angle = particle.angle + rotation * particle.speed * 6;
        const perspective = 0.76 + particle.depth * 0.3;
        const x = centerX + Math.cos(angle) * radius * perspective;
        const y = centerY + Math.sin(angle) * radius * (0.72 + particle.depth * 0.24);
        const shimmer = 0.42 + Math.sin(time * 0.0014 + particle.angle * 9) * 0.18;

        context.beginPath();
        context.fillStyle = `hsla(${particle.hue}, 92%, 68%, ${shimmer})`;
        context.arc(x, y, particle.size * pixelRatio * (0.7 + particle.depth), 0, Math.PI * 2);
        context.fill();
      }

      context.globalCompositeOperation = "source-over";
      const vignette = context.createRadialGradient(centerX, centerY, side * 0.34, centerX, centerY, side * 0.72);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,.82)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [canvasRef, particles]);

  return <canvas ref={canvasRef} className="particle-canvas" aria-label="正在广播的粒子配对码" />;
}

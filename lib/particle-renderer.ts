import {
  GRID_SIZE,
  isBorderCell,
  PHASE_DURATION_MS,
} from "./optical-layout";

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

const PARTICLES: readonly Particle[] = (() => {
  const random = mulberry32(0x50434f44);
  return Array.from({ length: 620 }, (): Particle => ({
    angle: random() * Math.PI * 2,
    radius: Math.pow(random(), 0.58),
    depth: random(),
    size: 0.45 + random() * 1.85,
    speed: 0.08 + random() * 0.24,
    hue: 184 + random() * 48,
  }));
})();

export interface ParticleFrameOptions {
  cells: readonly boolean[];
  context: CanvasRenderingContext2D;
  height: number;
  phase?: boolean;
  pixelRatio: number;
  strength: number;
  time: number;
  width: number;
}

/** Render one complete optical frame. An explicit phase makes iOS diagnostics deterministic. */
export function renderParticleFrame({
  cells,
  context,
  height,
  phase: explicitPhase,
  pixelRatio,
  strength,
  time,
  width,
}: ParticleFrameOptions): void {
  const phase =
    explicitPhase ?? Math.floor(time / PHASE_DURATION_MS) % 2 === 1;
  const side = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const cellSize = side / GRID_SIZE;

  const background = context.createRadialGradient(
    centerX,
    centerY,
    side * 0.04,
    centerX,
    centerY,
    side * 0.68,
  );
  background.addColorStop(0, "#07172a");
  background.addColorStop(0.55, "#030914");
  background.addColorStop(1, "#010307");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "lighter";
  for (let index = 0; index < cells.length; index += 1) {
    const row = Math.floor(index / GRID_SIZE);
    const column = index % GRID_SIZE;
    const x = centerX - side / 2 + (column + 0.5) * cellSize;
    const y = centerY - side / 2 + (row + 0.5) * cellSize;
    const positive = cells[index] === phase;
    const borderBoost = isBorderCell(index) ? 1.22 : 1;
    const alpha =
      0.052 +
      (positive ? strength : -strength) * 0.13 * borderBoost;
    const glow = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      cellSize * 0.58,
    );
    glow.addColorStop(
      0,
      `rgba(80, 222, 255, ${Math.max(0.012, alpha)})`,
    );
    glow.addColorStop(1, "rgba(20, 94, 166, 0)");
    context.fillStyle = glow;
    context.fillRect(
      x - cellSize * 0.65,
      y - cellSize * 0.65,
      cellSize * 1.3,
      cellSize * 1.3,
    );
  }

  // Keep the original drifting/rotating character, but make the decorative
  // layer slower and dimmer than the optical carrier so 300 ms camera
  // differences remain dominated by the encoded cell glows.
  const rotation = time * 0.000055;
  for (const particle of PARTICLES) {
    const wave = Math.sin(time * 0.00035 + particle.angle * 3.1) * 0.045;
    const radius = (particle.radius + wave) * side * 0.43;
    const angle = particle.angle + rotation * particle.speed * 6;
    const perspective = 0.76 + particle.depth * 0.3;
    const x = centerX + Math.cos(angle) * radius * perspective;
    const y =
      centerY +
      Math.sin(angle) * radius * (0.72 + particle.depth * 0.24);
    const shimmer =
      (0.42 + Math.sin(time * 0.0007 + particle.angle * 9) * 0.18) * 0.34;

    context.beginPath();
    context.fillStyle = `hsla(${particle.hue}, 92%, 68%, ${shimmer})`;
    context.arc(
      x,
      y,
      particle.size * pixelRatio * (0.7 + particle.depth),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.globalCompositeOperation = "source-over";
  const vignette = context.createRadialGradient(
    centerX,
    centerY,
    side * 0.38,
    centerX,
    centerY,
    side * 0.74,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.56)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

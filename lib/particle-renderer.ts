import {
  GRID_SIZE,
  isBorderCell,
  PHASE_DURATION_MS,
} from "./optical-layout";
import { visualMode, visualModeVariant, type VisualModeId } from "./visual-modes";
import { drawArtisticScene } from "./artistic-scenes";
import { deriveVisualDna } from "./visual-dna";

interface Particle {
  angle: number;
  color: readonly [number, number, number];
  radius: number;
  depth: number;
  size: number;
  speed: number;
}

const GALAXY_COLORS = [
  [48, 18, 255],
  [92, 12, 255],
  [157, 8, 255],
  [224, 8, 238],
  [255, 10, 166],
  [255, 16, 122],
] as const;

const DNA_COLORS = [
  [255, 38, 185],
  [104, 54, 255],
  [255, 104, 42],
] as const;

function hexRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
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
  return Array.from({ length: 1050 }, (_, index): Particle => {
    const radius = Math.pow(random(), 0.66);
    const haloParticle = random() < 0.18;
    const arm = (index % 3) * ((Math.PI * 2) / 3);
    const armJitter = (random() + random() - 1) * (0.42 + radius * 0.52);
    const angle = haloParticle
      ? random() * Math.PI * 2
      : arm + radius * 5.35 + armJitter;

    return {
      angle,
      color: GALAXY_COLORS[Math.floor(random() * GALAXY_COLORS.length)],
      depth: random(),
      radius,
      size: 0.5 + random() * 2.15,
      speed: 0.08 + random() * 0.24,
    };
  });
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
  mode?: VisualModeId;
  decorativeQuality?: number;
  reduceDecorativeMotion?: boolean;
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
  mode = "galaxy",
  decorativeQuality = 1,
  reduceDecorativeMotion = false,
}: ParticleFrameOptions): void {
  const selectedMode = visualMode(mode);
  const visualDna = deriveVisualDna(cells);
  const structuralVariant = visualModeVariant(mode);
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
  background.addColorStop(0, selectedMode.kind === "galaxy" ? "#10144a" : "#07152a");
  background.addColorStop(0.48, "#080b2a");
  background.addColorStop(1, "#01020a");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const nebula = context.createLinearGradient(
    centerX - side * 0.48,
    centerY - side * 0.32,
    centerX + side * 0.48,
    centerY + side * 0.32,
  );
  nebula.addColorStop(0, "rgba(61, 93, 255, .13)");
  nebula.addColorStop(0.48, "rgba(173, 50, 255, .08)");
  nebula.addColorStop(1, "rgba(255, 47, 174, .11)");
  context.fillStyle = nebula;
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
      0.055 +
      (positive ? strength : -strength) * 0.4 * borderBoost;
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
      `rgba(35, 255, 218, ${Math.max(0.012, alpha)})`,
    );
    glow.addColorStop(1, "rgba(16, 120, 178, 0)");
    context.fillStyle = glow;
    context.fillRect(
      x - cellSize * 0.65,
      y - cellSize * 0.65,
      cellSize * 1.3,
      cellSize * 1.3,
    );
  }

  const decorativeTime = reduceDecorativeMotion ? 0 : time;
  if (selectedMode.kind !== "galaxy") {
    drawArtisticScene({ context, height, mode: selectedMode, pixelRatio, time: decorativeTime, width });
  }

  const rotation = decorativeTime * (0.000052 + structuralVariant * 0.000052);
  const particleStep = decorativeQuality < 0.6 ? 3 : decorativeQuality < 0.85 ? 2 : 1;
  for (let particleIndex = 0; particleIndex < PARTICLES.length; particleIndex += particleStep) {
    if (selectedMode.kind !== "galaxy") break;
    const particle = PARTICLES[particleIndex];
    const legacyGalaxy = selectedMode.id === "galaxy";
    const wave = Math.sin(decorativeTime * (legacyGalaxy ? 0.00014 : 0.00021 + structuralVariant * 0.00017) + particle.angle * (legacyGalaxy ? 2.6 : 2.1 + structuralVariant)) * (0.016 + (1 - particle.depth) * 0.018);
    const radius = legacyGalaxy ? (particle.radius + wave) * side * 0.45 : (Math.pow(particle.radius, 0.78 + structuralVariant * 0.42) + wave) * side * (0.42 + structuralVariant * 0.055);
    const angle =
      particle.angle +
      (legacyGalaxy ? 0 : (structuralVariant - 0.5) * particle.radius * 1.7) +
      (legacyGalaxy ? decorativeTime * 0.00004 : rotation) * (0.72 + particle.speed * 5.2) +
      Math.sin(decorativeTime * (legacyGalaxy ? 0.0001 : 0.0002) + particle.radius * 8) * 0.018;
    const perspective = legacyGalaxy ? 0.88 + particle.depth * 0.14 : 0.82 + structuralVariant * 0.12 + particle.depth * 0.14;
    const x = centerX + Math.cos(angle) * radius * perspective;
    const y =
      centerY +
      Math.sin(angle) * radius * (legacyGalaxy ? 0.56 + particle.depth * 0.2 : 0.46 + structuralVariant * 0.22 + particle.depth * 0.18);
    const shimmer =
      (0.52 + Math.sin(decorativeTime * 0.00082 + particle.angle * 8.5) * 0.17) *
      (0.62 + particle.depth * 0.48);
    const [red, green, blue] = selectedMode.id === "galaxy"
      ? particle.color
      : hexRgb(selectedMode.colors[particleIndex % selectedMode.colors.length]);
    const particleRadius =
      particle.size * pixelRatio * (0.72 + particle.depth * 1.18);

    if (particle.depth > 0.7) {
      context.beginPath();
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${shimmer * 0.16})`;
      context.arc(x, y, particleRadius * 2.8, 0, Math.PI * 2);
      context.fill();
    }

    context.beginPath();
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${shimmer})`;
    context.arc(x, y, particleRadius, 0, Math.PI * 2);
    context.fill();
  }

  // Payload-derived art identity. It is static across opposite phases, sparse,
  // and chromatically separated from the cyan carrier, so it cancels as common mode.
  const dnaRandom = mulberry32(visualDna.seed ^ 0x56444e41);
  const dnaNodes = Array.from({ length: 9 + visualDna.symmetry }, () => ({
    angle: dnaRandom() * Math.PI * 2,
    radius: side * (0.13 + dnaRandom() * 0.31),
    size: side * (0.0025 + dnaRandom() * 0.004),
  })).sort((left, right) => left.angle - right.angle);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineWidth = Math.max(0.65, side * 0.0011);
  for (let index = 0; index < dnaNodes.length; index += 1) {
    const node = dnaNodes[index];
    const next = dnaNodes[(index + 1 + (visualDna.seed % 3)) % dnaNodes.length];
    const squash = 0.64 + visualDna.chromaShift * 0.16;
    const x = centerX + Math.cos(node.angle + visualDna.orbitBias * 0.22) * node.radius;
    const y = centerY + Math.sin(node.angle) * node.radius * squash;
    const nextX = centerX + Math.cos(next.angle + visualDna.orbitBias * 0.22) * next.radius;
    const nextY = centerY + Math.sin(next.angle) * next.radius * squash;
    const color = DNA_COLORS[index % DNA_COLORS.length];
    context.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},.045)`;
    context.beginPath(); context.moveTo(x, y); context.lineTo(nextX, nextY); context.stroke();
    context.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},.38)`;
    context.beginPath(); context.arc(x, y, node.size, 0, Math.PI * 2); context.fill();
  }
  context.restore();

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

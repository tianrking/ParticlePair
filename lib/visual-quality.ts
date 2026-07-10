import { renderParticleFrame } from "./particle-renderer";
import { ENCODED_BITS } from "./protocol";
import { layoutBits } from "./optical-layout";
import { VISUAL_MODES, type VisualModeId } from "./visual-modes";

export interface VisualQualityMetrics {
  contrast: number;
  coverage: number;
  distinctness: number;
  fingerprint: readonly number[];
  grade: number;
  motion: number;
  vibrancy: number;
}

function renderAnalysisFrame(cells: readonly boolean[], strength: number, mode: VisualModeId, time: number): ImageData {
  const canvas = document.createElement("canvas"); canvas.width = 360; canvas.height = 360;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) throw new Error("Unable to create visual quality canvas");
  renderParticleFrame({ cells, context, height: 360, mode, phase: false, pixelRatio: 1, strength, time, width: 360 });
  return context.getImageData(0, 0, 360, 360);
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * fraction)))] ?? 0;
}

export function analyzeVisualModeQuality(cells: readonly boolean[], strength: number, mode: VisualModeId): VisualQualityMetrics {
  void cells;
  const canonicalCells = layoutBits(Array.from({ length: ENCODED_BITS }, (_, index) => (index * 7 + Math.floor(index / 13) * 3) % 17 < 8));
  const first = renderAnalysisFrame(canonicalCells, strength, mode, 1200);
  const second = renderAnalysisFrame(canonicalCells, strength, mode, 1800);
  const luminances: number[] = [];
  const saturations: number[] = [];
  const hueBins = new Set<number>();
  let motionSum = 0;
  let motionSamples = 0;

  for (let offset = 0; offset < first.data.length; offset += 16) {
    const red = first.data[offset] / 255; const green = first.data[offset + 1] / 255; const blue = first.data[offset + 2] / 255;
    const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue);
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
    luminances.push(luminance);
    if (luminance > 0.055) saturations.push(saturation);
    if (saturation > 0.32 && luminance > 0.075) {
      let hue = 0;
      const delta = maximum - minimum;
      if (delta > 0 && maximum === red) hue = ((green - blue) / delta + 6) % 6;
      else if (delta > 0 && maximum === green) hue = (blue - red) / delta + 2;
      else if (delta > 0) hue = (red - green) / delta + 4;
      hueBins.add(Math.floor((hue / 6) * 18));
    }
    motionSum += Math.abs(first.data[offset] - second.data[offset]) + Math.abs(first.data[offset + 1] - second.data[offset + 1]) + Math.abs(first.data[offset + 2] - second.data[offset + 2]);
    motionSamples += 3;
  }

  luminances.sort((left, right) => left - right);
  saturations.sort((left, right) => left - right);
  const vibrancy = Math.round((saturations.reduce((sum, value) => sum + value, 0) / Math.max(1, saturations.length)) * 100);
  const contrast = Math.round(Math.min(1, (percentile(luminances, 0.96) - percentile(luminances, 0.12)) / 0.42) * 100);
  const coverage = Math.round(Math.min(1, hueBins.size / 9) * 100);
  const rawMotion = motionSum / Math.max(1, motionSamples) / 255;
  const motion = Math.round(Math.min(1, rawMotion / 0.032) * 100);
  const grade = Math.round(vibrancy * 0.34 + contrast * 0.28 + coverage * 0.2 + motion * 0.18);
  const rawFingerprint: number[] = [];
  for (let row = 0; row < 8; row += 1) for (let column = 0; column < 8; column += 1) {
    const x = Math.floor((column + 0.5) * first.width / 8); const y = Math.floor((row + 0.5) * first.height / 8); const offset = (y * first.width + x) * 4;
    rawFingerprint.push(first.data[offset] / 255, first.data[offset + 1] / 255, first.data[offset + 2] / 255, (Math.abs(first.data[offset] - second.data[offset]) + Math.abs(first.data[offset + 1] - second.data[offset + 1]) + Math.abs(first.data[offset + 2] - second.data[offset + 2])) / 765);
  }
  const mean = rawFingerprint.reduce((sum, value) => sum + value, 0) / rawFingerprint.length;
  const deviation = Math.sqrt(rawFingerprint.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rawFingerprint.length) || 1;
  const fingerprint = rawFingerprint.map((value) => (value - mean) / deviation);
  return { contrast, coverage, distinctness: 0, fingerprint, grade, motion, vibrancy };
}

export function scoreVisualDistinctness(grades: Readonly<Record<string, VisualQualityMetrics>>): Record<string, VisualQualityMetrics> {
  const result: Record<string, VisualQualityMetrics> = {};
  for (const mode of VISUAL_MODES) {
    const metric = grades[mode.id]; if (!metric) continue;
    const peers = VISUAL_MODES.filter((candidate) => candidate.kind === mode.kind && candidate.id !== mode.id && grades[candidate.id]);
    const nearest = peers.length ? Math.min(...peers.map((peer) => {
      const other = grades[peer.id].fingerprint; return Math.sqrt(metric.fingerprint.reduce((sum, value, index) => sum + (value - other[index]) ** 2, 0) / metric.fingerprint.length);
    })) : 1;
    result[mode.id] = { ...metric, distinctness: Math.round(Math.min(1, nearest / 0.55) * 100) };
  }
  return result;
}

export function visualAuditPasses(grades: Readonly<Record<string, VisualQualityMetrics>>, minimumGrade = 60, minimumDistinctness = 40): boolean {
  const metrics = Object.values(grades);
  return metrics.length === VISUAL_MODES.length && metrics.every((metric) => metric.grade >= minimumGrade && metric.distinctness >= minimumDistinctness);
}

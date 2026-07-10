export interface Point2D { x: number; y: number }
export interface PerspectiveQuad { bottomLeft: Point2D; bottomRight: Point2D; topLeft: Point2D; topRight: Point2D }
export interface NamedPerspectiveQuad { key: string; quad: PerspectiveQuad }
export type PerspectiveSearchTier = "acquire" | "track" | "lock";
export interface CameraCaptureHealth {
  clippedRatio: number;
  darkRatio: number;
  opponentSpan: number;
  score: number;
  state: "healthy" | "clipped" | "dark" | "flat";
}

interface Homography { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number }

function homographyForQuad({ topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 }: PerspectiveQuad): Homography {
  const dx1 = p1.x - p2.x; const dx2 = p3.x - p2.x; const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y; const dy2 = p3.y - p2.y; const dy3 = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return { a: p1.x - p0.x, b: p3.x - p0.x, c: p0.x, d: p1.y - p0.y, e: p3.y - p0.y, f: p0.y, g: 0, h: 0 };
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-9) throw new Error("Degenerate perspective quadrilateral");
  const g = (dx3 * dy2 - dx2 * dy3) / denominator; const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return { a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x, d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y, g, h };
}

export function projectUnitPoint(quad: PerspectiveQuad, u: number, v: number): Point2D {
  const matrix = homographyForQuad(quad); const denominator = matrix.g * u + matrix.h * v + 1;
  return { x: (matrix.a * u + matrix.b * v + matrix.c) / denominator, y: (matrix.d * u + matrix.e * v + matrix.f) / denominator };
}

function bilinearChannel(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, channel: number): number {
  const boundedX = Math.max(0, Math.min(width - 1, x)); const boundedY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(boundedX); const y0 = Math.floor(boundedY); const x1 = Math.min(width - 1, x0 + 1); const y1 = Math.min(height - 1, y0 + 1);
  const fx = boundedX - x0; const fy = boundedY - y0;
  const at = (px: number, py: number) => data[(py * width + px) * 4 + channel];
  return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
}

export function samplePerspectiveGridWithHealth(data: Uint8ClampedArray, width: number, height: number, quad: PerspectiveQuad, gridSize: number): { health: CameraCaptureHealth; values: number[] } {
  if (data.length !== width * height * 4) throw new Error("RGBA buffer dimensions do not match");
  let clipped = 0; let dark = 0;
  const values = Array.from({ length: gridSize * gridSize }, (_, index) => {
    const row = Math.floor(index / gridSize); const column = index % gridSize;
    const point = projectUnitPoint(quad, (column + 0.5) / gridSize, (row + 0.5) / gridSize);
    const red = bilinearChannel(data, width, height, point.x, point.y, 0);
    const green = bilinearChannel(data, width, height, point.x, point.y, 1);
    const blue = bilinearChannel(data, width, height, point.x, point.y, 2);
    if ([red, green, blue].filter((channel) => channel >= 250).length >= 2) clipped += 1;
    if (Math.max(red, green, blue) <= 10) dark += 1;
    return opticalPixelValue(red, green, blue);
  });
  const sorted = [...values].sort((left, right) => left - right);
  const opponentSpan = sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)];
  const clippedRatio = clipped / values.length; const darkRatio = dark / values.length;
  const score = Math.max(0, Math.min(1, 1 - clippedRatio * 2.4 - Math.max(0, darkRatio - 0.35) * 1.4 - Math.max(0, 28 - opponentSpan) / 28));
  const state: CameraCaptureHealth["state"] = clippedRatio > 0.16 ? "clipped" : darkRatio > 0.58 ? "dark" : opponentSpan < 22 ? "flat" : "healthy";
  return { health: { clippedRatio, darkRatio, opponentSpan, score, state }, values };
}

export function samplePerspectiveGrid(data: Uint8ClampedArray, width: number, height: number, quad: PerspectiveQuad, gridSize: number): number[] {
  return samplePerspectiveGridWithHealth(data, width, height, quad, gridSize).values;
}

export function keystoneQuadCandidates(size: number): NamedPerspectiveQuad[] {
  const last = size - 1; const inset = last * 0.09;
  return [
    { key: "flat", quad: { topLeft: { x: 0, y: 0 }, topRight: { x: last, y: 0 }, bottomRight: { x: last, y: last }, bottomLeft: { x: 0, y: last } } },
    { key: "top-narrow", quad: { topLeft: { x: inset, y: 0 }, topRight: { x: last - inset, y: 0 }, bottomRight: { x: last, y: last }, bottomLeft: { x: 0, y: last } } },
    { key: "bottom-narrow", quad: { topLeft: { x: 0, y: 0 }, topRight: { x: last, y: 0 }, bottomRight: { x: last - inset, y: last }, bottomLeft: { x: inset, y: last } } },
    { key: "left-narrow", quad: { topLeft: { x: 0, y: inset }, topRight: { x: last, y: 0 }, bottomRight: { x: last, y: last }, bottomLeft: { x: 0, y: last - inset } } },
    { key: "right-narrow", quad: { topLeft: { x: 0, y: 0 }, topRight: { x: last, y: inset }, bottomRight: { x: last, y: last - inset }, bottomLeft: { x: 0, y: last } } },
  ];
}

export function perspectiveCandidatesForCrop(cropKey: string, size: number, tier: PerspectiveSearchTier = "acquire"): NamedPerspectiveQuad[] {
  const candidates = keystoneQuadCandidates(size);
  if (tier === "lock") return candidates.slice(0, 1);
  if (tier === "track") return cropKey.endsWith(":0:0") ? candidates : candidates.slice(0, 1);
  return cropKey.endsWith(":0:0") || cropKey.startsWith("1:") ? candidates : candidates.slice(0, 1);
}
import { opticalPixelValue } from "./optical-color";

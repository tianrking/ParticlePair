import { ENCODED_BITS } from "./protocol";
import { GRID_SIZE, isBorderCell } from "./optical-layout";

export interface PayloadConfidenceSummary {
  canDecode: boolean;
  coverage: number;
  maxWeakWindow: number;
  state: "healthy" | "weak" | "occluded";
  weakQuadrants: number;
}

const LOW_CONFIDENCE = 0.32;

export function analyzePayloadConfidence(cellConfidence: readonly number[]): PayloadConfidenceSummary {
  if (cellConfidence.length !== GRID_SIZE * GRID_SIZE) throw new Error("Confidence map must match the optical grid");
  const payload = cellConfidence.map((confidence, index) => ({ confidence, index })).filter(({ index }) => !isBorderCell(index)).slice(0, ENCODED_BITS);
  const weak = new Set(payload.filter(({ confidence }) => confidence < LOW_CONFIDENCE).map(({ index }) => index));
  const coverage = 1 - weak.size / payload.length;
  let maxWeakWindow = 0;
  for (let startRow = 1; startRow <= GRID_SIZE - 5; startRow += 1) for (let startColumn = 1; startColumn <= GRID_SIZE - 5; startColumn += 1) {
    let weakCells = 0;
    for (let row = startRow; row < startRow + 4; row += 1) for (let column = startColumn; column < startColumn + 4; column += 1) if (weak.has(row * GRID_SIZE + column)) weakCells += 1;
    maxWeakWindow = Math.max(maxWeakWindow, weakCells / 16);
  }
  const quadrantWeak = [0, 0, 0, 0]; const quadrantTotal = [0, 0, 0, 0];
  for (const { index } of payload) { const row = Math.floor(index / GRID_SIZE) - 1; const column = index % GRID_SIZE - 1; const quadrant = (row >= 8 ? 2 : 0) + (column >= 8 ? 1 : 0); quadrantTotal[quadrant] += 1; if (weak.has(index)) quadrantWeak[quadrant] += 1; }
  const weakQuadrants = quadrantWeak.filter((count, quadrant) => count / quadrantTotal[quadrant] > 0.35).length;
  const state: PayloadConfidenceSummary["state"] = maxWeakWindow >= 0.625 || weakQuadrants > 0 ? "occluded" : coverage < 0.78 ? "weak" : "healthy";
  return { canDecode: coverage >= 0.72 && maxWeakWindow < 0.75, coverage, maxWeakWindow, state, weakQuadrants };
}

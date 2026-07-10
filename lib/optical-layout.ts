import { ENCODED_BITS } from "./protocol";

export const GRID_SIZE = 18;
export const INTERIOR_SIZE = GRID_SIZE - 2;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const PHASE_DURATION_MS = 300;

export function isBorderCell(index: number): boolean {
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  return row === 0 || column === 0 || row === GRID_SIZE - 1 || column === GRID_SIZE - 1;
}

/** An asymmetric border pattern provides phase and frame synchronization at the expected orientation. */
export function synchronizationBit(index: number): boolean {
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  return ((row * 3 + column * 5 + (row === 0 ? 1 : 0)) % 7) < 3;
}

export function layoutBits(payloadBits: readonly boolean[]): boolean[] {
  if (payloadBits.length !== ENCODED_BITS) {
    throw new Error(`Expected ${ENCODED_BITS} encoded bits`);
  }

  const cells = Array<boolean>(CELL_COUNT).fill(false);
  let payloadIndex = 0;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (isBorderCell(index)) {
      cells[index] = synchronizationBit(index);
      continue;
    }

    cells[index] = payloadIndex < payloadBits.length ? payloadBits[payloadIndex] : payloadIndex % 3 === 0;
    payloadIndex += 1;
  }

  return cells;
}

export function extractPayloadBits(cells: readonly boolean[]): boolean[] {
  if (cells.length !== CELL_COUNT) throw new Error("Invalid optical frame size");
  return cells.filter((_, index) => !isBorderCell(index)).slice(0, ENCODED_BITS);
}

export function syncCorrelation(differences: readonly number[]): number {
  let score = 0;
  let count = 0;

  differences.forEach((difference, index) => {
    if (!isBorderCell(index)) return;
    score += Math.sign(difference) * (synchronizationBit(index) ? 1 : -1);
    count += 1;
  });

  return count === 0 ? 0 : score / count;
}

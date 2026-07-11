export interface ReliabilityCell { passed: boolean; quality: number }
export interface ReliabilitySummary { minimumQuality: number; passed: number; rate: number; total: number }

function xorshift32(seed: number): number {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0;
}

/** Fixed corpus makes browser-to-browser reliability runs directly comparable. */
export function reliabilitySecretCorpus(count = 8): readonly Uint8Array[] {
  let seed = 0x50414952;
  return Array.from({ length: count }, (_, corpusIndex) => Uint8Array.from({ length: 16 }, (_, byteIndex) => { seed = xorshift32(seed ^ Math.imul(corpusIndex + 1, 0x9e3779b1) ^ byteIndex); return seed & 0xff; }));
}

export function summarizeReliability(cells: readonly ReliabilityCell[]): ReliabilitySummary {
  const passed = cells.filter((cell) => cell.passed).length; const total = cells.length;
  return { minimumQuality: total ? Math.min(...cells.map((cell) => cell.quality)) : 0, passed, rate: total ? passed / total : 0, total };
}

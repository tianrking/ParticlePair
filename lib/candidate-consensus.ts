export interface CandidateObservation {
  key: string;
  quality: number;
  transform: string;
}

export interface CandidateConsensusSnapshot {
  confidence: number;
  dominantTransform: string | null;
  geometryStability: number;
  margin: number;
  state: "measuring" | "stable" | "ambiguous";
}

const MIN_SIGNAL_QUALITY = 0.3;

function dominant(values: readonly string[]): { count: number; value: string | null } {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let result: { count: number; value: string | null } = { count: 0, value: null };
  for (const [value, count] of counts) if (count > result.count) result = { count, value };
  return result;
}

/** Cross-frame orientation consensus; adjacent crop movement remains allowed. */
export class CandidateConsensus {
  private winners: CandidateObservation[] = [];
  private current: CandidateConsensusSnapshot = { confidence: 0, dominantTransform: null, geometryStability: 0, margin: 0, state: "measuring" };

  reset(): void { this.winners = []; this.current = { confidence: 0, dominantTransform: null, geometryStability: 0, margin: 0, state: "measuring" }; }

  observe(ranked: readonly CandidateObservation[]): CandidateConsensusSnapshot {
    const best = ranked[0];
    if (!best || best.quality < MIN_SIGNAL_QUALITY) { this.reset(); return this.current; }
    this.winners.push(best); if (this.winners.length > 8) this.winners.shift();
    const transform = dominant(this.winners.map((winner) => winner.transform));
    const geometry = dominant(this.winners.map((winner) => winner.key));
    const confidence = transform.count / this.winners.length;
    const runner = ranked.find((candidate) => candidate.transform !== best.transform);
    const margin = runner ? Math.max(0, best.quality - runner.quality) : 1;
    const state = this.winners.length < 3 ? "measuring" : transform.value === best.transform && confidence >= 2 / 3 && (margin >= 0.035 || confidence >= 0.8) ? "stable" : "ambiguous";
    this.current = { confidence, dominantTransform: transform.value, geometryStability: geometry.count / this.winners.length, margin, state };
    return this.current;
  }

  canDecode(transform: string): boolean { return this.current.state === "stable" && this.current.dominantTransform === transform; }
  snapshot(): CandidateConsensusSnapshot { return this.current; }
}

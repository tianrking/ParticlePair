export interface EvidenceTiming {
  callbackTimeMs: number;
  frameIntervalMs: number;
  mediaTimeSeconds: number;
}

export type EvidenceDecision = { accepted: true; reason: "independent" } | { accepted: false; reason: "duplicate-source" | "too-close" };

/** Reject repeated browser callbacks without requiring reliable mediaTime. */
export class EvidenceDiversityGate {
  private lastCallbackTimeMs: number | null = null;
  private lastMediaTimeSeconds: number | null = null;

  reset(): void { this.lastCallbackTimeMs = null; this.lastMediaTimeSeconds = null; }

  observe({ callbackTimeMs, frameIntervalMs, mediaTimeSeconds }: EvidenceTiming): EvidenceDecision {
    if (mediaTimeSeconds > 0 && this.lastMediaTimeSeconds !== null && Math.abs(mediaTimeSeconds - this.lastMediaTimeSeconds) < 0.0001) return { accepted: false, reason: "duplicate-source" };
    const minimumSpacingMs = Math.max(18, Math.min(55, (frameIntervalMs || 33.3) * 0.72));
    if (this.lastCallbackTimeMs !== null && callbackTimeMs - this.lastCallbackTimeMs < minimumSpacingMs) return { accepted: false, reason: "too-close" };
    this.lastCallbackTimeMs = callbackTimeMs;
    this.lastMediaTimeSeconds = mediaTimeSeconds > 0 ? mediaTimeSeconds : null;
    return { accepted: true, reason: "independent" };
  }
}

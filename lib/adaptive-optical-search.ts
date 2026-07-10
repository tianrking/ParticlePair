export type OpticalSearchTier = "acquire" | "track" | "lock";

export interface OpticalSearchObservation {
  bestKey?: string;
  quality: number;
  sampleDurationMs: number;
}

export interface OpticalSearchDecision {
  changed: boolean;
  tier: OpticalSearchTier;
}

const LOCK_QUALITY = 0.47;
const TRACK_QUALITY = 0.36;
const LOST_QUALITY = 0.27;
const OVER_BUDGET_MS = 24;

/**
 * A small hysteresis controller for the camera hot path. Acquisition keeps the
 * complete geometry search; a stable candidate progressively narrows it. Any
 * real loss of sync expands the search much faster than it contracted.
 */
export class AdaptiveOpticalSearch {
  private currentTier: OpticalSearchTier = "acquire";
  private stableKey = "";
  private stableFrames = 0;
  private lostFrames = 0;
  private overBudgetFrames = 0;

  get tier(): OpticalSearchTier { return this.currentTier; }

  reset(): void {
    this.currentTier = "acquire";
    this.stableKey = "";
    this.stableFrames = 0;
    this.lostFrames = 0;
    this.overBudgetFrames = 0;
  }

  observe({ bestKey = "", quality, sampleDurationMs }: OpticalSearchObservation): OpticalSearchDecision {
    const previous = this.currentTier;
    const stableSignal = quality >= TRACK_QUALITY && Boolean(bestKey);

    if (stableSignal && bestKey === this.stableKey) this.stableFrames += 1;
    else {
      this.stableKey = stableSignal ? bestKey : "";
      this.stableFrames = stableSignal ? 1 : 0;
    }

    this.lostFrames = quality < LOST_QUALITY ? this.lostFrames + 1 : 0;
    this.overBudgetFrames = sampleDurationMs > OVER_BUDGET_MS ? this.overBudgetFrames + 1 : 0;

    if (this.currentTier === "acquire" && (this.stableFrames >= 5 || this.overBudgetFrames >= 5)) {
      this.currentTier = "track";
    } else if (this.currentTier === "track") {
      if (this.lostFrames >= 2) this.currentTier = "acquire";
      else if (quality >= LOCK_QUALITY && this.stableFrames >= 10) this.currentTier = "lock";
    } else if (this.currentTier === "lock" && (quality < TRACK_QUALITY || this.lostFrames >= 1)) {
      this.currentTier = quality < LOST_QUALITY ? "acquire" : "track";
    }

    if (previous !== this.currentTier) {
      this.stableFrames = 0;
      this.lostFrames = 0;
      this.overBudgetFrames = 0;
    }
    return { changed: previous !== this.currentTier, tier: this.currentTier };
  }
}

export function opticalSearchCandidateLabel(tier: OpticalSearchTier): number {
  return tier === "acquire" ? 61 : tier === "track" ? 45 : 25;
}

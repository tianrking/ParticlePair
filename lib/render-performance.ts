export type RenderProfile = "efficient" | "balanced" | "ultra";
export type RenderQualitySetting = "auto" | RenderProfile;

export interface RenderPerformanceSnapshot {
  fps: number | null;
  profile: RenderProfile;
}

/** Frame-cadence governor with asymmetric hysteresis to avoid visible quality flapping. */
export class RenderPerformanceGovernor {
  private lastTimestamp: number | null = null;
  private intervalMs = 1000 / 60;
  private slowFrames = 0;
  private fastFrames = 0;
  private activeProfile: RenderProfile = "balanced";

  get profile(): RenderProfile { return this.activeProfile; }

  reset(profile: RenderProfile = "balanced"): void {
    this.lastTimestamp = null; this.intervalMs = 1000 / 60; this.slowFrames = 0; this.fastFrames = 0; this.activeProfile = profile;
  }

  sample(timestamp: number): RenderPerformanceSnapshot {
    if (this.lastTimestamp === null) { this.lastTimestamp = timestamp; return { fps: null, profile: this.activeProfile }; }
    const delta = timestamp - this.lastTimestamp; this.lastTimestamp = timestamp;
    if (delta < 5 || delta > 250) { this.slowFrames = 0; this.fastFrames = 0; return { fps: Math.round(1000 / this.intervalMs), profile: this.activeProfile }; }
    this.intervalMs = this.intervalMs * 0.86 + delta * 0.14;
    const fps = Math.min(120, Math.round(1000 / this.intervalMs));

    if (this.activeProfile === "ultra") {
      this.slowFrames = fps < 50 ? this.slowFrames + 1 : 0;
      if (this.slowFrames >= 24) this.switchTo("balanced");
    } else if (this.activeProfile === "balanced") {
      this.slowFrames = fps < 38 ? this.slowFrames + 1 : 0;
      this.fastFrames = fps > 57 ? this.fastFrames + 1 : 0;
      if (this.slowFrames >= 18) this.switchTo("efficient");
      else if (this.fastFrames >= 150) this.switchTo("ultra");
    } else {
      this.fastFrames = fps > 50 ? this.fastFrames + 1 : 0;
      if (this.fastFrames >= 120) this.switchTo("balanced");
    }
    return { fps, profile: this.activeProfile };
  }

  private switchTo(profile: RenderProfile): void {
    this.activeProfile = profile; this.slowFrames = 0; this.fastFrames = 0;
  }
}

export function decorativeQualityFor(profile: RenderProfile): number {
  return profile === "ultra" ? 1 : profile === "balanced" ? 0.72 : 0.46;
}

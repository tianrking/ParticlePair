export type ScanLoadState = "normal" | "cooling";

export interface ScanLoadSnapshot {
  processingMs: number;
  state: ScanLoadState;
  utilization: number;
}

/**
 * Thermal/load backpressure with asymmetric hysteresis. Cooling processes every
 * other camera callback; cadence observation still runs on every callback.
 */
export class ScanLoadController {
  private callbackIndex = 0;
  private coolFrames = 0;
  private hotFrames = 0;
  private processingEwma = 0;
  private currentState: ScanLoadState = "normal";

  reset(): void { this.callbackIndex = 0; this.coolFrames = 0; this.hotFrames = 0; this.processingEwma = 0; this.currentState = "normal"; }

  shouldProcess(): boolean {
    this.callbackIndex += 1;
    return this.currentState === "normal" || this.callbackIndex % 2 === 1;
  }

  observe(processingMs: number, frameIntervalMs: number): ScanLoadSnapshot {
    this.processingEwma = this.processingEwma === 0 ? processingMs : this.processingEwma * 0.76 + processingMs * 0.24;
    const interval = frameIntervalMs > 0 ? frameIntervalMs : 33.3;
    const effectiveInterval = interval * (this.currentState === "cooling" ? 2 : 1);
    const utilization = this.processingEwma / effectiveInterval;
    const hot = this.processingEwma > 28 || utilization > 0.72;
    const cool = this.processingEwma < 28 && utilization < 0.48;
    this.hotFrames = hot ? this.hotFrames + 1 : 0;
    this.coolFrames = cool ? this.coolFrames + 1 : 0;

    if (this.currentState === "normal" && this.hotFrames >= 4) {
      this.currentState = "cooling"; this.hotFrames = 0; this.coolFrames = 0;
    } else if (this.currentState === "cooling" && this.coolFrames >= 8) {
      this.currentState = "normal"; this.hotFrames = 0; this.coolFrames = 0;
    }
    return this.snapshot(interval);
  }

  snapshot(frameIntervalMs = 33.3): ScanLoadSnapshot {
    const dutyInterval = frameIntervalMs * (this.currentState === "cooling" ? 2 : 1);
    return { processingMs: this.processingEwma, state: this.currentState, utilization: Math.max(0, this.processingEwma / dutyInterval) };
  }
}

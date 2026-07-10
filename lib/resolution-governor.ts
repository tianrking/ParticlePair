import type { ScanLoadSnapshot } from "./scan-load";

export type CaptureResolutionProfile = "hd" | "eco";

interface NumericCapability { max?: number; min?: number }
interface ResolutionCapabilities { height?: NumericCapability; width?: NumericCapability }

const TARGETS: Record<CaptureResolutionProfile, { height: number; width: number }> = { hd: { height: 720, width: 1280 }, eco: { height: 360, width: 640 } };

function clampToCapability(value: number, capability?: NumericCapability): number {
  return Math.max(capability?.min ?? value, Math.min(capability?.max ?? value, value));
}

export function resolutionConstraints(profile: CaptureResolutionProfile, capabilities: ResolutionCapabilities = {}): MediaTrackConstraints {
  const target = TARGETS[profile];
  return { width: { ideal: clampToCapability(target.width, capabilities.width) }, height: { ideal: clampToCapability(target.height, capabilities.height) } };
}

export function resolutionProfileFromWidth(width?: number): CaptureResolutionProfile { return (width ?? 1280) >= 1000 ? "hd" : "eco"; }

/** Slow asymmetric governor: six hot observations down, twenty cool observations up. */
export class ResolutionGovernor {
  private cool = 0; private disabled = false; private hot = 0; private profile: CaptureResolutionProfile = "hd";
  reset(profile: CaptureResolutionProfile): void { this.profile = profile; this.cool = 0; this.hot = 0; this.disabled = false; }
  disable(): void { this.disabled = true; this.cool = 0; this.hot = 0; }
  confirm(profile: CaptureResolutionProfile): void { this.profile = profile; this.cool = 0; this.hot = 0; }
  current(): CaptureResolutionProfile { return this.profile; }

  observe(load: ScanLoadSnapshot): CaptureResolutionProfile | null {
    if (this.disabled) return null;
    const isHot = load.state === "cooling" || load.utilization > 0.72;
    const isCool = load.state === "normal" && load.utilization < 0.42;
    this.hot = isHot ? this.hot + 1 : 0; this.cool = isCool ? this.cool + 1 : 0;
    if (this.profile === "hd" && this.hot >= 6) { this.hot = 0; this.cool = 0; return "eco"; }
    if (this.profile === "eco" && this.cool >= 20) { this.hot = 0; this.cool = 0; return "hd"; }
    return null;
  }
}

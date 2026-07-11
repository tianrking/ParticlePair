import type { CameraChannelProfile } from "./rendered-pixel-loopback";

export const SIGNAL_STRENGTH_CANDIDATES = [0.25, 0.32, 0.4, 0.5, 0.62, 0.76, 0.9] as const;
export const SIGNAL_QUALITY_FLOOR = 0.47;

export interface SignalArchitectureObservation {
  passed: boolean;
  profile: CameraChannelProfile;
  quality: number;
  strength: number;
}

export interface SignalArchitecture {
  floor: number;
  margin: number;
  minimumQuality: number;
  operatingStrength: number;
}

/** Selects the quietest strength that clears every channel, then adds a bounded safety margin. */
export function selectSignalArchitecture(observations: readonly SignalArchitectureObservation[], profiles: readonly CameraChannelProfile[]): SignalArchitecture | null {
  for (const strength of SIGNAL_STRENGTH_CANDIDATES) {
    const cells = observations.filter((observation) => observation.strength === strength);
    if (cells.length !== profiles.length || profiles.some((profile) => !cells.some((cell) => cell.profile === profile))) continue;
    const minimumQuality = Math.min(...cells.map((cell) => cell.quality));
    if (cells.every((cell) => cell.passed) && minimumQuality >= SIGNAL_QUALITY_FLOOR) {
      const operatingStrength = Math.min(1, Number((strength + 0.08).toFixed(2)));
      return { floor: strength, margin: Number((operatingStrength - strength).toFixed(2)), minimumQuality: Number(minimumQuality.toFixed(4)), operatingStrength };
    }
  }
  return null;
}

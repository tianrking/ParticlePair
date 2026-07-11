import type { ConfidenceAuroraSnapshot } from "./confidence-aurora";
import type { OpticalQuadrant } from "./optical-decoder";

export interface ReceiverGuidance { action: string; detail: string }

export function receiverGuidance(aurora: ConfidenceAuroraSnapshot, occlusion: OpticalQuadrant | null): ReceiverGuidance {
  if (aurora.state === "idle") return { action: "START CAMERA", detail: "Point this device at the complete optical square." };
  if (occlusion) return { action: `CLEAR ${occlusion.toUpperCase()}`, detail: "Move fingers or reflections away from the highlighted corner." };
  if (aurora.state === "ready") return { action: "EVIDENCE CONVERGED", detail: "Hold position while integrity verification completes." };
  if (aurora.bottleneck === "capture") return { action: "IMPROVE EXPOSURE", detail: "Reduce glare, avoid backlight, and tap the screen to focus." };
  if (aurora.bottleneck === "sync") return { action: "CENTER THE SQUARE", detail: "Fit all four luminous corners inside the guide." };
  if (aurora.bottleneck === "geometry") return { action: "HOLD PARALLEL", detail: "Reduce tilt and keep both devices steady." };
  if (aurora.bottleneck === "evidence") return { action: "HOLD STILL", detail: "Independent opposite-phase frames are still accumulating." };
  return { action: "IMPROVE VISIBILITY", detail: "Move slightly closer and keep the complete payload visible." };
}

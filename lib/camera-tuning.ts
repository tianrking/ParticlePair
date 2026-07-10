export type CameraTuningFeature = "focus" | "exposure" | "white-balance";

export interface CameraTuningResult {
  applied: CameraTuningFeature[];
  attempted: CameraTuningFeature[];
  failed: CameraTuningFeature[];
  status: "native" | "tuned" | "partial";
}

interface ExtendedCapabilities {
  exposureMode?: readonly string[];
  focusMode?: readonly string[];
  whiteBalanceMode?: readonly string[];
}

interface CapabilityTrack {
  applyConstraints(constraints: MediaTrackConstraints): Promise<void>;
  getCapabilities?: () => MediaTrackCapabilities;
}

export interface CameraConstraintStep { constraint: Record<string, string>; feature: CameraTuningFeature }

export function cameraConstraintPlan(capabilities: ExtendedCapabilities): CameraConstraintStep[] {
  const plan: CameraConstraintStep[] = [];
  if (capabilities.focusMode?.includes("continuous")) plan.push({ constraint: { focusMode: "continuous" }, feature: "focus" });
  if (capabilities.exposureMode?.includes("continuous")) plan.push({ constraint: { exposureMode: "continuous" }, feature: "exposure" });
  if (capabilities.whiteBalanceMode?.includes("continuous")) plan.push({ constraint: { whiteBalanceMode: "continuous" }, feature: "white-balance" });
  return plan;
}

/** Apply each non-standard camera enhancement independently and fail open. */
export async function tuneCameraTrack(track: CapabilityTrack): Promise<CameraTuningResult> {
  let capabilities: ExtendedCapabilities = {};
  try { capabilities = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities; } catch { return { applied: [], attempted: [], failed: [], status: "native" }; }
  const plan = cameraConstraintPlan(capabilities); const applied: CameraTuningFeature[] = []; const failed: CameraTuningFeature[] = [];
  for (const step of plan) {
    try { await track.applyConstraints({ advanced: [step.constraint] } as MediaTrackConstraints); applied.push(step.feature); }
    catch { failed.push(step.feature); }
  }
  return { applied, attempted: plan.map((step) => step.feature), failed, status: !plan.length ? "native" : failed.length ? "partial" : "tuned" };
}

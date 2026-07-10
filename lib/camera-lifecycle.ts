export type CameraLifecycleState = "idle" | "running" | "suspended" | "ended";
export type CameraLifecycleEvent = "start" | "suspend" | "resume" | "end" | "stop";

/** Deterministic guard against illegal camera resume/reuse transitions. */
export class CameraLifecycle {
  private current: CameraLifecycleState = "idle";
  get state(): CameraLifecycleState { return this.current; }

  transition(event: CameraLifecycleEvent): CameraLifecycleState {
    if (event === "stop") this.current = "idle";
    else if (event === "end") this.current = "ended";
    else if (event === "start" && (this.current === "idle" || this.current === "ended")) this.current = "running";
    else if (event === "suspend" && this.current === "running") this.current = "suspended";
    else if (event === "resume" && this.current === "suspended") this.current = "running";
    return this.current;
  }
}

export function canResumeCameraTrack(visibility: DocumentVisibilityState, readyState: MediaStreamTrackState, muted: boolean): boolean {
  return visibility === "visible" && readyState === "live" && !muted;
}

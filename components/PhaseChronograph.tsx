"use client";

import { useEffect, useRef } from "react";
import { opticalPhaseSnapshot } from "../lib/optical-clock";

export function PhaseChronograph({ compact = false, paused = false }: { compact?: boolean; paused?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null); const phaseRef = useRef<HTMLElement>(null); const remainingRef = useRef<HTMLElement>(null);
  const frozenTimeRef = useRef(0);
  useEffect(() => {
    let frame = 0; let previousPhase = "";
    const update = (timestamp: number) => {
      const time = paused ? frozenTimeRef.current : timestamp;
      if (!paused) frozenTimeRef.current = timestamp;
      const snapshot = opticalPhaseSnapshot(time); const root = rootRef.current;
      if (root) { root.style.setProperty("--phase-progress", snapshot.progress.toFixed(4)); root.setAttribute("aria-label", `Optical phase ${snapshot.phase}, ${Math.ceil(snapshot.remainingMs)} milliseconds remaining`); }
      if (snapshot.phase !== previousPhase && phaseRef.current) { phaseRef.current.textContent = snapshot.phase; previousPhase = snapshot.phase; }
      if (remainingRef.current) remainingRef.current.textContent = `${Math.ceil(snapshot.remainingMs / 10) * 10} MS`;
      if (!paused) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [paused]);
  return <div ref={rootRef} className={`phase-chronograph${compact ? " compact" : ""}`} role="timer"><i><b /></i><span>PHASE <strong ref={phaseRef}>A</strong></span><em ref={remainingRef}>300 MS</em></div>;
}

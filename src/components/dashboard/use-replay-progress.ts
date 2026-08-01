"use client";

import { useEffect, useState } from "react";

/**
 * Drive a step-by-step replay: returns the index of the last step to show, walking 0..stepCount-1 over
 * ~1.6s (clamped per-step so a long trace never crawls and a short one is still watchable). It restarts
 * whenever `runId` changes, so pressing Run again replays even if the trace is identical. A trace with
 * 0 or 1 steps shows fully at once.
 */
export function useReplayProgress(stepCount: number, runId: number): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (stepCount <= 1) {
      setIndex(Math.max(0, stepCount - 1));
      return;
    }
    setIndex(0);
    const perStep = Math.max(60, Math.min(400, 1600 / stepCount));
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setIndex(current);
      if (current >= stepCount - 1) clearInterval(timer);
    }, perStep);
    return () => clearInterval(timer);
  }, [stepCount, runId]);
  return index;
}

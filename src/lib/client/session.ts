"use client";
import { useSyncExternalStore } from "react";
import type { CaptureIssue, SourceState } from "./capture";

export type SessionKind = "none" | "live" | "sample";
export type SamplePhase = "idle" | "loading" | "ready" | "playing" | "paused" | "done";

export interface SessionState {
  kind: SessionKind;
  meetingId: string | null;
  /** performance/Date anchor: elapsed = (now - startedAt) */
  startedAt: number;
  interim: { t: number; text: string; speaker?: "you" | "them"; label?: string } | null;
  sources: { mic: SourceState; tab: SourceState; micMode: "speech" | "chunks" | null };
  issues: CaptureIssue[];
  sample: {
    phase: SamplePhase;
    positionMs: number;
    userTookOver: boolean;
    blocked: boolean;
  };
}

const initial: SessionState = {
  kind: "none",
  meetingId: null,
  startedAt: 0,
  interim: null,
  sources: { mic: "off", tab: "off", micMode: null },
  issues: [],
  sample: { phase: "idle", positionMs: 0, userTookOver: false, blocked: false },
};

let state: SessionState = initial;
const listeners = new Set<() => void>();

export function getSession() {
  return state;
}

export function setSession(patch: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function resetSession() {
  state = initial;
  listeners.forEach((l) => l());
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => initial,
  );
}

/* Audio level lives in its own tiny store so the waveform can update at 20fps
   without re-rendering the whole workspace. */
let level = 0;
const levelListeners = new Set<() => void>();
export function setLevel(l: number) {
  level = l;
  levelListeners.forEach((f) => f());
}
export function useLevel(): number {
  return useSyncExternalStore(
    (cb) => {
      levelListeners.add(cb);
      return () => levelListeners.delete(cb);
    },
    () => level,
    () => 0,
  );
}

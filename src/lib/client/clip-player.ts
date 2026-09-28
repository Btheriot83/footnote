"use client";
import { useSyncExternalStore } from "react";
import { SAMPLE_AUDIO_URL, SAMPLE_DURATION_MS, SAMPLE_SEGMENTS } from "../sample";
import type { Meeting } from "../types";
import { setLevel } from "./session";

/**
 * Receipts you can hear. For meetings with a recording (today: the sample call),
 * clicking a footnote plays exactly the cited moment, and "Listen" replays the call
 * with the transcript following along.
 */
export interface ClipState {
  /** Segment being played on its own, or null while replaying the whole call. */
  segmentId: string | null;
  meetingId: string | null;
  playing: boolean;
  positionMs: number;
  fromMs: number;
  toMs: number;
}

const idle: ClipState = { segmentId: null, meetingId: null, playing: false, positionMs: 0, fromMs: 0, toMs: 0 };
let state: ClipState = idle;
let audio: HTMLAudioElement | null = null;
let raf = 0;
const listeners = new Set<() => void>();

function set(patch: Partial<ClipState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SAMPLE_AUDIO_URL);
    audio.preload = "auto";
  }
  return audio;
}

const sampleById = new Map(SAMPLE_SEGMENTS.map((s) => [s.id, s]));

/** True when this meeting's transcript lines map onto the bundled sample recording. */
export function hasRecording(m: Pick<Meeting, "isSample" | "segments"> | null | undefined): boolean {
  if (!m?.isSample || m.segments.length === 0) return false;
  return m.segments.every((s) => sampleById.get(s.id)?.text === s.text);
}

/** Where each line ends, for following along. */
export function segmentAt(ms: number): string | null {
  return SAMPLE_SEGMENTS.find((s) => s.t - 150 <= ms && ms < s.end + 250)?.id ?? null;
}

function tick() {
  const a = audio;
  if (!a) return;
  const pos = a.currentTime * 1000;
  if (pos >= state.toMs || a.ended) {
    stopClip();
    return;
  }
  set({ positionMs: pos });
  // Drive the header waveform while the call is replaying.
  if (!state.segmentId) setLevel(segmentAt(pos) ? 0.25 + Math.random() * 0.6 : 0.05);
  raf = requestAnimationFrame(tick);
}

async function playRange(meetingId: string, segmentId: string | null, fromMs: number, toMs: number) {
  const a = el();
  cancelAnimationFrame(raf);
  a.pause();
  a.currentTime = Math.max(0, fromMs / 1000);
  set({ meetingId, segmentId, fromMs, toMs, positionMs: fromMs, playing: true });
  try {
    await a.play();
    raf = requestAnimationFrame(tick);
  } catch {
    set({ playing: false });
  }
}

/** Plays one cited line. Clicking the same line again stops it. */
export function playSegment(meetingId: string, segmentId: string) {
  const seg = sampleById.get(segmentId);
  if (!seg) return;
  if (state.playing && state.segmentId === segmentId) {
    stopClip();
    return;
  }
  void playRange(meetingId, segmentId, Math.max(0, seg.t - 120), seg.end + 200);
}

/** Replays the whole call from `fromMs` (the transcript follows along). */
export function playCall(meetingId: string, fromMs = 0) {
  void playRange(meetingId, null, fromMs, SAMPLE_DURATION_MS + 500);
}

export function stopClip() {
  cancelAnimationFrame(raf);
  audio?.pause();
  if (state.playing || state.segmentId) {
    setLevel(0);
    set({ ...idle });
  }
}

export function useClip(): ClipState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => idle,
  );
}

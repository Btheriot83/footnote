"use client";
import { useSyncExternalStore } from "react";
import { SAMPLE_AUDIO_URL, SAMPLE_DURATION_MS, SAMPLE_SEGMENTS } from "../sample";
import type { Meeting, Segment } from "../types";
import { loadRecordings, type LoadedRecording } from "./local-audio";
import { setLevel } from "./session";

/**
 * Receipts you can hear. Clicking a footnote plays exactly the cited moment, and
 * "Listen" replays the call with the transcript following along. Works for the
 * bundled sample call and for meetings whose audio was kept on this device.
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

export interface Span {
  id: string;
  t: number;
  end: number;
}

type PlayableMeeting = Pick<Meeting, "id" | "isSample" | "segments" | "hasAudio" | "durationMs">;

const idle: ClipState = { segmentId: null, meetingId: null, playing: false, positionMs: 0, fromMs: 0, toMs: 0 };
let state: ClipState = idle;
let audio: HTMLAudioElement | null = null;
let raf = 0;
let token = 0;
let spans: Span[] = [];
/** Where the current audio element's zero sits on the meeting clock. */
let baseMs = 0;
let loaded: { meetingId: string; recs: LoadedRecording[] } | null = null;
let recIndex = -1;
const listeners = new Set<() => void>();

function set(patch: Partial<ClipState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
  }
  return audio;
}

const sampleById = new Map(SAMPLE_SEGMENTS.map((s) => [s.id, s]));

function isSampleRecording(m: Pick<Meeting, "isSample" | "segments"> | null | undefined): boolean {
  if (!m?.isSample || m.segments.length === 0) return false;
  return m.segments.every((s) => sampleById.get(s.id)?.text === s.text);
}

/** True when this meeting has audio behind its transcript lines. */
export function hasRecording(m: Pick<Meeting, "isSample" | "segments" | "hasAudio"> | null | undefined): boolean {
  return isSampleRecording(m) || (!!m?.hasAudio && m.segments.length > 0);
}

/** When each line starts and (roughly) ends on the meeting clock. */
export function spansFor(m: Pick<Meeting, "isSample" | "segments">): Span[] {
  if (isSampleRecording(m)) return SAMPLE_SEGMENTS.map(({ id, t, end }) => ({ id, t, end }));
  const sorted = [...m.segments].sort((a, b) => a.t - b.t);
  return sorted.map((s: Segment, i) => {
    const words = s.text.split(/\s+/).length;
    let end = s.t + Math.max(2500, words * 380 + 800);
    const next = sorted[i + 1];
    if (next && next.t > s.t + 1500) end = Math.min(end, next.t + 250);
    return { id: s.id, t: s.t, end };
  });
}

export function segmentAt(list: Span[], ms: number): string | null {
  let hit: string | null = null;
  for (const s of list) if (s.t - 150 <= ms && ms < s.end + 250) hit = s.id;
  return hit;
}

function tick() {
  const a = audio;
  if (!a) return;
  const pos = baseMs + a.currentTime * 1000;
  if (pos >= state.toMs) {
    stopClip();
    return;
  }
  set({ positionMs: pos });
  // Drive the header waveform while the call is replaying.
  if (!state.segmentId) setLevel(segmentAt(spans, pos) ? 0.25 + Math.random() * 0.6 : 0.05);
  raf = requestAnimationFrame(tick);
}

function waitForMetadata(a: HTMLAudioElement): Promise<void> {
  if (a.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ok = () => (cleanup(), resolve());
    const fail = () => (cleanup(), reject(new Error("audio")));
    const cleanup = () => {
      a.removeEventListener("loadedmetadata", ok);
      a.removeEventListener("error", fail);
    };
    a.addEventListener("loadedmetadata", ok);
    a.addEventListener("error", fail);
  });
}

async function recordingsFor(meetingId: string): Promise<LoadedRecording[]> {
  if (loaded?.meetingId === meetingId) return loaded.recs;
  releaseRecordings();
  const recs = await loadRecordings(meetingId);
  loaded = { meetingId, recs };
  return recs;
}

/** Frees the object URLs of a meeting's audio (when leaving it). */
export function releaseRecordings() {
  loaded?.recs.forEach((r) => URL.revokeObjectURL(r.url));
  loaded = null;
  recIndex = -1;
}

async function load(src: string, base: number) {
  const a = el();
  if (a.src !== src && !(src.startsWith("/") && a.src.endsWith(src))) {
    a.src = src;
    a.load();
  }
  baseMs = base;
  await waitForMetadata(a);
}

async function playRange(m: PlayableMeeting, segmentId: string | null, fromMs: number, toMs: number) {
  const my = ++token;
  const a = el();
  cancelAnimationFrame(raf);
  a.pause();
  spans = spansFor(m);
  set({ meetingId: m.id, segmentId, fromMs, toMs, positionMs: fromMs, playing: true });
  try {
    if (isSampleRecording(m)) {
      await load(SAMPLE_AUDIO_URL, 0);
    } else {
      const recs = await recordingsFor(m.id);
      if (!recs.length) throw new Error("no audio");
      let i = 0;
      recs.forEach((r, k) => r.offsetMs <= fromMs && (i = k));
      recIndex = i;
      await load(recs[i].url, recs[i].offsetMs);
    }
    if (my !== token) return;
    a.currentTime = Math.max(0, (fromMs - baseMs) / 1000);
    await a.play();
    if (my !== token) return;
    raf = requestAnimationFrame(tick);
  } catch {
    if (my === token) set({ ...idle });
  }
}

if (typeof window !== "undefined") {
  // A resumed meeting has several recordings: roll on to the next one during a replay.
  queueMicrotask(() =>
    el().addEventListener("ended", () => {
      const next = loaded?.recs[recIndex + 1];
      if (state.playing && !state.segmentId && next && loaded?.meetingId === state.meetingId) {
        recIndex += 1;
        void load(next.url, next.offsetMs).then(() => el().play().catch(() => stopClip()));
      } else if (state.playing) {
        stopClip();
      }
    }),
  );
}

/** Plays one cited line. Clicking the same line again stops it. */
export function playSegment(m: PlayableMeeting, segmentId: string) {
  const span = spansFor(m).find((s) => s.id === segmentId);
  if (!span) return;
  if (state.playing && state.segmentId === segmentId) {
    stopClip();
    return;
  }
  void playRange(m, segmentId, Math.max(0, span.t - 150), span.end + 200);
}

/** Replays the whole call from `fromMs` (the transcript follows along). */
export function playCall(m: PlayableMeeting, fromMs = 0) {
  const end = isSampleRecording(m) ? SAMPLE_DURATION_MS : Math.max(m.durationMs, ...spansFor(m).map((s) => s.end));
  void playRange(m, null, fromMs, end + 500);
}

export function stopClip() {
  token++;
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

"use client";
import {
  SAMPLE_AUDIO_URL,
  SAMPLE_DURATION_MS,
  SAMPLE_SEGMENTS,
  SAMPLE_TEMPLATE,
  SAMPLE_TITLE,
  sampleNotesAt,
} from "../sample";
import { getSession, setLevel, setSession } from "./session";
import { getMeeting, patchMeetingState } from "./store";

/**
 * Plays the staged sample call and reveals the transcript and "typed" notes in
 * sync with the audio, exactly like a live meeting (without any API calls).
 */
let audio: HTMLAudioElement | null = null;
let raf = 0;
let typed = "";
let lastFrame = 0;
let lastPositionEmit = 0;
let lastLevelEmit = 0;
let meetingId: string | null = null;

const TYPE_CPS = 42;

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SAMPLE_AUDIO_URL);
    audio.preload = "auto";
    audio.addEventListener("ended", () => finishSample());
  }
  return audio;
}

export function preloadSample() {
  ensureAudio().load();
}

export async function startSample(id: string) {
  stopSampleAudio();
  meetingId = id;
  typed = "";
  const el = ensureAudio();
  el.currentTime = 0;
  patchMeetingState(
    id,
    {
      title: SAMPLE_TITLE,
      template: SAMPLE_TEMPLATE,
      segments: [],
      notes: "",
      enhanced: null,
      enhancedSource: undefined,
      status: "live",
      durationMs: 0,
      createdAt: Date.now(),
      isSample: true,
    },
    { immediate: true },
  );
  setSession({
    kind: "sample",
    meetingId: id,
    startedAt: 0,
    interim: null,
    issues: [],
    sample: { phase: "loading", positionMs: 0, userTookOver: false, blocked: false },
  });
  await playSample();
}

export async function playSample() {
  const el = ensureAudio();
  const s = getSession();
  if (s.kind !== "sample") return;
  try {
    await el.play();
    setSession((st) => ({ sample: { ...st.sample, phase: "playing", blocked: false } }));
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  } catch {
    // Autoplay was blocked: wait for a click on "Play".
    setSession((st) => ({ sample: { ...st.sample, phase: "ready", blocked: true } }));
  }
}

export function pauseSample() {
  audio?.pause();
  cancelAnimationFrame(raf);
  setLevel(0);
  setSession((st) => ({ sample: { ...st.sample, phase: "paused" } }));
}

export function seekSample(ms: number) {
  const el = ensureAudio();
  el.currentTime = Math.max(0, ms / 1000);
  apply(ms, 0);
}

export function markSampleTyping() {
  const s = getSession();
  if (s.kind === "sample" && !s.sample.userTookOver && s.sample.phase !== "done") {
    setSession({ sample: { ...s.sample, userTookOver: true } });
  }
}

export function skipSampleToEnd() {
  audio?.pause();
  finishSample();
}

function tick(now: number) {
  if (!audio || audio.paused) return;
  const dt = now - lastFrame;
  lastFrame = now;
  apply(audio.currentTime * 1000, dt);
  raf = requestAnimationFrame(tick);
}

function apply(ms: number, dtMs: number, instantNotes = false) {
  if (!meetingId) return;
  const m = getMeeting(meetingId);
  if (!m) return;
  const session = getSession();

  const finals = SAMPLE_SEGMENTS.filter((s) => s.end <= ms);
  if (finals.length !== m.segments.length) {
    patchMeetingState(meetingId, {
      segments: finals.map(({ id, speaker, label, t, text }) => ({ id, speaker, label, t, text })),
      durationMs: Math.min(ms, SAMPLE_DURATION_MS),
    });
  }

  const current = SAMPLE_SEGMENTS.find((s) => s.t <= ms && ms < s.end);
  if (current) {
    const words = current.text.split(" ");
    const progress = (ms - current.t) / (current.end - current.t);
    const shown = words.slice(0, Math.max(1, Math.ceil(words.length * Math.min(1, progress * 1.08)))).join(" ");
    if (session.interim?.text !== shown) {
      setSession({ interim: { t: current.t, text: shown, speaker: current.speaker, label: current.label } });
    }
  } else if (session.interim) {
    setSession({ interim: null });
  }

  const now = performance.now();
  if (now - lastLevelEmit > 60) {
    setLevel(current ? 0.25 + Math.random() * 0.6 : 0.04 + Math.random() * 0.04);
    lastLevelEmit = now;
  }

  if (!session.sample.userTookOver) {
    const desired = sampleNotesAt(ms);
    if (!desired.startsWith(typed)) typed = desired;
    if (typed.length < desired.length) {
      const add = instantNotes ? desired.length : Math.max(1, Math.round((dtMs / 1000) * TYPE_CPS));
      typed = desired.slice(0, typed.length + add);
      patchMeetingState(meetingId, { notes: typed });
    }
  }

  if (now - lastPositionEmit > 250) {
    setSession((st) => ({ sample: { ...st.sample, positionMs: ms } }));
    lastPositionEmit = now;
  }
}

export function finishSample() {
  cancelAnimationFrame(raf);
  if (!meetingId) return;
  apply(SAMPLE_DURATION_MS + 1, 0, true);
  setLevel(0);
  patchMeetingState(meetingId, { status: "ended", durationMs: SAMPLE_DURATION_MS }, { immediate: true });
  setSession((st) => ({
    interim: null,
    sample: { ...st.sample, phase: "done", positionMs: SAMPLE_DURATION_MS },
  }));
}

/** Stop audio without touching the meeting (used when leaving the sample). */
export function stopSampleAudio() {
  cancelAnimationFrame(raf);
  if (audio && !audio.paused) audio.pause();
  setLevel(0);
}

export function samplePosition(): number {
  return audio ? audio.currentTime * 1000 : 0;
}

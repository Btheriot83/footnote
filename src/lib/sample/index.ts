import notes from "./notes.json";
import transcript from "./transcript.json";
import cached from "./cached-enhancement.json";
import type { EnhancedNotes } from "../types";
import type { Segment } from "../types";

export const SAMPLE_AUDIO_URL = "/sample/acme-renewal.mp3";
export const SAMPLE_TITLE = transcript.title;
export const SAMPLE_DURATION_MS = transcript.durationMs;
export const SAMPLE_TEMPLATE = "sales" as const;

export type SampleSegment = Segment & { end: number };

export const SAMPLE_SEGMENTS: SampleSegment[] = transcript.segments.map((s) => ({
  id: s.id,
  speaker: s.speaker as Segment["speaker"],
  label: s.label,
  t: s.t,
  end: s.end,
  text: s.text,
}));

/**
 * Rough notes "typed" during playback, like a real person half-listening.
 * `after` is the segment id whose end triggers the line.
 */
export const SAMPLE_NOTE_SCRIPT: { after: string | null; text: string }[] = notes;

export const SAMPLE_DEFAULT_NOTES = SAMPLE_NOTE_SCRIPT.map((l) => l.text).join("\n");

/** Notes that should be visible at playback time `ms`. */
export function sampleNotesAt(ms: number): string {
  const ends = new Map(SAMPLE_SEGMENTS.map((s) => [s.id, s.end]));
  return SAMPLE_NOTE_SCRIPT.filter((l) => l.after === null || (ends.get(l.after) ?? Infinity) + 900 <= ms)
    .map((l) => l.text)
    .join("\n");
}

export function normalizeNotes(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Pre-computed enhancement of the default notes, used when no key is available. */
export const SAMPLE_CACHED_ENHANCEMENT = cached as EnhancedNotes;

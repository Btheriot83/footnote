"use client";
import Dexie, { type EntityTable } from "dexie";
import type { Meeting } from "./types";

/** One continuous stretch of recorded audio (a meeting that was resumed has several). */
export interface Recording {
  id: string;
  meetingId: string;
  /** Where this recording starts on the meeting's clock (ms). */
  offsetMs: number;
  mime: string;
  createdAt: number;
}

/** Audio arrives in small pieces so a closed tab loses seconds, not the meeting. */
export interface RecordingChunk {
  id?: number;
  recordingId: string;
  meetingId: string;
  seq: number;
  blob: Blob;
}

class FootnoteDB extends Dexie {
  meetings!: EntityTable<Meeting, "id">;
  recordings!: EntityTable<Recording, "id">;
  recordingChunks!: EntityTable<RecordingChunk, "id">;
  constructor() {
    super("footnote");
    this.version(1).stores({
      meetings: "id, createdAt, updatedAt, isSample",
    });
    this.version(2).stores({
      meetings: "id, createdAt, updatedAt, isSample",
      recordings: "id, meetingId",
      recordingChunks: "++id, recordingId, meetingId, [recordingId+seq]",
    });
  }
}

export const db = new FootnoteDB();

export async function saveMeeting(m: Meeting) {
  await db.meetings.put({ ...m, updatedAt: Date.now() });
}

export async function patchMeeting(id: string, patch: Partial<Meeting>) {
  await db.meetings.update(id, { ...patch, updatedAt: Date.now() });
}

export function matchesQuery(m: Meeting, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (m.title.toLowerCase().includes(needle)) return true;
  if (m.notes.toLowerCase().includes(needle)) return true;
  if (m.segments.some((s) => s.text.toLowerCase().includes(needle))) return true;
  if (m.enhanced?.sections.some((s) => s.bullets.some((b) => b.text.toLowerCase().includes(needle)))) return true;
  return false;
}

/** Where the query matched, for the search result snippet. */
export function matchSnippet(m: Meeting, q: string): string | null {
  const needle = q.trim().toLowerCase();
  if (!needle || m.title.toLowerCase().includes(needle)) return null;
  const sources = [m.notes, ...m.segments.map((s) => s.text)];
  for (const src of sources) {
    const i = src.toLowerCase().indexOf(needle);
    if (i >= 0) {
      const start = Math.max(0, i - 24);
      return (start > 0 ? "…" : "") + src.slice(start, i + needle.length + 40).replace(/\s+/g, " ") + "…";
    }
  }
  return null;
}

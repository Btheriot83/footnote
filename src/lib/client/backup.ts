"use client";
import { db } from "../db";
import type { Meeting } from "../types";
import { getMeeting, loadMeeting, patchMeetingState } from "./store";

/**
 * Back up and restore: every meeting (notes, transcript, enhanced notes) in one JSON file,
 * optionally with the audio kept on this device. Restoring merges: a meeting already here
 * is only replaced by a newer copy of itself.
 */

interface BackupAudio {
  id: string;
  meetingId: string;
  offsetMs: number;
  mime: string;
  createdAt: number;
  /** data: URL of the whole recording. */
  data: string;
}

export interface Backup {
  app: "footnote";
  version: 1;
  exportedAt: number;
  meetings: Meeting[];
  audio?: BackupAudio[];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function makeBackup(includeAudio: boolean): Promise<{ blob: Blob; count: number; name: string }> {
  // Unsaved edits live in the in-memory store; prefer them.
  const stored = await db.meetings.toArray();
  const meetings = stored.map((m) => getMeeting(m.id) ?? m);
  const backup: Backup = { app: "footnote", version: 1, exportedAt: Date.now(), meetings };
  if (includeAudio) {
    const recs = await db.recordings.toArray();
    backup.audio = [];
    for (const r of recs) {
      const chunks = await db.recordingChunks.where("[recordingId+seq]").between([r.id, 0], [r.id, Infinity]).toArray();
      if (!chunks.length) continue;
      backup.audio.push({ ...r, data: await blobToDataUrl(new Blob(chunks.map((c) => c.blob), { type: r.mime })) });
    }
  }
  const d = new Date();
  const name = `footnote-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
  return { blob: new Blob([JSON.stringify(backup)], { type: "application/json" }), count: meetings.length, name };
}

function isMeeting(x: unknown): x is Meeting {
  const m = x as Meeting;
  return (
    !!m &&
    typeof m.id === "string" &&
    typeof m.title === "string" &&
    typeof m.createdAt === "number" &&
    typeof m.notes === "string" &&
    Array.isArray(m.segments) &&
    m.segments.every((s) => s && typeof s.id === "string" && typeof s.t === "number" && typeof s.text === "string")
  );
}

export interface RestoreResult {
  added: number;
  updated: number;
  skipped: number;
}

/** Throws with a readable message when the file isn't a Footnote backup. */
export async function restoreBackup(file: Blob): Promise<RestoreResult> {
  let data: Backup;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Footnote backup (it isn't JSON).");
  }
  if (!data || data.app !== "footnote" || !Array.isArray(data.meetings)) {
    throw new Error("That file isn't a Footnote backup.");
  }
  const result: RestoreResult = { added: 0, updated: 0, skipped: 0 };
  const restoredIds = new Set<string>();
  for (const raw of data.meetings) {
    if (!isMeeting(raw)) {
      result.skipped++;
      continue;
    }
    const m: Meeting = { ...raw, status: raw.status === "live" ? "ended" : raw.status, enhanced: raw.enhanced ?? null };
    const existing = await db.meetings.get(m.id);
    if (existing && (existing.updatedAt ?? 0) >= (m.updatedAt ?? 0)) {
      result.skipped++;
      continue;
    }
    await db.meetings.put(m);
    restoredIds.add(m.id);
    if (existing) result.updated++;
    else result.added++;
    // A meeting already open picks up the restored copy.
    if (getMeeting(m.id)) patchMeetingState(m.id, m, { immediate: true });
    else void loadMeeting(m.id);
  }
  for (const a of data.audio ?? []) {
    if (!restoredIds.has(a.meetingId) || typeof a.data !== "string" || !a.data.startsWith("data:")) continue;
    if (await db.recordings.get(a.id)) continue;
    const blob = await dataUrlToBlob(a.data);
    await db.recordings.put({ id: a.id, meetingId: a.meetingId, offsetMs: a.offsetMs || 0, mime: a.mime, createdAt: a.createdAt });
    await db.recordingChunks.add({ recordingId: a.id, meetingId: a.meetingId, seq: 0, blob });
  }
  return result;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

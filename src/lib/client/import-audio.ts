"use client";
import { useSyncExternalStore } from "react";
import { db } from "../db";
import { uid } from "../format";
import { sentencesAcross } from "../import";
import type { Segment } from "../types";
import { ApiError, transcribeChunk } from "./api";
import { getMeeting, updateMeeting } from "./store";

/**
 * Importing a recording: the file is kept on this device (so footnotes can play it), and
 * transcribed in ~20-second pieces cut at the quietest moment near each boundary, three at
 * a time. Lines are added to the meeting in order as the pieces come back, so the
 * transcript prints while you watch.
 */

export interface ImportProgress {
  fileName: string;
  done: number;
  total: number;
  error?: string;
  finished?: boolean;
}

const RATE = 16000;
const MAX_CHUNK_S = 20;
const MIN_CHUNK_S = 13;
const CONCURRENCY = 3;
export const MAX_IMPORT_MINUTES = 120;
export const MAX_IMPORT_BYTES = 300 * 1024 * 1024;

const progress = new Map<string, ImportProgress>();
const listeners = new Set<() => void>();
const cancelled = new Set<string>();

function emit(meetingId: string, p: ImportProgress | null) {
  if (p) progress.set(meetingId, p);
  else progress.delete(meetingId);
  listeners.forEach((l) => l());
}

export function useImportProgress(meetingId: string | null): ImportProgress | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (meetingId ? progress.get(meetingId) : undefined),
    () => undefined,
  );
}

export function cancelImport(meetingId: string) {
  cancelled.add(meetingId);
  emit(meetingId, null);
}

export function dismissImport(meetingId: string) {
  emit(meetingId, null);
}

/** How long a recording is, without decoding it all. */
export function audioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    a.onerror = () => done(0);
    a.src = url;
  });
}

async function decodeMono(file: Blob): Promise<Float32Array> {
  const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  // Decoding into a 16 kHz context resamples on the way in.
  const ctx = new Offline(1, RATE, RATE);
  const buf = await ctx.decodeAudioData(await file.arrayBuffer());
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

/** Chunk boundaries (in samples), each cut at the quietest 50 ms between 13 s and 20 s in. */
export function chunkBounds(pcm: Float32Array, rate = RATE): [number, number][] {
  const frame = Math.round(rate * 0.05);
  const bounds: [number, number][] = [];
  let start = 0;
  while (start < pcm.length) {
    const hardEnd = Math.min(pcm.length, start + MAX_CHUNK_S * rate);
    if (hardEnd === pcm.length) {
      bounds.push([start, hardEnd]);
      break;
    }
    let best = hardEnd;
    let bestEnergy = Infinity;
    for (let f = start + MIN_CHUNK_S * rate; f + frame <= hardEnd; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += pcm[i] * pcm[i];
      if (e < bestEnergy) {
        bestEnergy = e;
        best = f + Math.round(frame / 2);
      }
    }
    bounds.push([start, best]);
    start = best;
  }
  return bounds;
}

function wav(pcm: Float32Array, rate = RATE): Blob {
  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(bytes);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

/** Keeps the original file with the meeting, the same way a live recording is kept. */
export async function keepRecording(meetingId: string, file: Blob) {
  const recordingId = uid("r_");
  await db.recordings.put({ id: recordingId, meetingId, offsetMs: 0, mime: file.type || "audio/mpeg", createdAt: Date.now() });
  await db.recordingChunks.add({ recordingId, meetingId, seq: 0, blob: file });
}

export async function importRecording(meetingId: string, file: File) {
  cancelled.delete(meetingId);
  const base = { fileName: file.name, done: 0, total: 0 };
  emit(meetingId, base);
  let pcm: Float32Array;
  try {
    pcm = await decodeMono(file);
  } catch {
    emit(meetingId, { ...base, error: "This browser couldn't read that audio file. Try an .mp3, .m4a or .wav." });
    return;
  }
  const bounds = chunkBounds(pcm);
  const total = bounds.length;
  emit(meetingId, { ...base, total });

  const results: ({ t: number; text: string }[] | undefined)[] = new Array(total);
  let next = 0;
  let flushed = 0;
  let failure: string | null = null;

  const flush = () => {
    const add: { t: number; text: string }[] = [];
    while (flushed < total && results[flushed]) add.push(...results[flushed++]!);
    if (!add.length) return;
    updateMeeting(meetingId, (m) => {
      let n = m.segments.length;
      const segs: Segment[] = add.map((a) => ({ id: `s${++n}`, speaker: "them", label: "Recording", t: a.t, text: a.text }));
      return { ...m, segments: [...m.segments, ...segs] };
    });
  };

  const worker = async () => {
    while (next < total && !failure && !cancelled.has(meetingId) && getMeeting(meetingId)) {
      const i = next++;
      const [a, b] = bounds[i];
      const startMs = Math.round((a / RATE) * 1000);
      const durMs = Math.round(((b - a) / RATE) * 1000);
      try {
        const text = await transcribeChunk(wav(pcm.subarray(a, b)), durMs);
        results[i] = sentencesAcross(text, startMs, durMs);
      } catch (e) {
        failure = e instanceof ApiError ? e.message : "A piece of the recording couldn't be transcribed.";
        return;
      }
      flush();
      const done = results.filter(Boolean).length;
      if (!cancelled.has(meetingId)) emit(meetingId, { ...base, total, done });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  if (cancelled.has(meetingId)) return;
  const done = results.filter(Boolean).length;
  emit(meetingId, failure ? { ...base, total, done, error: failure } : { ...base, total, done, finished: true });
}

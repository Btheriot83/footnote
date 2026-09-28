"use client";
import { db } from "../db";
import { uid } from "../format";

/**
 * Keeps a meeting's audio on this device (IndexedDB), never uploaded, so a footnote
 * can play the exact moment it cites. Mic and tab audio are mixed into one track.
 */
export class LocalRecorder {
  private rec: MediaRecorder | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private seq = 0;
  private recordingId = uid("r_");
  private writes: Promise<unknown>[] = [];

  constructor(
    private meetingId: string,
    /** Date.now() at the meeting clock's zero. */
    private clockStart: number,
    private onFirstChunk: () => void,
  ) {}

  /** Starts recording the given streams through the capture's AudioContext. */
  start(ctx: AudioContext, streams: MediaStream[]): boolean {
    const audio = streams.flatMap((s) => s.getAudioTracks()).filter((t) => t.readyState === "live");
    if (!audio.length || typeof MediaRecorder === "undefined") return false;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    );
    try {
      this.dest = ctx.createMediaStreamDestination();
      for (const track of audio) ctx.createMediaStreamSource(new MediaStream([track])).connect(this.dest);
      this.rec = new MediaRecorder(this.dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);
    } catch {
      return false;
    }
    const recordingMime = this.rec.mimeType || mime || "audio/webm";
    void db.recordings.put({
      id: this.recordingId,
      meetingId: this.meetingId,
      offsetMs: Math.max(0, Date.now() - this.clockStart),
      mime: recordingMime,
      createdAt: Date.now(),
    });
    this.rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      const seq = this.seq++;
      if (seq === 0) this.onFirstChunk();
      this.writes.push(
        db.recordingChunks.add({ recordingId: this.recordingId, meetingId: this.meetingId, seq, blob: e.data }).catch(() => {}),
      );
    };
    this.rec.start(4000);
    return true;
  }

  async stop() {
    const rec = this.rec;
    this.rec = null;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    await Promise.all(this.writes);
  }
}

export interface LoadedRecording {
  offsetMs: number;
  url: string;
}

/** Rebuilds each recording of a meeting as a playable object URL (caller revokes). */
export async function loadRecordings(meetingId: string): Promise<LoadedRecording[]> {
  const recs = await db.recordings.where("meetingId").equals(meetingId).sortBy("offsetMs");
  const out: LoadedRecording[] = [];
  for (const r of recs) {
    const chunks = await db.recordingChunks.where("[recordingId+seq]").between([r.id, 0], [r.id, Infinity]).toArray();
    if (!chunks.length) continue;
    out.push({ offsetMs: r.offsetMs, url: URL.createObjectURL(new Blob(chunks.map((c) => c.blob), { type: r.mime })) });
  }
  return out;
}

export async function deleteRecordings(meetingId: string) {
  await db.transaction("rw", db.recordings, db.recordingChunks, async () => {
    await db.recordings.where("meetingId").equals(meetingId).delete();
    await db.recordingChunks.where("meetingId").equals(meetingId).delete();
  });
}

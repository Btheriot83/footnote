"use client";
import type { Speaker } from "../types";
import { ApiError, transcribeChunk } from "./api";

export type SourceState = "off" | "starting" | "on" | "denied" | "error" | "unsupported";

export interface CaptureIssue {
  source: "mic" | "tab";
  code: "denied" | "no_audio" | "unsupported" | "limit" | "no_key" | "network" | "ended" | "error";
  message: string;
}

export interface CaptureEvents {
  onSegment(seg: { speaker: Speaker; t: number; text: string }): void;
  onInterim(interim: { t: number; text: string } | null): void;
  onLevel(level: number): void;
  onIssue(issue: CaptureIssue): void;
  onSources(sources: { mic: SourceState; tab: SourceState; micMode: "speech" | "chunks" | null }): void;
}

const CHUNK_MS = 9000;
const SILENCE_RMS = 0.012;

/* ---------- helpers ---------- */

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SREvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function speechRecognitionCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function captureSupport() {
  const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices;
  return {
    speech: !!speechRecognitionCtor(),
    mic: hasMedia && typeof navigator.mediaDevices.getUserMedia === "function",
    tab: hasMedia && typeof navigator.mediaDevices.getDisplayMedia === "function",
    recorder: typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined",
  };
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function rms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** Things transcription models like to say over near-silence. */
const HALLUCINATIONS = [/^thank(s| you)( for watching)?\.?$/i, /^you\.?$/i, /^\.+$/, /^bye\.?$/i];

/* ---------- chunked recorder (tab audio, or mic fallback) ---------- */

class ChunkRecorder {
  private running = false;
  private rec: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private peak = 0;
  private disabled = false;
  private inflight = 0;

  constructor(
    private stream: MediaStream,
    private speaker: Speaker,
    private startedAt: number,
    private level: () => number,
    private events: CaptureEvents,
    private source: "mic" | "tab",
  ) {}

  start() {
    this.running = true;
    this.next();
  }

  /** Called by the level loop so we can skip silent chunks. */
  sample() {
    const l = this.level();
    if (l > this.peak) this.peak = l;
  }

  private next() {
    if (!this.running || this.disabled) return;
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    } catch {
      this.events.onIssue({ source: this.source, code: "unsupported", message: "This browser can't record audio chunks." });
      return;
    }
    const parts: Blob[] = [];
    const chunkStart = Date.now();
    this.peak = 0;
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      const peak = this.peak;
      const duration = Date.now() - chunkStart;
      if (!parts.length || peak < SILENCE_RMS || duration < 800) return;
      void this.upload(new Blob(parts, { type: rec.mimeType || mime || "audio/webm" }), chunkStart, duration);
    };
    rec.start();
    this.rec = rec;
    this.timer = setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
      this.next();
    }, CHUNK_MS);
  }

  private async upload(blob: Blob, chunkStart: number, duration: number) {
    if (this.disabled) return;
    this.inflight++;
    try {
      const text = await transcribeChunk(blob, duration);
      const clean = text.trim();
      if (clean && !HALLUCINATIONS.some((r) => r.test(clean))) {
        this.events.onSegment({ speaker: this.speaker, t: Math.max(0, chunkStart - this.startedAt), text: clean });
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "limit" || err.code === "no_key") {
        this.disabled = true;
        this.events.onIssue({ source: this.source, code: err.code, message: err.message });
      } else {
        this.events.onIssue({
          source: this.source,
          code: "network",
          message: err.message || "A chunk of audio couldn't be transcribed.",
        });
      }
    } finally {
      this.inflight--;
    }
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.rec && this.rec.state !== "inactive") this.rec.stop();
  }
}

/* ---------- live capture ---------- */

export class LiveCapture {
  private running = false;
  private startedAt = 0;
  private ctx: AudioContext | null = null;
  private analysers: { node: AnalyserNode; buf: Float32Array<ArrayBuffer>; source: "mic" | "tab" }[] = [];
  private streams: MediaStream[] = [];
  private chunkers: ChunkRecorder[] = [];
  private recognition: SR | null = null;
  private recognitionFatal = false;
  private utteranceStart: number | null = null;
  private raf = 0;
  private lastLevelEmit = 0;
  private sources: { mic: SourceState; tab: SourceState; micMode: "speech" | "chunks" | null } = {
    mic: "off",
    tab: "off",
    micMode: null,
  };

  constructor(private events: CaptureEvents) {}

  get isRunning() {
    return this.running;
  }

  private setSources(patch: Partial<LiveCapture["sources"]>) {
    this.sources = { ...this.sources, ...patch };
    this.events.onSources(this.sources);
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private addAnalyser(stream: MediaStream, source: "mic" | "tab") {
    const ctx = this.ensureCtx();
    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(node);
    const entry = { node, buf: new Float32Array(node.fftSize), source };
    this.analysers.push(entry);
    return () => rms(entry.node, entry.buf);
  }

  /**
   * Start capturing. Call directly from a click handler: screen/tab capture
   * requires a user gesture, so tab audio is requested first.
   */
  async start(opts: { mic: boolean; tab: boolean; startedAt: number }) {
    this.running = true;
    this.startedAt = opts.startedAt;
    const support = captureSupport();

    if (opts.tab) await this.startTab(support.tab && support.recorder);
    if (opts.mic) await this.startMic(support);

    this.loop();
  }

  private async startTab(supported: boolean) {
    if (!supported) {
      this.setSources({ tab: "unsupported" });
      this.events.onIssue({
        source: "tab",
        code: "unsupported",
        message: "This browser can't capture tab audio. Use Chrome or Edge on desktop.",
      });
      return;
    }
    this.setSources({ tab: "starting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        systemAudio: "include",
        surfaceSwitching: "include",
      } as DisplayMediaStreamOptions);
    } catch (e) {
      const name = (e as DOMException)?.name;
      this.setSources({ tab: name === "NotAllowedError" ? "denied" : "error" });
      this.events.onIssue({
        source: "tab",
        code: name === "NotAllowedError" ? "denied" : "error",
        message:
          name === "NotAllowedError"
            ? "Tab sharing was cancelled, so Footnote can't hear the other side. You can still take notes and use your mic."
            : "Couldn't start tab capture.",
      });
      return;
    }
    const audio = stream.getAudioTracks();
    if (audio.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      this.setSources({ tab: "error" });
      this.events.onIssue({
        source: "tab",
        code: "no_audio",
        message: "No audio was shared. Share the meeting's browser tab and switch on “Share tab audio”.",
      });
      return;
    }
    this.streams.push(stream);
    audio[0].addEventListener("ended", () => {
      if (!this.running) return;
      this.setSources({ tab: "off" });
      this.events.onIssue({ source: "tab", code: "ended", message: "Tab sharing stopped. The other side is no longer being transcribed." });
    });
    const audioOnly = new MediaStream(audio);
    const level = this.addAnalyser(audioOnly, "tab");
    const chunker = new ChunkRecorder(audioOnly, "them", this.startedAt, level, this.events, "tab");
    this.chunkers.push(chunker);
    chunker.start();
    this.setSources({ tab: "on" });
  }

  private async startMic(support: ReturnType<typeof captureSupport>) {
    if (!support.mic) {
      this.setSources({ mic: "unsupported" });
      this.events.onIssue({ source: "mic", code: "unsupported", message: "This browser can't access a microphone." });
      return;
    }
    this.setSources({ mic: "starting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      const denied = name === "NotAllowedError" || name === "SecurityError";
      this.setSources({ mic: denied ? "denied" : "error" });
      this.events.onIssue({
        source: "mic",
        code: denied ? "denied" : "error",
        message: denied
          ? "Microphone access is blocked. Allow it from the address bar to transcribe your side, or keep going with notes only."
          : name === "NotFoundError"
            ? "No microphone was found."
            : "Couldn't start the microphone.",
      });
      return;
    }
    this.streams.push(stream);
    const level = this.addAnalyser(stream, "mic");

    if (support.speech) {
      this.startSpeech(stream, level);
    } else {
      this.startMicChunks(stream, level, support.recorder);
    }
  }

  private startMicChunks(stream: MediaStream, level: () => number, recorder: boolean) {
    if (!recorder) {
      this.setSources({ mic: "unsupported" });
      this.events.onIssue({ source: "mic", code: "unsupported", message: "This browser can't transcribe your mic." });
      return;
    }
    const chunker = new ChunkRecorder(stream, "you", this.startedAt, level, this.events, "mic");
    this.chunkers.push(chunker);
    chunker.start();
    this.setSources({ mic: "on", micMode: "chunks" });
  }

  private startSpeech(stream: MediaStream, level: () => number) {
    const Ctor = speechRecognitionCtor()!;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          const clean = text.trim();
          if (clean) {
            const t = this.utteranceStart ?? Math.max(0, Date.now() - this.startedAt - 1500);
            this.events.onSegment({ speaker: "you", t, text: clean.charAt(0).toUpperCase() + clean.slice(1) });
          }
          this.utteranceStart = null;
        } else {
          interim += text;
        }
      }
      if (interim.trim()) {
        if (this.utteranceStart === null) this.utteranceStart = Math.max(0, Date.now() - this.startedAt - 600);
        this.events.onInterim({ t: this.utteranceStart, text: interim.trim() });
      } else {
        this.events.onInterim(null);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed") {
        this.recognitionFatal = true;
        this.setSources({ mic: "denied" });
        this.events.onIssue({ source: "mic", code: "denied", message: "Speech recognition was blocked. Allow the microphone to transcribe your side." });
        return;
      }
      // "network", "service-not-allowed", "audio-capture": fall back to server transcription.
      this.recognitionFatal = true;
      this.recognition = null;
      this.events.onInterim(null);
      this.startMicChunks(stream, level, captureSupport().recorder);
    };
    rec.onend = () => {
      if (this.running && !this.recognitionFatal && this.recognition === rec) {
        setTimeout(() => {
          if (this.running && this.recognition === rec) {
            try {
              rec.start();
            } catch {
              /* already started */
            }
          }
        }, 200);
      }
    };
    try {
      rec.start();
      this.recognition = rec;
      this.setSources({ mic: "on", micMode: "speech" });
    } catch {
      this.startMicChunks(stream, level, captureSupport().recorder);
    }
  }

  private loop = () => {
    if (!this.running) return;
    let max = 0;
    for (const a of this.analysers) max = Math.max(max, rms(a.node, a.buf));
    for (const c of this.chunkers) c.sample();
    const now = performance.now();
    if (now - this.lastLevelEmit > 50) {
      this.events.onLevel(Math.min(1, max * 4));
      this.lastLevelEmit = now;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.chunkers.forEach((c) => c.stop());
    this.chunkers = [];
    if (this.recognition) {
      const r = this.recognition;
      this.recognition = null;
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
    this.events.onInterim(null);
    // Give MediaRecorders a moment to flush their final chunk before tracks stop.
    const streams = this.streams;
    this.streams = [];
    setTimeout(() => streams.forEach((s) => s.getTracks().forEach((t) => t.stop())), 300);
    const ctx = this.ctx;
    this.ctx = null;
    this.analysers = [];
    setTimeout(() => void ctx?.close().catch(() => {}), 400);
    this.setSources({ mic: "off", tab: "off", micMode: null });
    this.events.onLevel(0);
  }
}

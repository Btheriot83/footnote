"use client";
import type { EnhancedNotes, Segment } from "../types";
import { getUserKey } from "./settings";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const key = getUserKey();
  if (key) h["x-user-openai-key"] = key;
  return h;
}

async function errorFrom(res: Response): Promise<ApiError> {
  let code = "error";
  let message = "Something went wrong. Please try again.";
  try {
    const data = await res.json();
    code = data.error || code;
    message = data.message || message;
  } catch {
    if (res.status === 404) message = "The server route is missing.";
  }
  return new ApiError(code, message, res.status);
}

export interface Status {
  hosted: boolean;
  userKey: boolean;
  limits: { enhances: number; asks: number; transcribeMinutes: number };
  remaining: { enhances: number; asks: number; transcribeMinutes: number; transcribeSeconds: number };
}

export async function fetchStatus(): Promise<Status | null> {
  try {
    const res = await fetch("/api/status", { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Status;
  } catch {
    return null;
  }
}

function toWire(segments: Segment[]) {
  return segments.map((s) => ({ id: s.id, speaker: s.speaker, label: s.label, t: Math.round(s.t), text: s.text }));
}

export async function streamEnhance(
  input: { template: string; title?: string; userNotes: string; segments: Segment[] },
  onPartial: (notes: EnhancedNotes) => void,
  signal?: AbortSignal,
): Promise<EnhancedNotes> {
  let res: Response;
  try {
    res = await fetch("/api/enhance", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        template: input.template,
        title: input.title,
        userNotes: input.userNotes,
        transcriptSegments: toWire(input.segments),
      }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("network", "You appear to be offline. Check your connection and try again.", 0);
  }
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: EnhancedNotes | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: { type: string; notes?: EnhancedNotes; message?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === "partial" && msg.notes) onPartial(msg.notes);
      else if (msg.type === "final" && msg.notes) final = msg.notes;
      else if (msg.type === "error") throw new ApiError("upstream", msg.message || "Enhance failed.", 502);
    }
  }
  if (!final) throw new ApiError("incomplete", "The response ended early. Please try again.", 502);
  return final;
}

export async function transcribeChunk(blob: Blob, durationMs: number): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "chunk");
  form.append("durationMs", String(Math.round(durationMs)));
  const res = await fetch("/api/transcribe", { method: "POST", headers: headers(), body: form });
  if (!res.ok) throw await errorFrom(res);
  const data = (await res.json()) as { text: string };
  return data.text;
}

export interface AskSentence {
  text: string;
  cites: string[];
}

export async function askMeeting(question: string, userNotes: string, segments: Segment[]): Promise<AskSentence[]> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ question, userNotes, transcriptSegments: toWire(segments) }),
  });
  if (!res.ok) throw await errorFrom(res);
  const data = (await res.json()) as { sentences: AskSentence[] };
  return data.sentences;
}

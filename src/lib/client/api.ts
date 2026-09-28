"use client";
import type { EnhancedNotes, Segment } from "../types";
import { getServerStatus } from "./server-status";
import { getActiveKey, setKeyStatus } from "./settings";
import { toast } from "./toast";

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
  const key = getActiveKey();
  if (key) h["x-user-openai-key"] = key;
  return h;
}

/** Known up front: no key of your own and none on the server. Skip the doomed request. */
function assertAiAvailable() {
  const s = getServerStatus();
  if (s && !s.hosted && !getActiveKey()) {
    throw new ApiError(
      "no_key",
      "This demo server doesn't include an AI key, so AI features need your own OpenAI key. Add it in Settings; it stays in your browser.",
      503,
    );
  }
}

/**
 * Runs a request with the saved key. If OpenAI rejects that key, it's parked (kept, but
 * no longer sent) and the request runs once more on the free allowance, if there is one.
 */
async function withKeyFallback<T>(run: () => Promise<T>): Promise<T> {
  assertAiAvailable();
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== "bad_key" || !getActiveKey()) throw e;
    setKeyStatus("bad");
    toast("OpenAI rejected your saved key, so Footnote is using the free allowance. Fix the key in Settings.", {
      tone: "error",
      duration: 8000,
    });
    assertAiAvailable();
    return run();
  }
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

export function streamEnhance(
  input: { template: string; title?: string; userNotes: string; segments: Segment[] },
  onPartial: (notes: EnhancedNotes) => void,
  signal?: AbortSignal,
): Promise<EnhancedNotes> {
  return withKeyFallback(() => streamEnhanceOnce(input, onPartial, signal));
}

async function streamEnhanceOnce(
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
      let msg: { type: string; notes?: EnhancedNotes; message?: string; code?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === "partial" && msg.notes) onPartial(msg.notes);
      else if (msg.type === "final" && msg.notes) final = msg.notes;
      else if (msg.type === "error") throw new ApiError(msg.code || "upstream", msg.message || "Enhance failed.", 502);
    }
  }
  if (!final) throw new ApiError("incomplete", "The response ended early. Please try again.", 502);
  return final;
}

export function transcribeChunk(blob: Blob, durationMs: number): Promise<string> {
  return withKeyFallback(() => transcribeChunkOnce(blob, durationMs));
}

async function transcribeChunkOnce(blob: Blob, durationMs: number): Promise<string> {
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
  newParagraph?: boolean;
}

async function postAsk(body: unknown): Promise<AskSentence[]> {
  return withKeyFallback(async () => {
    let res: Response;
    try {
      res = await fetch("/api/ask", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError("network", "You appear to be offline. Check your connection and try again.", 0);
    }
    if (!res.ok) throw await errorFrom(res);
    const data = (await res.json()) as { sentences: AskSentence[] };
    return data.sentences;
  });
}

export function askMeeting(
  question: string,
  userNotes: string,
  segments: Segment[],
  opts?: { recipe?: string },
): Promise<AskSentence[]> {
  return postAsk({ question, userNotes, transcriptSegments: toWire(segments), recipe: opts?.recipe });
}

/** Asks across several meetings. Returned cites look like "m2:s14" (meeting ref : segment id). */
export function askMeetings(
  question: string,
  meetings: { ref: string; title: string; date: string; notes: string; segments: Segment[] }[],
): Promise<AskSentence[]> {
  return postAsk({
    question,
    userNotes: "",
    meetings: meetings.map(({ ref, title, date, notes }) => ({ ref, title, date, notes })),
    transcriptSegments: meetings.flatMap((m) => toWire(m.segments).map((s) => ({ ...s, id: `${m.ref}:${s.id}` }))),
  });
}

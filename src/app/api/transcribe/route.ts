import { audioMinutes, budgetExhaustedResponse, release, reserve, settle, TRANSCRIBE_CENTS_PER_MIN, transcribeReserveCents } from "@/lib/server/budget";
import { allowanceCookie, limitResponse, readAllowance, remaining } from "@/lib/server/allowance";
import { friendlyUpstreamError, MODELS, noKeyResponse, resolveKey } from "@/lib/server/keys";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;

/** Transcribes one ~9s audio chunk (a complete webm/ogg/mp4 file). */
export async function POST(req: Request) {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_request", message: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "bad_request", message: "No audio in the request." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large", message: "That audio chunk was too large." }, { status: 413 });
  }
  const durationSec = Math.min(20, Math.max(1, Number(form.get("durationMs") || 9000) / 1000));

  const headers = new Headers({ "Cache-Control": "no-store" });
  const minutes = audioMinutes(durationSec, file.size);
  let budgetId: string | null = null;
  if (key.mode === "hosted") {
    const a = readAllowance(req);
    if (remaining(a).transcribeSeconds <= 0) return limitResponse("transcribe");
    // Hard global cap on the hosted key. Bill by what the bytes could hold, not just the reported duration.
    const r = await reserve("transcribe", transcribeReserveCents(minutes));
    if (!r.ok) return budgetExhaustedResponse();
    budgetId = r.id;
    a.transcribeSeconds += durationSec;
    headers.append("Set-Cookie", allowanceCookie(a));
  }

  const type = file.type || "audio/webm";
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const upstream = new FormData();
  upstream.append("file", file, `chunk.${ext}`);
  upstream.append("model", MODELS.transcribe);
  upstream.append("response_format", "json");
  const lang = form.get("language");
  if (typeof lang === "string" && /^[a-z]{2}$/.test(lang)) upstream.append("language", lang);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key.apiKey}` },
      body: upstream,
    });
  } catch {
    // Unknown whether OpenAI did the work: charge it.
    if (budgetId) await settle(budgetId, minutes * TRANSCRIBE_CENTS_PER_MIN);
    return Response.json({ error: "upstream", message: "Couldn't reach the transcription service." }, { status: 502 });
  }
  if (budgetId) {
    if (res.ok) await settle(budgetId, minutes * TRANSCRIBE_CENTS_PER_MIN);
    else await release(budgetId);
  }
  if (!res.ok) {
    const f = friendlyUpstreamError(res.status, key.mode);
    return Response.json({ error: f.code, message: f.message }, { status: f.status });
  }
  const data = (await res.json()) as { text?: string };
  return Response.json({ text: (data.text || "").trim() }, { headers });
}

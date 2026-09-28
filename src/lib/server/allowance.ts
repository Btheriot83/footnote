import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Hosted allowance: a signed, per-visitor cookie counter that resets daily.
 * It's a soft cap to keep a free demo cheap, not a security boundary.
 */
export const LIMITS = {
  enhances: Number(process.env.FOOTNOTE_ENHANCES_PER_DAY || 5),
  asks: Number(process.env.FOOTNOTE_ASKS_PER_DAY || 15),
  transcribeSeconds: Number(process.env.FOOTNOTE_TRANSCRIBE_MINUTES_PER_DAY || 10) * 60,
};

const COOKIE = "fn_allow";

export interface Allowance {
  day: string;
  enhances: number;
  asks: number;
  transcribeSeconds: number;
}

function secret(): string {
  const explicit = process.env.FOOTNOTE_SECRET;
  if (explicit) return explicit;
  return createHash("sha256")
    .update("footnote-allowance:" + (process.env.OPENAI_API_KEY || "dev"))
    .digest("hex");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function fresh(): Allowance {
  return { day: today(), enhances: 0, asks: 0, transcribeSeconds: 0 };
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function readAllowance(req: Request): Allowance {
  const raw = readCookie(req, COOKIE);
  if (!raw) return fresh();
  const [data, sig] = raw.split(".");
  if (!data || !sig) return fresh();
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fresh();
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Allowance;
    if (parsed.day !== today()) return fresh();
    return {
      day: parsed.day,
      enhances: Number(parsed.enhances) || 0,
      asks: Number(parsed.asks) || 0,
      transcribeSeconds: Number(parsed.transcribeSeconds) || 0,
    };
  } catch {
    return fresh();
  }
}

export function allowanceCookie(a: Allowance): string {
  const data = Buffer.from(JSON.stringify(a)).toString("base64url");
  const value = `${data}.${sign(data)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax${secure}`;
}

export function remaining(a: Allowance) {
  return {
    enhances: Math.max(0, LIMITS.enhances - a.enhances),
    asks: Math.max(0, LIMITS.asks - a.asks),
    transcribeMinutes: Math.max(0, Math.floor((LIMITS.transcribeSeconds - a.transcribeSeconds) / 60)),
    transcribeSeconds: Math.max(0, LIMITS.transcribeSeconds - a.transcribeSeconds),
  };
}

export function limitResponse(kind: "enhances" | "asks" | "transcribe") {
  const messages = {
    enhances: `You've used today's ${LIMITS.enhances} free enhancements. Add your own OpenAI key in Settings for unlimited use, or come back tomorrow.`,
    asks: `You've used today's ${LIMITS.asks} free questions. Add your own OpenAI key in Settings to keep asking.`,
    transcribe: `You've used today's ${Math.round(LIMITS.transcribeSeconds / 60)} free minutes of transcription. Your mic still works through the browser; add your own key in Settings for tab audio.`,
  };
  return Response.json({ error: "limit", kind, message: messages[kind] }, { status: 429 });
}

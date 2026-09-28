import "server-only";

export type KeyMode = "user" | "hosted";

export interface ResolvedKey {
  apiKey: string;
  mode: KeyMode;
}

export const USER_KEY_HEADER = "x-user-openai-key";

/** User key from the request header wins; otherwise the server's key. Never logged. */
export function resolveKey(req: Request): ResolvedKey | null {
  const user = req.headers.get(USER_KEY_HEADER)?.trim();
  if (user && user.length > 20 && user.length < 400 && !/\s/.test(user)) {
    return { apiKey: user, mode: "user" };
  }
  const server = process.env.OPENAI_API_KEY?.trim();
  if (server) return { apiKey: server, mode: "hosted" };
  return null;
}

export function hasServerKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export const MODELS = {
  enhance: process.env.FOOTNOTE_MODEL || "gpt-5.4-mini",
  transcribe: process.env.FOOTNOTE_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
};

export function noKeyResponse() {
  return Response.json(
    {
      error: "no_key",
      message:
        "This demo server doesn't include an AI key, so AI features need your own OpenAI key. Add it in Settings; it stays in your browser.",
    },
    { status: 503 },
  );
}

/** Maps upstream OpenAI errors to friendly, key-free messages. */
export function friendlyUpstreamError(
  status: number | undefined,
  mode: KeyMode,
): { status: number; message: string; code: string } {
  if (status === 401) {
    return {
      status: 401,
      // The client parks a rejected user key and retries on the free allowance.
      code: mode === "user" ? "bad_key" : "upstream",
      message:
        mode === "user"
          ? "OpenAI rejected your API key. Check it in Settings."
          : "The hosted key was rejected. Add your own key in Settings.",
    };
  }
  if (status === 429) {
    return {
      status: 429,
      code: "upstream",
      message:
        mode === "user"
          ? "OpenAI is rate limiting your key (or it's out of credit). Try again in a moment."
          : "The hosted allowance is busy right now. Try again shortly, or add your own key in Settings.",
    };
  }
  return { status: 502, code: "upstream", message: "The AI service had a hiccup. Please try again." };
}

/** Sampling settings that work for both reasoning (gpt-5*, o*) and classic models. */
export function modelSettings(model: string, temperature: number) {
  const reasoning = /^(gpt-5|o\d)/.test(model);
  return reasoning
    ? { providerOptions: { openai: { reasoningEffort: process.env.FOOTNOTE_REASONING || "none" } } }
    : { temperature };
}

/** Logs an upstream failure without ever printing key material. */
export function logUpstreamError(where: string, err: unknown) {
  const e = err as { name?: string; statusCode?: number; message?: string; finishReason?: string };
  const msg = String(e?.message ?? "").replace(/sk-[A-Za-z0-9_\-*.]+/g, "sk-[redacted]").slice(0, 300);
  console.error(`[footnote] ${where} failed: ${e?.name ?? "Error"} status=${e?.statusCode ?? "-"} finish=${e?.finishReason ?? "-"} ${msg}`);
}

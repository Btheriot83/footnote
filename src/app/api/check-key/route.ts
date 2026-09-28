import { USER_KEY_HEADER } from "@/lib/server/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks a user's OpenAI key by listing models (free, no tokens spent).
 * The key comes in the request header, is used once, and is never stored or logged.
 */
export async function POST(req: Request) {
  const key = req.headers.get(USER_KEY_HEADER)?.trim();
  if (!key || key.length < 20 || /\s/.test(key)) {
    return Response.json({ ok: false, message: "That doesn't look like an OpenAI key." }, { status: 400 });
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.ok) return Response.json({ ok: true, message: "OpenAI accepted this key." });
    if (res.status === 401) return Response.json({ ok: false, message: "OpenAI rejected this key. Check for a typo." });
    if (res.status === 429) return Response.json({ ok: true, message: "The key works, but it's rate limited or out of credit." });
    return Response.json({ ok: false, message: `OpenAI answered with an error (${res.status}). Try again.` });
  } catch {
    return Response.json({ ok: false, message: "Couldn't reach OpenAI to check the key." }, { status: 502 });
  }
}

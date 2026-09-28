import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { sanitizePartial, validateEnhanced } from "@/lib/citations";
import { enhancedSchema, enhanceRequestSchema } from "@/lib/enhance-schema";
import { ENHANCE_SYSTEM, enhancePrompt } from "@/lib/prompt";
import { allowanceCookie, limitResponse, readAllowance, remaining } from "@/lib/server/allowance";
import { friendlyUpstreamError, logUpstreamError, modelSettings, MODELS, noKeyResponse, resolveKey } from "@/lib/server/keys";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streams enhanced notes as NDJSON:
 *   {"type":"partial","notes":{...}}   (sanitized, cites already validated)
 *   {"type":"final","notes":{...},"report":{...}}
 *   {"type":"error","message":"..."}
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = enhanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "bad_request", message: "That request didn't look right." }, { status: 400 });
  }
  const { template, title, userNotes, transcriptSegments } = parsed.data;
  if (!userNotes.trim() && transcriptSegments.length === 0) {
    return Response.json(
      { error: "empty", message: "There's nothing to enhance yet. Type a few notes or record some of the meeting first." },
      { status: 400 },
    );
  }

  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const headers = new Headers({
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Footnote-Key-Mode": key.mode,
  });
  if (key.mode === "hosted") {
    const a = readAllowance(req);
    if (remaining(a).enhances <= 0) return limitResponse("enhances");
    a.enhances += 1;
    headers.append("Set-Cookie", allowanceCookie(a));
    headers.set("X-Footnote-Remaining", String(remaining(a).enhances));
  }

  const validIds = new Set(transcriptSegments.map((s) => s.id));
  const openai = createOpenAI({ apiKey: key.apiKey });

  let upstreamStatus: number | undefined;
  const result = streamObject({
    model: openai(MODELS.enhance),
    schema: enhancedSchema,
    schemaName: "enhanced_notes",
    system: ENHANCE_SYSTEM,
    prompt: enhancePrompt({
      template,
      title,
      userNotes,
      segments: transcriptSegments,
      maxChars: key.mode === "hosted" ? 40000 : 120000,
    }),
    ...modelSettings(MODELS.enhance, 0.2),
    maxOutputTokens: key.mode === "hosted" ? 3000 : 6000,
    maxRetries: 1,
    onError: ({ error }) => {
      const e = error as { statusCode?: number };
      upstreamStatus = e?.statusCode;
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let last = 0;
      let pending: unknown = null;
      try {
        for await (const partial of result.partialObjectStream) {
          pending = partial;
          const now = Date.now();
          if (now - last > 60) {
            send({ type: "partial", notes: sanitizePartial(partial, validIds) });
            last = now;
            pending = null;
          }
        }
        if (pending) send({ type: "partial", notes: sanitizePartial(pending, validIds) });
        const object = await result.object;
        const { notes, report } = validateEnhanced(object, validIds);
        send({ type: "final", notes, report });
      } catch (err) {
        logUpstreamError("enhance", err);
        const status = upstreamStatus ?? (err as { statusCode?: number })?.statusCode;
        const friendly = friendlyUpstreamError(status, key.mode);
        send({ type: "error", message: friendly.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}

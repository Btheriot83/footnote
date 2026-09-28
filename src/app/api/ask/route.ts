import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { segmentInputSchema } from "@/lib/enhance-schema";
import { ASK_SYSTEM, transcriptBlock } from "@/lib/prompt";
import { allowanceCookie, limitResponse, readAllowance, remaining } from "@/lib/server/allowance";
import { friendlyUpstreamError, logUpstreamError, modelSettings, MODELS, noKeyResponse, resolveKey } from "@/lib/server/keys";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  question: z.string().min(1).max(500),
  userNotes: z.string().max(20000),
  transcriptSegments: z.array(segmentInputSchema).max(2000),
});

const answerSchema = z.object({
  sentences: z.array(z.object({ cites: z.array(z.string()), text: z.string() })),
});

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", message: "Ask a question about this meeting." }, { status: 400 });
  }
  const { question, userNotes, transcriptSegments } = parsed.data;
  if (transcriptSegments.length === 0) {
    return Response.json({ error: "empty", message: "There's no transcript to search yet." }, { status: 400 });
  }
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (key.mode === "hosted") {
    const a = readAllowance(req);
    if (remaining(a).asks <= 0) return limitResponse("asks");
    a.asks += 1;
    headers.append("Set-Cookie", allowanceCookie(a));
  }

  const valid = new Set(transcriptSegments.map((s) => s.id));
  try {
    const openai = createOpenAI({ apiKey: key.apiKey });
    const { object } = await generateObject({
      model: openai(MODELS.enhance),
      schema: answerSchema,
      system: ASK_SYSTEM,
      prompt: `<user_notes>\n${userNotes || "(none)"}\n</user_notes>\n\n<transcript>\n${transcriptBlock(transcriptSegments, 40000)}\n</transcript>\n\nQuestion: ${question}`,
      ...modelSettings(MODELS.enhance, 0.1),
      maxOutputTokens: 1200,
      maxRetries: 1,
    });
    const sentences = object.sentences
      .map((s) => ({
        text: s.text.trim(),
        cites: [...new Set(s.cites.map((c) => c.trim()))].filter((c) => valid.has(c)),
      }))
      .filter((s) => s.text);
    return Response.json({ sentences }, { headers });
  } catch (err) {
    logUpstreamError("ask", err);
    const f = friendlyUpstreamError((err as { statusCode?: number })?.statusCode, key.mode);
    return Response.json({ error: "upstream", message: f.message }, { status: f.status });
  }
}

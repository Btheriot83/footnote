import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { answerSchema, ASK_SYSTEM, askContext, getRecipe, validateAnswer } from "@/lib/ask";
import { segmentInputSchema } from "@/lib/enhance-schema";
import { allowanceCookie, limitResponse, readAllowance, remaining } from "@/lib/server/allowance";
import { friendlyUpstreamError, logUpstreamError, modelSettings, MODELS, noKeyResponse, resolveKey } from "@/lib/server/keys";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  question: z.string().min(1).max(500),
  userNotes: z.string().max(20000).default(""),
  transcriptSegments: z.array(segmentInputSchema).max(6000),
  /** A one-click recipe ("follow-up", "actions", "open-questions"). */
  recipe: z.string().max(40).optional(),
  /** Asking across several meetings: segment ids are "<ref>:<id>". */
  meetings: z
    .array(z.object({ ref: z.string().max(12), title: z.string().max(200), date: z.string().max(40), notes: z.string().max(20000).optional() }))
    .max(8)
    .optional(),
});

/**
 * Answers a question about one meeting (or several) with receipts:
 *   { sentences: [{ text, cites, newParagraph? }] }
 * Every cite is checked against the transcript; uncited claims are dropped.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request", message: "Ask a question about this meeting." }, { status: 400 });
  }
  const { question, userNotes, transcriptSegments, recipe: recipeId, meetings } = parsed.data;
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

  const recipe = getRecipe(recipeId);
  const valid = new Set(transcriptSegments.map((s) => s.id));
  const context = askContext({
    userNotes,
    segments: transcriptSegments,
    meetings,
    maxChars: key.mode === "hosted" ? 40000 : 120000,
  });
  const task = recipe
    ? `Task: ${recipe.instructions}`
    : meetings?.length
      ? `Question (answer across these meetings; name the meeting when it helps): ${question}`
      : `Question: ${question}`;

  try {
    const openai = createOpenAI({ apiKey: key.apiKey });
    const { object } = await generateObject({
      model: openai(MODELS.enhance),
      schema: answerSchema,
      schemaName: "answer",
      system: ASK_SYSTEM,
      prompt: `${context}\n\n${task}`,
      ...modelSettings(MODELS.enhance, 0.2),
      maxOutputTokens: recipe ? 1600 : 900,
      maxRetries: 1,
    });
    const { sentences } = validateAnswer(object, valid);
    return Response.json({ sentences }, { headers });
  } catch (err) {
    logUpstreamError("ask", err);
    const f = friendlyUpstreamError((err as { statusCode?: number })?.statusCode, key.mode);
    return Response.json({ error: f.code, message: f.message }, { status: f.status });
  }
}

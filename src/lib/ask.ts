import { z } from "zod";
import { formatClock } from "./format";

/** One-click "recipes": structured asks whose every factual sentence still carries a receipt. */
export interface Recipe {
  id: "follow-up" | "actions" | "open-questions";
  label: string;
  question: string;
  instructions: string;
  layout: "email" | "list";
}

export const RECIPES: Recipe[] = [
  {
    id: "follow-up",
    label: "Draft a follow-up email",
    question: "Draft a follow-up email",
    layout: "email",
    instructions: `Write a short follow-up email from the note-taker ("You" in the transcript) to the other people on the call.
Structure: a greeting line; one or two sentences thanking them and recapping what matters to them; the agreed next steps with owners and dates; a one-line sign-off. Start a new paragraph (newParagraph: true) for the recap, for the next steps and for the sign-off.
Address only the people who actually spoke on the call. Write it the way the note-taker would: warm, plain, specific, no filler, no subject line, no placeholders like [Name].
Keep sentences short, one point each, so every sentence carries its own receipt of one to three lines.
Every sentence that states a fact, number, date or commitment must cite the transcript lines it comes from. Only the greeting and the sign-off may have empty cites.`,
  },
  {
    id: "actions",
    label: "List the action items",
    question: "What are the action items?",
    layout: "list",
    instructions: `List every action item that was agreed or promised, one per sentence, each with newParagraph: true.
Format each as "Owner: what they will do (by when)", leaving out "(by when)" if no date was said. Use names as said; the note-taker is "You".
Cite the line where each commitment was made. If there are none, say so in one sentence with empty cites.`,
  },
  {
    id: "open-questions",
    label: "What's still open?",
    question: "What is still unresolved?",
    layout: "list",
    instructions: `List the questions, risks and decisions that were raised but not settled, one per sentence, each with newParagraph: true.
Be specific (who is waiting on what). Cite the lines where each was raised. If everything was settled, say so in one sentence with empty cites.`,
  },
];

export function getRecipe(id: string | undefined | null): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export const ASK_SYSTEM = `You answer questions about meetings using only their transcripts and the note-taker's rough notes.
Receipts are mandatory: every sentence that states a fact, number, date, name or commitment must list the transcript segment ids that support it in "cites", exactly as written in the transcript (like "s12" or "m2:s12"). If you cannot cite it, do not say it.
If the transcripts do not contain the answer, say so plainly in one sentence with an empty cites list.
Set newParagraph to true only where a new paragraph or list item should start.
Unless told otherwise, be brief: at most 3 short sentences.`;

export const answerSchema = z.object({
  sentences: z.array(
    z.object({
      cites: z.array(z.string()),
      text: z.string(),
      newParagraph: z.boolean(),
    }),
  ),
});

export interface AnswerSentence {
  text: string;
  cites: string[];
  newParagraph?: boolean;
}

/**
 * Server-side receipts check for answers: unknown cites are dropped, and a sentence left
 * without any receipt survives only if it is clearly not a claim (a greeting, a sign-off,
 * or "the transcript doesn't say"): short and free of figures.
 */
export function validateAnswer(
  raw: unknown,
  validIds: Set<string>,
): { sentences: AnswerSentence[]; dropped: number } {
  const input = (raw ?? {}) as { sentences?: unknown };
  const list = Array.isArray(input.sentences) ? input.sentences : [];
  let dropped = 0;
  const sentences: AnswerSentence[] = [];
  for (const s of list as { text?: unknown; cites?: unknown; newParagraph?: unknown }[]) {
    const text = typeof s?.text === "string" ? s.text.replace(/\s*\[[a-z0-9:]+\]/gi, "").trim() : "";
    if (!text) continue;
    const cites = Array.isArray(s.cites)
      ? [...new Set(s.cites.filter((c): c is string => typeof c === "string").map((c) => c.trim().replace(/^\[|\]$/g, "")))].filter(
          (c) => validIds.has(c),
        )
      : [];
    if (cites.length === 0) {
      const words = text.split(/\s+/).length;
      const claimy = /\d/.test(text) || words > 14;
      if (claimy) {
        dropped++;
        continue;
      }
    }
    sentences.push({ text, cites, ...(s.newParagraph === true ? { newParagraph: true } : {}) });
  }
  return { sentences, dropped };
}

export interface AskSegment {
  id: string;
  speaker: "you" | "them";
  label?: string;
  t: number;
  text: string;
}

export interface AskMeetingRef {
  ref: string;
  title: string;
  date: string;
  notes?: string;
}

function line(s: AskSegment) {
  return `[${s.id}] ${formatClock(s.t)} ${s.label || (s.speaker === "you" ? "You" : "Them")}: ${s.text.replace(/\s+/g, " ").trim()}`;
}

/** Transcript(s) for an ask. With several meetings, ids look like "m2:s14" and each meeting gets a header. */
export function askContext(opts: {
  userNotes?: string;
  segments: AskSegment[];
  meetings?: AskMeetingRef[];
  maxChars: number;
}): string {
  if (!opts.meetings?.length) {
    let t = opts.segments.map(line).join("\n");
    if (t.length > opts.maxChars) t = t.slice(0, opts.maxChars) + "\n[... transcript truncated ...]";
    return `<user_notes>\n${opts.userNotes?.trim() || "(none)"}\n</user_notes>\n\n<transcript>\n${t}\n</transcript>`;
  }
  const budget = Math.floor(opts.maxChars / opts.meetings.length);
  return opts.meetings
    .map((m) => {
      let t = opts.segments
        .filter((s) => s.id.startsWith(m.ref + ":"))
        .map(line)
        .join("\n");
      if (t.length > budget) t = t.slice(0, budget) + "\n[... truncated ...]";
      const notes = m.notes?.trim() ? `\nNotes: ${m.notes.trim().slice(0, 1500)}` : "";
      return `<meeting ref="${m.ref}" title="${m.title.replace(/"/g, "'")}" date="${m.date}">${notes}\n${t || "(no transcript)"}\n</meeting>`;
    })
    .join("\n\n");
}

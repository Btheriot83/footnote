import { contentTokens } from "./reconcile";
import type { Meeting } from "./types";

/**
 * Picks the meetings most likely to answer a question, for "Ask your meetings".
 * Plain keyword scoring over titles, notes, enhanced notes and transcripts; recent
 * meetings break ties (and fill in when nothing matches, e.g. "what did I promise?").
 */
export function rankMeetings(meetings: Meeting[], question: string, max = 5): Meeting[] {
  const q = contentTokens(question);
  const withTalk = meetings.filter((m) => m.segments.length > 0);
  const scored = withTalk.map((m) => {
    let score = 0;
    if (q.size) {
      const title = contentTokens(m.title);
      const body = contentTokens(
        [m.notes, ...m.segments.map((s) => s.text), ...(m.enhanced?.sections.flatMap((s) => s.bullets.map((b) => b.text)) ?? [])].join(" "),
      );
      for (const t of q) {
        if (title.has(t)) score += 3;
        if (body.has(t)) score += 1;
      }
    }
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score || b.m.createdAt - a.m.createdAt);
  return scored.slice(0, max).map((x) => x.m);
}

import cached from "./cached-asks.json";
import { SAMPLE_SEGMENTS } from "./index";
import type { Meeting } from "../types";

/**
 * Answers computed ahead of time for the sample call's recipes and the suggested
 * "Ask your meetings" questions. Shown (labeled "cached demo") only when the server
 * can't answer live: no hosted key and no key of your own, or today's allowance is used.
 */
export interface CachedSentence {
  text: string;
  cites: string[];
  newParagraph?: boolean;
}

const data = cached as {
  recipes: Record<string, CachedSentence[]>;
  askAll: { question: string; sentences: CachedSentence[] }[];
};

const sampleText = new Map(SAMPLE_SEGMENTS.map((s) => [s.id, s.text]));

/** The whole sample call, untouched: the only transcript the cached answers are true for. */
export function isFullSampleTranscript(m: Pick<Meeting, "isSample" | "segments">): boolean {
  return (
    !!m.isSample &&
    m.segments.length === SAMPLE_SEGMENTS.length &&
    m.segments.every((s) => sampleText.get(s.id) === s.text)
  );
}

export function cachedRecipe(m: Pick<Meeting, "isSample" | "segments">, recipeId: string | undefined): CachedSentence[] | null {
  if (!recipeId || !isFullSampleTranscript(m)) return null;
  return data.recipes[recipeId] ?? null;
}

export const CACHED_QUESTIONS = data.askAll.map((a) => a.question);

/**
 * A cached cross-meeting answer, with its sources resolved to meetings on this device.
 * Cites look like "sample:s4" or "ex_standup:s3"; every source meeting must still be here.
 */
export function cachedAskAll(
  question: string,
  meetings: Meeting[],
): { sentences: CachedSentence[]; refs: Map<string, Meeting> } | null {
  const hit = data.askAll.find((a) => a.question.toLowerCase() === question.trim().toLowerCase());
  if (!hit) return null;
  const refs = new Map<string, Meeting>();
  for (const s of hit.sentences) {
    for (const c of s.cites) {
      const key = c.split(":")[0];
      if (refs.has(key)) continue;
      const m =
        key === "sample"
          ? meetings.find((x) => isFullSampleTranscript(x))
          : meetings.find((x) => x.id === key && x.isExample);
      if (!m) return null;
      refs.set(key, m);
    }
  }
  return { sentences: hit.sentences, refs };
}

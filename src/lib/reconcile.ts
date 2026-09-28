import type { EnhancedBullet, EnhancedNotes } from "./types";

/**
 * Post-processing that keeps the "ink vs gray" promise honest, whatever the model does:
 * - a bullet that restates one of the user's own note lines is shown as theirs (ink),
 * - a bullet marked as the user's but matching none of their lines is shown as added (gray),
 * - a bullet that repeats an earlier one is folded into it (its receipts are kept).
 */

const STOP = new Set(
  "a an the and or but of to in on at for with by from as is are was were be been it its this that these those they them their we our you your i me my he she his her do does did so if then than about into over up down out not no yes just very really also will would can could should need needs want wants have has had get got per via vs".split(
    " ",
  ),
);

const SYNONYMS: Record<string, string> = {
  million: "m",
  mil: "m",
  thousand: "k",
  yr: "year",
  yrs: "year",
  years: "year",
  w: "with",
  mgr: "manager",
  mgrs: "manager",
  thurs: "thursday",
  thu: "thursday",
  fri: "friday",
  mon: "monday",
  tues: "tuesday",
  tue: "tuesday",
  wed: "wednesday",
  approx: "about",
};

export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  const words = text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/(\d),(\d)/g, "$1$2")
    // "$32M", "32 million" -> "32m"; "$90K", "90 thousand" -> "90k"
    .replace(/(\d+(?:\.\d+)?)\s*(m|mil|million|k|thousand)\b/g, (_, n: string, u: string) => n + (u[0] === "k" || u[0] === "t" ? "k" : "m"))
    .split(/[^a-z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  for (let w of words) {
    w = SYNONYMS[w] ?? w;
    if (STOP.has(w)) continue;
    if (!/\d/.test(w)) {
      if (w.length < 2) continue;
      // crude stemming: plurals and -ing/-ed forms
      w = w.replace(/(ies)$/, "y").replace(/(ing|ed)$/, "").replace(/s$/, "");
      if (w.length < 2) continue;
    }
    out.add(w);
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/** Lines of the user's rough notes that carry content (bullet markers stripped). */
export function noteLines(userNotes: string): Set<string>[] {
  return userNotes
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
    .map(contentTokens)
    .filter((t) => t.size > 0);
}

/** How much of the best-matching note line this bullet covers (0..1). */
export function noteCoverage(bullet: string, lines: Set<string>[]): number {
  const b = contentTokens(bullet);
  let best = 0;
  for (const line of lines) {
    // Tiny lines ("acme") would match anything; require some substance.
    if (line.size < 2) continue;
    best = Math.max(best, overlap(line, b) / line.size);
  }
  return best;
}

/**
 * True when a bullet is essentially one of the user's lines, written out: it covers most of
 * that line and adds little beyond it. Bullets that add real detail stay "added".
 */
export function restatesNote(bullet: string, lines: Set<string>[]): boolean {
  const b = contentTokens(bullet);
  for (const line of lines) {
    if (line.size < 2) continue;
    const inter = overlap(line, b);
    if (inter / line.size >= 0.7 && b.size - inter <= line.size + 2) return true;
  }
  return false;
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const inter = overlap(a, b);
  // Overlap coefficient: a short bullet fully contained in a longer one is a repeat.
  return inter / Math.min(a.size, b.size);
}

/** Same fact twice: near-identical wording, or the same figures in similar words. */
function isRepeat(a: Set<string>, b: Set<string>): boolean {
  if (a.size < 3 || b.size < 3) return false;
  const sim = similarity(a, b);
  if (sim >= 0.8) return true;
  if (sim >= 0.7 && Math.min(a.size, b.size) >= 4) return true;
  const sharedNumbers = [...a].filter((t) => /\d/.test(t) && b.has(t)).length;
  return sharedNumbers >= 2 && sim >= 0.6;
}

export interface ReconcileReport {
  toYou: number;
  toAi: number;
  merged: number;
}

export function reconcileOrigins<T extends EnhancedNotes>(notes: T, userNotes: string, report?: ReconcileReport): T {
  const lines = noteLines(userNotes);
  if (!lines.length) {
    // No notes at all: nothing can be the user's.
    return {
      ...notes,
      sections: notes.sections.map((s) => ({
        ...s,
        bullets: s.bullets.map((b) => {
          if (b.origin === "you" && b.cites.length) {
            if (report) report.toAi++;
            return { ...b, origin: "ai" as const };
          }
          return b;
        }),
      })),
    };
  }
  return {
    ...notes,
    sections: notes.sections.map((s) => ({
      ...s,
      bullets: s.bullets.map((b) => {
        if (b.origin === "ai" && restatesNote(b.text, lines)) {
          if (report) report.toYou++;
          return { ...b, origin: "you" as const };
        }
        if (b.origin === "you" && b.cites.length > 0 && noteCoverage(b.text, lines) < 0.2) {
          if (report) report.toAi++;
          return { ...b, origin: "ai" as const };
        }
        return b;
      }),
    })),
  };
}

/**
 * Folds near-duplicate bullets into the first occurrence. A "you" duplicate wins over an
 * "ai" one (the user's point keeps its place); cites are merged either way.
 */
export function dedupeBullets<T extends EnhancedNotes>(notes: T, report?: ReconcileReport): T {
  type Slot = { tokens: Set<string>; bullet: EnhancedBullet; home: EnhancedBullet[] };
  const slots: Slot[] = [];
  const built = notes.sections.map((s) => ({ ...s, bullets: [] as EnhancedBullet[] }));
  notes.sections.forEach((s, si) => {
    const home = built[si].bullets;
    for (const b of s.bullets) {
      const tokens = contentTokens(b.text);
      const dup = slots.find((x) => isRepeat(x.tokens, tokens));
      if (!dup) {
        const copy = { ...b, cites: [...b.cites] };
        home.push(copy);
        slots.push({ tokens, bullet: copy, home });
        continue;
      }
      if (report) report.merged++;
      const cites = [...dup.bullet.cites, ...b.cites.filter((c) => !dup.bullet.cites.includes(c))];
      // The user's own point wins; otherwise the fuller wording wins, in its own place.
      const better =
        (b.origin === "you" && dup.bullet.origin === "ai") || (b.origin === dup.bullet.origin && tokens.size > dup.tokens.size);
      if (better) {
        dup.home.splice(dup.home.indexOf(dup.bullet), 1);
        const moved = { ...b, cites };
        home.push(moved);
        Object.assign(dup, { tokens, bullet: moved, home });
      } else {
        dup.bullet.cites = cites;
      }
    }
  });
  return { ...notes, sections: built.filter((s) => s.bullets.length > 0) };
}

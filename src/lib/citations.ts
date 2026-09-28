import type { EnhancedBullet, EnhancedNotes, EnhancedSection, Origin } from "./types";

type Loose<T> = { [K in keyof T]?: unknown };

export interface ValidationReport {
  droppedCites: number;
  droppedBullets: number;
}

function cleanCites(cites: unknown, valid: Set<string>, report?: ValidationReport): string[] {
  if (!Array.isArray(cites)) return [];
  const out: string[] = [];
  for (const c of cites) {
    if (typeof c !== "string") continue;
    const id = c.trim().replace(/^\[|\]$/g, "");
    if (!valid.has(id)) {
      if (report) report.droppedCites++;
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function cleanText(text: string): string {
  // Models sometimes echo markers like "[s4]" or "^1" into the text.
  return text
    .replace(/\s*\[\^?s?\d+\]/g, "")
    .replace(/\s*\^\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOrigin(o: unknown): Origin {
  return o === "you" ? "you" : "ai";
}

/**
 * Final server-side validation of an enhancement:
 * - drops cites that don't match a transcript segment id (and duplicates)
 * - drops AI bullets left with no valid citation (no receipt, no claim)
 * - drops empty bullets and empty sections
 */
export function validateEnhanced(
  raw: unknown,
  validIds: Iterable<string>,
): { notes: EnhancedNotes; report: ValidationReport } {
  const valid = new Set(validIds);
  const report: ValidationReport = { droppedCites: 0, droppedBullets: 0 };
  const input = (raw ?? {}) as Loose<EnhancedNotes>;
  const sections: EnhancedSection[] = [];
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  for (const s of rawSections as Loose<EnhancedSection>[]) {
    const heading = typeof s?.heading === "string" ? s.heading.trim() : "";
    const bullets: EnhancedBullet[] = [];
    const rawBullets = Array.isArray(s?.bullets) ? s.bullets : [];
    for (const b of rawBullets as Loose<EnhancedBullet>[]) {
      const text = typeof b?.text === "string" ? cleanText(b.text) : "";
      if (!text) {
        report.droppedBullets++;
        continue;
      }
      const origin = normalizeOrigin(b?.origin);
      const cites = cleanCites(b?.cites, valid, report);
      if (origin === "ai" && cites.length === 0) {
        report.droppedBullets++;
        continue;
      }
      bullets.push({ text, origin, cites });
    }
    if (heading && bullets.length) sections.push({ heading, bullets });
  }
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 80) : undefined;
  return { notes: { ...(title ? { title } : {}), sections }, report };
}

/**
 * Sanitizes a partial (still streaming) object for display. Bullets are only
 * shown once their `text` has started streaming; because `cites` precede `text`
 * in the schema, the cite list is complete by then and can be validated.
 */
export function sanitizePartial(partial: unknown, validIds: Set<string>): EnhancedNotes {
  const input = (partial ?? {}) as Loose<EnhancedNotes>;
  const sections: EnhancedSection[] = [];
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  for (const s of rawSections as Loose<EnhancedSection>[]) {
    if (!s || typeof s.heading !== "string") continue;
    const bullets: EnhancedBullet[] = [];
    const rawBullets = Array.isArray(s.bullets) ? s.bullets : [];
    for (const b of rawBullets as Loose<EnhancedBullet>[]) {
      if (!b || typeof b.text !== "string" || !b.text.trim()) continue;
      const origin = normalizeOrigin(b.origin);
      const cites = cleanCites(b.cites, validIds);
      if (origin === "ai" && cites.length === 0) continue;
      bullets.push({ text: b.text.replace(/\s*\[\^?s?\d*\]?$/, ""), origin, cites });
    }
    sections.push({ heading: s.heading, bullets });
  }
  const title = typeof input.title === "string" ? input.title : undefined;
  return { ...(title ? { title } : {}), sections };
}

/** Assigns footnote numbers to cited segments in order of first appearance. */
export function numberFootnotes(notes: EnhancedNotes | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!notes) return map;
  for (const s of notes.sections) {
    for (const b of s.bullets) {
      for (const c of b.cites) {
        if (!map.has(c)) map.set(c, map.size + 1);
      }
    }
  }
  return map;
}

/** Which bullets (by "sectionIndex:bulletIndex" key) cite a given segment. */
export function citingBullets(
  notes: EnhancedNotes | null | undefined,
  segmentId: string,
): { key: string; text: string; heading: string }[] {
  const out: { key: string; text: string; heading: string }[] = [];
  if (!notes) return out;
  notes.sections.forEach((s, si) =>
    s.bullets.forEach((b, bi) => {
      if (b.cites.includes(segmentId)) out.push({ key: `${si}:${bi}`, text: b.text, heading: s.heading });
    }),
  );
  return out;
}

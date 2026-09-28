import { describe, expect, it } from "vitest";
import { validateEnhanced } from "@/lib/citations";
import { contentTokens, dedupeBullets, reconcileOrigins, restatesNote, noteLines } from "@/lib/reconcile";
import cached from "@/lib/sample/cached-enhancement.json";
import { SAMPLE_DEFAULT_NOTES, SAMPLE_SEGMENTS } from "@/lib/sample";
import type { EnhancedNotes } from "@/lib/types";

const notes = "- series B closed, $32M, hiring fast\n- seats 40 -> ~120 by march\n- contract ends 30th";

describe("contentTokens", () => {
  it("normalizes money, shorthand and plurals", () => {
    expect([...contentTokens("$32M, led by Northstar")]).toEqual(expect.arrayContaining(["32m", "northstar"]));
    expect(contentTokens("32 million")).toEqual(contentTokens("$32M"));
    expect(contentTokens("seats")).toEqual(contentTokens("seat"));
  });
});

describe("reconcileOrigins", () => {
  it("shows a restated note line in ink even if the model marked it as added", () => {
    const out = reconcileOrigins(
      { sections: [{ heading: "Deal", bullets: [{ text: "Their contract ends on the 30th.", origin: "ai", cites: ["s20"] }] }] },
      notes,
    );
    expect(out.sections[0].bullets[0].origin).toBe("you");
  });

  it("keeps bullets that add real detail gray", () => {
    const lines = noteLines(notes);
    expect(restatesNote("The round was $32M, led by Northstar, and they plan to double support by spring.", lines)).toBe(false);
  });

  it("moves a 'you' bullet that matches none of the user's lines to gray", () => {
    const out = reconcileOrigins(
      { sections: [{ heading: "Security", bullets: [{ text: "Marcus runs the SOC 2 review with Okta SSO.", origin: "you", cites: ["s15"] }] }] },
      notes,
    );
    expect(out.sections[0].bullets[0].origin).toBe("ai");
  });

  it("with no notes at all, nothing cited is the user's", () => {
    const out = reconcileOrigins({ sections: [{ heading: "A", bullets: [{ text: "Something said.", origin: "you", cites: ["s1"] }] }] }, "");
    expect(out.sections[0].bullets[0].origin).toBe("ai");
  });
});

describe("dedupeBullets", () => {
  it("folds a repeated fact into the first bullet and keeps both receipts", () => {
    const input: EnhancedNotes = {
      sections: [
        { heading: "Where they are", bullets: [{ text: "Team is growing from 40 to about 120 seats by March.", origin: "ai", cites: ["s6"] }] },
        {
          heading: "What they need",
          bullets: [
            { text: "Seats grow from 40 to ~120 by March.", origin: "you", cites: ["s5", "s6"] },
            { text: "About 20 managers only need dashboards.", origin: "ai", cites: ["s8"] },
          ],
        },
      ],
    };
    const out = dedupeBullets(input);
    const all = out.sections.flatMap((s) => s.bullets);
    expect(all).toHaveLength(2);
    expect(all[0].origin).toBe("you");
    expect(all[0].cites).toEqual(["s6", "s5"]);
    // The user's version keeps its own section; the emptied section disappears.
    expect(out.sections.map((s) => s.heading)).toEqual(["What they need"]);
  });

  it("never merges unrelated short bullets", () => {
    const out = dedupeBullets({
      sections: [
        {
          heading: "Next steps",
          bullets: [
            { text: "Send two pricing options by Thursday.", origin: "you", cites: ["s18"] },
            { text: "Send the SOC 2 report by Thursday.", origin: "ai", cites: ["s19"] },
          ],
        },
      ],
    });
    expect(out.sections[0].bullets).toHaveLength(2);
  });
});

describe("validateEnhanced with notes", () => {
  it("keeps the sample enhancement free of repeats and in the right ink", () => {
    const { notes: out } = validateEnhanced(cached, SAMPLE_SEGMENTS.map((s) => s.id), { userNotes: SAMPLE_DEFAULT_NOTES });
    const texts = out.sections.flatMap((s) => s.bullets.map((b) => contentTokens(b.text)));
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const inter = [...texts[i]].filter((t) => texts[j].has(t)).length;
        expect(inter / Math.min(texts[i].size, texts[j].size)).toBeLessThan(0.8);
      }
  });
});

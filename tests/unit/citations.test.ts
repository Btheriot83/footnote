import { describe, expect, it } from "vitest";
import { citingBullets, numberFootnotes, sanitizePartial, validateEnhanced } from "@/lib/citations";
import { toMarkdown } from "@/lib/export";
import { buildSharePayload, decodeShare, encodeShare } from "@/lib/share";

const ids = ["s1", "s2", "s3", "s4"];

describe("validateEnhanced", () => {
  it("keeps valid cites and drops ones that aren't in the transcript", () => {
    const { notes, report } = validateEnhanced(
      {
        title: "Renewal",
        sections: [
          { heading: "Pricing", bullets: [{ origin: "ai", cites: ["s2", "s9", "s2"], text: "Needs year one under $90K." }] },
        ],
      },
      ids,
    );
    expect(notes.sections[0].bullets[0].cites).toEqual(["s2"]);
    expect(report.droppedCites).toBe(1);
  });

  it("drops AI bullets that end up with no receipt", () => {
    const { notes, report } = validateEnhanced(
      {
        sections: [
          {
            heading: "Next steps",
            bullets: [
              { origin: "ai", cites: ["s99"], text: "An invented commitment." },
              { origin: "ai", cites: [], text: "Another unsupported claim." },
              { origin: "you", cites: [], text: "My own point stays." },
            ],
          },
        ],
      },
      ids,
    );
    expect(notes.sections[0].bullets.map((b) => b.text)).toEqual(["My own point stays."]);
    expect(report.droppedBullets).toBe(2);
  });

  it("removes empty sections and strips citation markers echoed into text", () => {
    const { notes } = validateEnhanced(
      {
        sections: [
          { heading: "Empty", bullets: [{ origin: "ai", cites: ["nope"], text: "x" }] },
          { heading: "Where they are", bullets: [{ origin: "you", cites: ["s1"], text: "Closed a Series B [s1] ^1" }] },
        ],
      },
      ids,
    );
    expect(notes.sections).toHaveLength(1);
    expect(notes.sections[0].bullets[0].text).toBe("Closed a Series B");
  });

  it("tolerates garbage input", () => {
    expect(validateEnhanced(null, ids).notes.sections).toEqual([]);
    expect(validateEnhanced({ sections: "nope" }, ids).notes.sections).toEqual([]);
    expect(validateEnhanced({ sections: [{ heading: 3, bullets: [null] }] }, ids).notes.sections).toEqual([]);
  });

  it("normalizes unknown origins to ai (so they still need a receipt)", () => {
    const { notes } = validateEnhanced(
      { sections: [{ heading: "H", bullets: [{ origin: "robot", cites: [], text: "No source" }] }] },
      ids,
    );
    expect(notes.sections).toEqual([]);
  });
});

describe("sanitizePartial", () => {
  it("hides bullets until their text starts streaming, and validates cites", () => {
    const valid = new Set(ids);
    const out = sanitizePartial(
      {
        sections: [
          {
            heading: "Pricing",
            bullets: [
              { origin: "ai", cites: ["s1", "s7"], text: "A multi-year term lowers the price" },
              { origin: "ai", cites: ["s"] },
            ],
          },
        ],
      },
      valid,
    );
    expect(out.sections[0].bullets).toHaveLength(1);
    expect(out.sections[0].bullets[0].cites).toEqual(["s1"]);
  });
});

describe("numberFootnotes / citingBullets", () => {
  const notes = {
    sections: [
      { heading: "A", bullets: [{ origin: "you" as const, cites: ["s3", "s1"], text: "one" }] },
      { heading: "B", bullets: [{ origin: "ai" as const, cites: ["s1", "s4"], text: "two" }] },
    ],
  };

  it("numbers sources in order of first appearance and reuses numbers", () => {
    const n = numberFootnotes(notes);
    expect([...n.entries()]).toEqual([
      ["s3", 1],
      ["s1", 2],
      ["s4", 3],
    ]);
  });

  it("finds which bullets cite a transcript line", () => {
    expect(citingBullets(notes, "s1").map((b) => b.key)).toEqual(["0:0", "1:0"]);
    expect(citingBullets(notes, "s2")).toEqual([]);
  });
});

describe("export and share", () => {
  const meeting = {
    title: "Acme renewal",
    template: "sales" as const,
    createdAt: Date.UTC(2026, 8, 29, 15),
    durationMs: 140000,
    notes: "- pricing pushback",
    segments: [
      { id: "s1", speaker: "them" as const, label: "Dana (Acme)", t: 50000, text: 'At $65 a seat, it\'s a "big" jump.' },
      { id: "s2", speaker: "you" as const, label: "You", t: 61000, text: "A multi-year term brings it down." },
    ],
    enhanced: {
      sections: [{ heading: "Pricing", bullets: [{ origin: "ai" as const, cites: ["s2", "s1"], text: "Multi-year lowers price" }] }],
    },
  };

  it("renders markdown footnotes that quote the transcript", () => {
    const md = toMarkdown(meeting);
    expect(md).toContain("- _Multi-year lowers price_[^1][^2]");
    expect(md).toContain('[^1]: You, 01:01: "A multi-year term brings it down."');
    expect(md).toContain("[^2]: Dana (Acme), 00:50:");
  });

  it("round-trips a share payload through the URL fragment", () => {
    const payload = buildSharePayload(meeting, { fullTranscript: false, includeNotes: false });
    expect(payload.segments.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    const decoded = decodeShare("#" + encodeShare(payload));
    expect(decoded?.title).toBe("Acme renewal");
    expect(decoded?.enhanced?.sections[0].bullets[0].cites).toEqual(["s2", "s1"]);
    expect(decodeShare("#garbage")).toBeNull();
    expect(payload.sample).toBeUndefined();
    expect(buildSharePayload({ ...meeting, isSample: true }, { fullTranscript: true, includeNotes: false }).sample).toBe(true);
  });
});

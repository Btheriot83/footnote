import { describe, expect, it } from "vitest";
import { askContext, validateAnswer } from "@/lib/ask";
import { rankMeetings } from "@/lib/rank";
import type { Meeting } from "@/lib/types";

const valid = new Set(["s1", "s2", "m1:s4"]);

describe("validateAnswer", () => {
  it("keeps receipts that exist and drops ones that don't", () => {
    const { sentences } = validateAnswer(
      { sentences: [{ text: "They need year one under $90K.", cites: ["s2", "s9", "s2"], newParagraph: false }] },
      valid,
    );
    expect(sentences).toEqual([{ text: "They need year one under $90K.", cites: ["s2"] }]);
  });

  it("drops uncited claims but keeps greetings and sign-offs", () => {
    const { sentences, dropped } = validateAnswer(
      {
        sentences: [
          { text: "Hi Dana,", cites: [], newParagraph: false },
          { text: "You agreed to a 40% discount.", cites: ["s77"], newParagraph: true },
          { text: "Thanks again,", cites: [], newParagraph: true },
        ],
      },
      valid,
    );
    expect(sentences.map((s) => s.text)).toEqual(["Hi Dana,", "Thanks again,"]);
    expect(sentences[1].newParagraph).toBe(true);
    expect(dropped).toBe(1);
  });

  it("accepts cross-meeting ids and strips echoed markers", () => {
    const { sentences } = validateAnswer({ sentences: [{ text: "Closed a Series B [m1:s4]", cites: ["m1:s4"], newParagraph: false }] }, valid);
    expect(sentences[0]).toEqual({ text: "Closed a Series B", cites: ["m1:s4"] });
  });

  it("tolerates garbage", () => {
    expect(validateAnswer(null, valid).sentences).toEqual([]);
    expect(validateAnswer({ sentences: [null, { text: 4 }] }, valid).sentences).toEqual([]);
  });
});

const meeting = (id: string, title: string, text: string, createdAt: number): Meeting => ({
  id,
  title,
  template: "general",
  createdAt,
  updatedAt: createdAt,
  durationMs: 1000,
  status: "ended",
  notes: "",
  segments: [{ id: "s1", speaker: "them", t: 0, text }],
  enhanced: null,
});

describe("rankMeetings", () => {
  const ms = [
    meeting("a", "Design standup", "The onboarding flow is blocked on copy.", 3),
    meeting("b", "Acme renewal", "We need year one under $90K for the renewal.", 2),
    meeting("c", "Weekly 1:1", "Let's talk about the promotion.", 1),
  ];
  it("puts the meeting that mentions the question first", () => {
    expect(rankMeetings(ms, "Where does the Acme renewal stand?")[0].id).toBe("b");
    expect(rankMeetings(ms, "who is blocked?")[0].id).toBe("a");
  });
  it("falls back to the most recent meetings", () => {
    expect(rankMeetings(ms, "what did I promise?", 2).map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("askContext", () => {
  it("groups segments by meeting", () => {
    const ctx = askContext({
      segments: [
        { id: "m1:s1", speaker: "you", t: 0, text: "Hello" },
        { id: "m2:s1", speaker: "them", t: 1000, text: "Hi" },
      ],
      meetings: [
        { ref: "m1", title: "One", date: "Mon" },
        { ref: "m2", title: "Two", date: "Tue" },
      ],
      maxChars: 10000,
    });
    expect(ctx).toContain('<meeting ref="m1" title="One"');
    expect(ctx).toContain("[m2:s1] 00:01 Them: Hi");
  });
});

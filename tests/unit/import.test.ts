import { describe, expect, it } from "vitest";
import { parseClock, parseTranscript, sentencesAcross, splitSpeaker, titleFromFile } from "@/lib/import";

describe("parseClock", () => {
  it("reads VTT, SRT and short clocks", () => {
    expect(parseClock("00:01:02.500")).toBe(62500);
    expect(parseClock("00:01:02,5")).toBe(62500);
    expect(parseClock("1:02")).toBe(62000);
    expect(parseClock("1:02:03")).toBe(3723000);
    expect(parseClock("nope")).toBeNull();
  });
});

describe("splitSpeaker", () => {
  it("takes a name before a colon, but not a label or a sentence", () => {
    expect(splitSpeaker("Dana Smith: we closed")).toEqual({ speaker: "Dana Smith", text: "we closed" });
    expect(splitSpeaker("Note: bring the SOC 2 report")).toEqual({ text: "Note: bring the SOC 2 report" });
    expect(splitSpeaker("Plain words with no speaker")).toEqual({ text: "Plain words with no speaker" });
  });
});

describe("parseTranscript", () => {
  it("reads a Zoom VTT, folding a speaker's caption fragments together", () => {
    const vtt = `WEBVTT

1
00:00:15.910 --> 00:00:18.000
Dana Smith: Right, we closed our Series B

2
00:00:18.100 --> 00:00:22.320
Dana Smith: two weeks ago. $32 million, led by Northstar.

3
00:00:22.700 --> 00:00:26.270
Brandon: Congratulations!`;
    const r = parseTranscript("GMT20260928-150000_Recording.transcript.vtt", vtt, { me: "Brandon" });
    expect(r.format).toBe("vtt");
    expect(r.speakers).toEqual(["Dana Smith", "Brandon"]);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toMatchObject({ id: "s1", speaker: "them", label: "Dana Smith", t: 15910 });
    expect(r.segments[0].text).toBe("Right, we closed our Series B two weeks ago. $32 million, led by Northstar.");
    expect(r.segments[1]).toMatchObject({ id: "s2", speaker: "you", label: "You", t: 22700 });
    expect(r.durationMs).toBe(26270);
    expect(r.estimated).toBe(false);
  });

  it("reads Teams voice tags", () => {
    const vtt = `WEBVTT

0b1c/12-0
00:00:03.000 --> 00:00:06.500
<v Priya Shah>Brightline closed with 42 seats.</v>`;
    const r = parseTranscript("meeting.vtt", vtt);
    expect(r.segments[0]).toMatchObject({ label: "Priya Shah", t: 3000, text: "Brightline closed with 42 seats." });
  });

  it("reads SRT with comma milliseconds", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Sam: Let's lock the launch for Friday.

2
00:00:05,000 --> 00:00:07,000
Maya: I'm blocked on copy.`;
    const r = parseTranscript("call.srt", srt);
    expect(r.format).toBe("srt");
    expect(r.segments.map((s) => [s.label, s.t])).toEqual([
      ["Sam", 1000],
      ["Maya", 5000],
    ]);
  });

  it("reads plain text with bracketed times, and Otter-style headers", () => {
    const a = parseTranscript("notes.txt", "[00:00:05] Dana: Hello there.\n[00:01:10] Sam: Hi Dana.");
    expect(a.segments.map((s) => [s.label, s.t, s.text])).toEqual([
      ["Dana", 5000, "Hello there."],
      ["Sam", 70000, "Hi Dana."],
    ]);
    const b = parseTranscript("otter.txt", "Dana Smith  0:05\nWe closed our Series B.\n\nSam Lee  0:12\nCongrats!\nHow many seats?");
    expect(b.segments.map((s) => [s.label, s.t, s.text])).toEqual([
      ["Dana Smith", 5000, "We closed our Series B."],
      ["Sam Lee", 12000, "Congrats! How many seats?"],
    ]);
  });

  it("estimates times when a transcript has none", () => {
    const r = parseTranscript("t.txt", "Dana: one two three four five six seven eight nine ten.\nSam: ok.");
    expect(r.estimated).toBe(true);
    expect(r.segments[0].t).toBe(0);
    expect(r.segments[1].t).toBe(4000);
  });
});

describe("titleFromFile", () => {
  it("drops Zoom's prefix and the extension", () => {
    expect(titleFromFile("GMT20260928-150000_Acme_renewal.vtt")).toBe("Acme renewal");
    expect(titleFromFile("123.txt")).toBe("Imported meeting");
  });
});

describe("sentencesAcross", () => {
  it("spreads a chunk's sentences across its time by length", () => {
    const s = sentencesAcross("We closed our Series B. It was led by Northstar and it was big.", 20000, 10000);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ t: 20000, text: "We closed our Series B." });
    expect(s[1].t).toBeGreaterThan(22000);
    expect(s[1].t).toBeLessThan(26000);
  });
});

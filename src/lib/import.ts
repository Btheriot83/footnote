import type { Segment } from "./types";

/**
 * Reads transcripts exported from Zoom, Google Meet, Teams, Otter and friends (WebVTT,
 * SubRip or plain text) into Footnote's segments, keeping who spoke and when, so an
 * imported meeting gets receipts like a recorded one.
 */

export interface ParsedTranscript {
  segments: Segment[];
  /** Distinct speaker names, in order of first appearance. */
  speakers: string[];
  durationMs: number;
  /** No timestamps in the file: times were estimated from the words (about 150 a minute). */
  estimated: boolean;
  format: "vtt" | "srt" | "txt";
}

interface Cue {
  t: number;
  end?: number;
  speaker?: string;
  text: string;
}

const WPM_MS = 60000 / 150;

/** "01:02:03.456", "02:03,4", "2:03", "1:02:03" -> ms. */
export function parseClock(raw: string): number | null {
  const m = raw.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const [, h, mi, s, frac] = m;
  const ms = frac ? Number(frac.padEnd(3, "0")) : 0;
  return ((Number(h || 0) * 60 + Number(mi)) * 60 + Number(s)) * 1000 + ms;
}

const TIME = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
const ARROW = new RegExp(String.raw`^\s*(${TIME})\s*-->\s*(${TIME})`);

/** "Dana Smith: we closed" -> speaker + text. Names are short and don't look like sentences. */
export function splitSpeaker(line: string): { speaker?: string; text: string } {
  const m = line.match(/^\s*([^:.!?\n]{1,48}?)\s*:\s+(.+)$/);
  if (!m) return { text: line.trim() };
  const name = m[1].trim();
  // "Note: this", "Q3 plan: ..." are not people; people have at most 5 words and start with a capital or letter.
  if (name.split(/\s+/).length > 5 || /^(note|update|todo|action|q\d|re|fyi|ps)$/i.test(name) || /\d{2}/.test(name)) {
    return { text: line.trim() };
  }
  return { speaker: name, text: m[2].trim() };
}

function stripTags(s: string): string {
  return s
    .replace(/<\/?(?:c|i|b|u|lang|ruby|rt)(?:\.[^>]*)?[^>]*>/g, "")
    .replace(/<\d{1,2}:\d{2}[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseCueBody(lines: string[]): { speaker?: string; text: string } {
  const joined = lines.join(" ").trim();
  // WebVTT voice tags (Teams): <v Dana Smith>text</v>
  const v = joined.match(/^<v(?:\.[^\s>]*)?\s+([^>]+)>([\s\S]*?)(?:<\/v>)?$/);
  if (v) return { speaker: v[1].trim(), text: stripTags(v[2]).replace(/\s+/g, " ").trim() };
  const clean = stripTags(joined).replace(/\s+/g, " ").trim();
  // Zoom and many SRT files: "Dana Smith: text"
  return splitSpeaker(clean);
}

function parseTimed(text: string): Cue[] {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const i = lines.findIndex((l) => ARROW.test(l));
    if (i < 0) continue;
    const m = lines[i].match(ARROW)!;
    const t = parseClock(m[1]);
    const end = parseClock(m[2]);
    const body = parseCueBody(lines.slice(i + 1));
    if (t === null || !body.text) continue;
    cues.push({ t, end: end ?? undefined, speaker: body.speaker, text: body.text });
  }
  return cues;
}

/**
 * Plain text. Understands, line by line:
 *   [00:01:23] Dana: text   ·   00:01:23 Dana: text   ·   Dana (00:01:23): text
 *   Dana  0:05 / 00:00:05 on its own line, with the words on the lines after it (Otter, Meet)
 *   Dana: text              (no times: estimated from the words)
 *   plain paragraphs        (one speaker, estimated)
 */
function parseText(text: string): { cues: Cue[]; estimated: boolean } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cues: Cue[] = [];
  let pending: { speaker?: string; t: number | null } | null = null;
  let buf: string[] = [];
  let anyTime = false;
  const flush = () => {
    if (pending && buf.length) {
      const joined = buf.join(" ").replace(/\s+/g, " ").trim();
      const sp = pending.speaker ? { speaker: pending.speaker, text: joined } : splitSpeaker(joined);
      cues.push({ t: pending.t ?? -1, speaker: sp.speaker, text: sp.text });
    }
    pending = null;
    buf = [];
  };
  const T = String.raw`\[?(${TIME})\]?`;
  const lead = new RegExp(String.raw`^\s*${T}\s*[-–—]?\s*(.*)$`);
  const trail = new RegExp(String.raw`^\s*([^:\[\]()]{1,48}?)\s*[\[(]\s*(${TIME})\s*[\])]\s*:?\s*(.*)$`);
  const header = new RegExp(String.raw`^\s*([^:\[\]()\d][^:\[\]()]{0,47}?)\s+[\[(]?(${TIME})[\])]?\s*$`);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // A blank line ends a block only for header-style transcripts.
      if (pending && buf.length && pending.t !== null) flush();
      continue;
    }
    let m = line.match(lead);
    if (m) {
      flush();
      anyTime = true;
      const rest = splitSpeaker(m[2]);
      if (rest.text) cues.push({ t: parseClock(m[1])!, speaker: rest.speaker, text: rest.text });
      else pending = { t: parseClock(m[1]), speaker: rest.speaker };
      continue;
    }
    m = line.match(trail);
    if (m && m[3]) {
      flush();
      anyTime = true;
      cues.push({ t: parseClock(m[2])!, speaker: m[1].trim(), text: m[3].trim() });
      continue;
    }
    m = line.match(header);
    if (m && m[1].split(/\s+/).length <= 5) {
      flush();
      anyTime = true;
      pending = { speaker: m[1].trim(), t: parseClock(m[2]) };
      continue;
    }
    if (pending) {
      buf.push(line);
      continue;
    }
    const sp = splitSpeaker(line);
    if (sp.speaker) cues.push({ t: -1, speaker: sp.speaker, text: sp.text });
    else if (cues.length && cues[cues.length - 1].t === -1 && !cues[cues.length - 1].speaker) cues[cues.length - 1].text += " " + sp.text;
    else cues.push({ t: -1, text: sp.text });
  }
  flush();
  // Fill in times that weren't given, from the words spoken before them.
  let clock = 0;
  for (const c of cues) {
    if (c.t >= 0) clock = c.t;
    else c.t = clock;
    clock += Math.max(1500, c.text.split(/\s+/).length * WPM_MS);
  }
  return { cues, estimated: !anyTime };
}

/** Folds a speaker's back-to-back caption fragments into sentences you can cite. */
function mergeCues(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const prev = out[out.length - 1];
    const gap = prev ? c.t - (prev.end ?? prev.t) : Infinity;
    const endsSentence = prev ? /[.!?…]["”')\]]?$/.test(prev.text) : true;
    if (prev && prev.speaker === c.speaker && gap < 1500 && prev.text.length + c.text.length < 280 && (!endsSentence || prev.text.length < 40)) {
      prev.text = `${prev.text} ${c.text}`;
      prev.end = c.end ?? prev.end;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

export function detectFormat(name: string, text: string): ParsedTranscript["format"] {
  if (/^﻿?WEBVTT/.test(text) || /\.vtt$/i.test(name)) return "vtt";
  if (/\.srt$/i.test(name) || /^\s*\d+\s*\n\s*\d{1,2}:\d{2}:\d{2},\d{3}\s*-->/.test(text)) return "srt";
  return "txt";
}

/** Speakers the user might be ("You" in the notes); the rest are "them". */
export function parseTranscript(name: string, text: string, opts?: { me?: string | null }): ParsedTranscript {
  const format = detectFormat(name, text);
  let cues: Cue[];
  let estimated = false;
  if (format === "txt") {
    const r = parseText(text);
    cues = r.cues;
    estimated = r.estimated;
  } else {
    cues = parseTimed(text);
  }
  cues = mergeCues(cues.filter((c) => c.text)).sort((a, b) => a.t - b.t);
  const speakers: string[] = [];
  for (const c of cues) if (c.speaker && !speakers.includes(c.speaker)) speakers.push(c.speaker);
  const me = opts?.me ?? null;
  const segments: Segment[] = cues.map((c, i) => {
    const isMe = !!me && c.speaker === me;
    return {
      id: `s${i + 1}`,
      speaker: isMe ? "you" : "them",
      label: isMe ? "You" : c.speaker || undefined,
      t: Math.max(0, Math.round(c.t)),
      text: c.text,
    };
  });
  const last = cues[cues.length - 1];
  const durationMs = last ? Math.round(last.end ?? last.t + Math.max(1500, last.text.split(/\s+/).length * WPM_MS)) : 0;
  return { segments, speakers, durationMs, estimated, format };
}

/** A title from a file name: "GMT20260928-Acme_renewal.vtt" -> "Acme renewal". */
export function titleFromFile(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const cleaned = base
    .replace(/^GMT\d{8}-\d{6}_?/i, "")
    .replace(/^(zoom|meet|teams|otter|transcript|recording)[-_ ]*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && !/^\d+$/.test(cleaned) ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "Imported meeting";
}

/**
 * Splits one chunk's transcribed text into sentences with times spread across the chunk by
 * length, so receipts from an imported recording point near the right second.
 */
export function sentencesAcross(text: string, startMs: number, durationMs: number): { t: number; text: string }[] {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?…]+(?:[.!?…]+["”')\]]?|$)/g)
    ?.map((p) => p.trim())
    .filter(Boolean);
  if (!parts?.length) return [];
  // Keep very short fragments with their neighbour.
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && (p.length < 18 || merged[merged.length - 1].length < 18)) merged[merged.length - 1] += " " + p;
    else merged.push(p);
  }
  const total = merged.reduce((n, p) => n + p.length, 0) || 1;
  let acc = 0;
  return merged.map((p) => {
    const t = startMs + Math.round((acc / total) * durationMs);
    acc += p.length;
    return { t, text: p };
  });
}

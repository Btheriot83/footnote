import { numberFootnotes } from "./citations";
import { formatClock, formatDate, formatDuration } from "./format";
import { getTemplate } from "./templates";
import type { EnhancedNotes, Segment, TemplateId } from "./types";

export interface ExportableMeeting {
  title: string;
  template: TemplateId;
  createdAt: number;
  durationMs: number;
  notes: string;
  segments: Segment[];
  enhanced: EnhancedNotes | null;
}

function speakerName(s: Segment): string {
  return s.label || (s.speaker === "you" ? "You" : "Them");
}

function metaLine(m: ExportableMeeting): string {
  const parts = [formatDate(m.createdAt, { year: true })];
  if (m.durationMs > 0) parts.push(formatDuration(m.durationMs));
  parts.push(`${getTemplate(m.template).name} template`);
  return parts.join(" · ");
}

function quote(text: string): string {
  return text.replace(/"/g, "”").replace(/\s+/g, " ").trim();
}

/** Markdown with GitHub-style footnotes that quote the transcript. */
export function toMarkdown(m: ExportableMeeting): string {
  const lines: string[] = [`# ${m.title || "Untitled meeting"}`, "", `_${metaLine(m)}_`, ""];
  if (!m.enhanced || m.enhanced.sections.length === 0) {
    lines.push("## Notes", "", m.notes.trim() || "_No notes yet._", "");
    return lines.join("\n");
  }
  const numbers = numberFootnotes(m.enhanced);
  const byId = new Map(m.segments.map((s) => [s.id, s]));
  for (const section of m.enhanced.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const b of section.bullets) {
      const marks = b.cites.map((c) => `[^${numbers.get(c)}]`).join("");
      // AI additions are set in italics, the way the app sets them in gray.
      lines.push(`- ${b.origin === "ai" ? `_${b.text}_` : b.text}${marks}`);
    }
    lines.push("");
  }
  if (numbers.size) {
    for (const [id, n] of numbers) {
      const seg = byId.get(id);
      if (!seg) continue;
      lines.push(`[^${n}]: ${speakerName(seg)}, ${formatClock(seg.t)}: "${quote(seg.text)}"`);
    }
    lines.push("");
  }
  lines.push("_Written with Footnote: plain lines are the note-taker's, italic lines were added by AI, and every footnote quotes the transcript._", "");
  return lines.join("\n");
}

/** Slack mrkdwn: bold headings, bullets, timestamps inline instead of footnotes. */
export function toSlack(m: ExportableMeeting): string {
  const out: string[] = [`*${m.title || "Untitled meeting"}*`, `_${metaLine(m)}_`, ""];
  if (!m.enhanced || m.enhanced.sections.length === 0) {
    out.push(m.notes.trim() || "_No notes yet._");
    return out.join("\n");
  }
  const byId = new Map(m.segments.map((s) => [s.id, s]));
  for (const section of m.enhanced.sections) {
    out.push(`*${section.heading}*`);
    for (const b of section.bullets) {
      const stamps = b.cites
        .map((c) => byId.get(c))
        .filter(Boolean)
        .map((s) => formatClock(s!.t));
      out.push(`• ${b.origin === "ai" ? `_${b.text}_` : b.text}${stamps.length ? `  (${stamps.join(", ")})` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "meeting"
  );
}

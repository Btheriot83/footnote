import type { TemplateId } from "./types";

export interface Template {
  id: TemplateId;
  name: string;
  blurb: string;
  sections: string[];
  guidance: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "general",
    name: "General",
    blurb: "Any meeting. Summary, decisions, next steps.",
    sections: ["Summary", "Discussion", "Decisions", "Next steps"],
    guidance:
      "A general-purpose meeting. Capture the gist, the key points discussed, any decisions, and concrete next steps with owners.",
  },
  {
    id: "one-on-one",
    name: "1:1",
    blurb: "Check-ins, feedback, growth, follow-ups.",
    sections: ["Check-in", "Topics", "Feedback", "Follow-ups"],
    guidance:
      "A manager / report 1:1. Capture how they're doing, the topics raised, any feedback given in either direction, and follow-ups with owners.",
  },
  {
    id: "sales",
    name: "Sales call",
    blurb: "Their situation, needs, objections, next steps.",
    sections: ["Where they are", "What they need", "Pricing", "Security & procurement", "Next steps"],
    guidance:
      "A sales or renewal call. Capture the customer's situation and news, their needs and scale, objections (especially pricing), procurement or security requirements, and next steps with dates and owners.",
  },
  {
    id: "standup",
    name: "Standup",
    blurb: "Done, doing, blocked.",
    sections: ["Done", "Doing", "Blockers"],
    guidance:
      "A team standup. Group what each person finished, what they're working on next, and anything blocking them.",
  },
  {
    id: "interview",
    name: "Interview",
    blurb: "Background, signals, concerns, verdict inputs.",
    sections: ["Background", "Strengths", "Concerns", "Questions they asked", "Next steps"],
    guidance:
      "A hiring interview. Capture the candidate's background, evidence of strengths, concerns or gaps, questions they asked, and next steps. Stay factual; do not make a hiring decision.",
  },
  {
    id: "research",
    name: "User research",
    blurb: "Context, pains, quotes, opportunities.",
    sections: ["Context", "Pain points", "Workarounds", "Opportunities"],
    guidance:
      "A user research interview. Capture the participant's context, their pain points, current workarounds, and opportunities. Prefer the participant's own words.",
  },
];

export function getTemplate(id: string | undefined | null): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** "General Meeting Notes" says nothing a blank title doesn't; keep the placeholder instead. */
export function isGenericTitle(title: string, templateId?: string | null): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  if (!t) return true;
  const filler = new Set(["meeting", "notes", "note", "call", "sync", "summary", "general", "untitled", "the", "and", "of", ...norm(getTemplate(templateId).name).split(" ")]);
  return t.split(" ").every((w) => filler.has(w));
}

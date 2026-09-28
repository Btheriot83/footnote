export type Speaker = "you" | "them";

export interface Segment {
  id: string;
  speaker: Speaker;
  /** Display label, e.g. "You" or "Dana (Acme)". */
  label?: string;
  /** Milliseconds since the meeting started. */
  t: number;
  text: string;
}

export type Origin = "you" | "ai";

export interface EnhancedBullet {
  text: string;
  origin: Origin;
  cites: string[];
}

export interface EnhancedSection {
  heading: string;
  bullets: EnhancedBullet[];
}

export interface EnhancedNotes {
  title?: string;
  sections: EnhancedSection[];
}

export type TemplateId =
  | "general"
  | "one-on-one"
  | "sales"
  | "standup"
  | "interview"
  | "research";

export type MeetingStatus = "draft" | "live" | "ended";

export interface Meeting {
  id: string;
  title: string;
  template: TemplateId;
  createdAt: number;
  durationMs: number;
  status: MeetingStatus;
  notes: string;
  segments: Segment[];
  enhanced: EnhancedNotes | null;
  enhancedAt?: number;
  /** "cached" when the enhancement came from the bundled sample. */
  enhancedSource?: "live" | "cached";
  isSample?: boolean;
  updatedAt: number;
}

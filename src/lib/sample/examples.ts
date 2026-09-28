import examples from "./examples.json";
import type { EnhancedNotes, Meeting, Segment, TemplateId } from "../types";

/**
 * Two finished example meetings that seed a first visit's history, so search and
 * "Ask your meetings" have something to work with. They're labeled as examples and
 * can be deleted like any other meeting.
 */
export function exampleMeetings(now = Date.now()): Meeting[] {
  return examples.map((e) => {
    const d = new Date(now - e.daysAgo * 86_400_000);
    d.setHours(e.hour, 0, 0, 0);
    const createdAt = d.getTime();
    return {
      id: `ex_${e.key}`,
      title: e.title,
      template: e.template as TemplateId,
      createdAt,
      updatedAt: createdAt,
      durationMs: e.durationMs,
      status: "ended",
      notes: e.notes,
      segments: e.segments as Segment[],
      enhanced: e.enhanced as EnhancedNotes,
      enhancedAt: createdAt + e.durationMs,
      enhancedSource: "cached",
      isExample: true,
    };
  });
}

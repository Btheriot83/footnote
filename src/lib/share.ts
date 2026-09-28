import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { numberFootnotes } from "./citations";
import type { EnhancedNotes, Segment, TemplateId } from "./types";

/** Compact payload stored entirely in the URL fragment. Nothing hits a server. */
export interface SharePayload {
  v: 1;
  title: string;
  template: TemplateId;
  createdAt: number;
  durationMs: number;
  notes?: string;
  enhanced: EnhancedNotes | null;
  segments: Segment[];
  /** true when only the cited transcript lines were included */
  citedOnly?: boolean;
  /** The bundled sample call: its audio ships with the app, so shared receipts can play. */
  sample?: true;
}

export function buildSharePayload(
  m: Omit<SharePayload, "v" | "citedOnly" | "sample"> & { isSample?: boolean },
  opts: { fullTranscript: boolean; includeNotes: boolean },
): SharePayload {
  const cited = numberFootnotes(m.enhanced);
  const segments = opts.fullTranscript ? m.segments : m.segments.filter((s) => cited.has(s.id));
  return {
    v: 1,
    title: m.title,
    template: m.template,
    createdAt: m.createdAt,
    durationMs: m.durationMs,
    ...(opts.includeNotes && m.notes ? { notes: m.notes } : {}),
    enhanced: m.enhanced,
    segments,
    citedOnly: !opts.fullTranscript,
    ...(m.isSample ? { sample: true as const } : {}),
  };
}

export function encodeShare(payload: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeShare(hash: string): SharePayload | null {
  try {
    const raw = hash.replace(/^#/, "");
    if (!raw) return null;
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const data = JSON.parse(json);
    if (!data || data.v !== 1 || !Array.isArray(data.segments)) return null;
    return data as SharePayload;
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, payload: SharePayload): string {
  return `${origin}/s#${encodeShare(payload)}`;
}

"use client";
/** A transcript line to reveal once a meeting opens (from "Ask your meetings"). */
let pending: { meetingId: string; segmentId: string } | null = null;

export function setPendingFocus(meetingId: string, segmentId: string) {
  pending = { meetingId, segmentId };
}

export function takePendingFocus(meetingId: string): string | null {
  if (!pending || pending.meetingId !== meetingId) return null;
  const id = pending.segmentId;
  pending = null;
  return id;
}

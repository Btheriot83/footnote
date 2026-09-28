"use client";
import type { Segment } from "../types";
import { LiveCapture } from "./capture";
import { getSession, resetSession, setLevel, setSession } from "./session";
import { finishSample, stopSampleAudio } from "./sample-controller";
import { getMeeting, nextSegmentId, patchMeetingState, updateMeeting } from "./store";
import { toast } from "./toast";

let capture: LiveCapture | null = null;
let clock: ReturnType<typeof setInterval> | null = null;

function insertSorted(list: Segment[], seg: Segment): Segment[] {
  const out = [...list];
  let i = out.length;
  while (i > 0 && out[i - 1].t > seg.t) i--;
  out.splice(i, 0, seg);
  return out;
}

/**
 * Starts (or resumes) live capture for a meeting. Call from a click handler:
 * tab capture needs the user gesture.
 */
export async function startLive(meetingId: string, opts: { mic: boolean; tab: boolean }) {
  const s = getSession();
  if (s.kind === "sample") {
    stopSampleAudio();
    if (s.sample.phase !== "done") finishSample();
  }
  if (s.kind === "live") stopLive();

  const m = getMeeting(meetingId);
  if (!m) return;
  const startedAt = Date.now() - (m.durationMs || 0);
  patchMeetingState(meetingId, { status: "live" }, { immediate: true });
  setSession({
    kind: "live",
    meetingId,
    startedAt,
    interim: null,
    issues: [],
    sources: { mic: opts.mic ? "starting" : "off", tab: opts.tab ? "starting" : "off", micMode: null },
  });

  const cap = new LiveCapture({
    onSegment: (seg) =>
      updateMeeting(meetingId, (mm) => ({
        ...mm,
        segments: insertSorted(mm.segments, {
          id: nextSegmentId(mm),
          speaker: seg.speaker,
          label: seg.speaker === "you" ? "You" : "Them",
          t: seg.t,
          text: seg.text,
        }),
      })),
    onInterim: (i) => setSession({ interim: i ? { ...i, speaker: "you", label: "You" } : null }),
    onLevel: setLevel,
    onIssue: (issue) => {
      setSession((st) => ({
        issues: [...st.issues.filter((x) => !(x.source === issue.source && x.code === issue.code)), issue],
      }));
      if (issue.code !== "denied" && issue.code !== "no_audio") {
        toast(issue.message, { tone: issue.code === "ended" ? "neutral" : "error" });
      }
    },
    onSources: (sources) => setSession({ sources }),
  });
  capture = cap;
  if (clock) clearInterval(clock);
  clock = setInterval(() => {
    patchMeetingState(meetingId, { durationMs: Date.now() - startedAt });
  }, 5000);
  await cap.start({ ...opts, startedAt });
}

export function stopLive() {
  const s = getSession();
  if (clock) clearInterval(clock);
  clock = null;
  capture?.stop();
  capture = null;
  setLevel(0);
  if (s.kind === "live" && s.meetingId) {
    patchMeetingState(s.meetingId, { status: "ended", durationMs: Date.now() - s.startedAt }, { immediate: true });
  }
  resetSession();
}

export function isLive(meetingId: string | null | undefined) {
  const s = getSession();
  return !!meetingId && s.kind === "live" && s.meetingId === meetingId;
}

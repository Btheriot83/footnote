"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EnhancedView } from "@/components/receipts/EnhancedView";
import { Pen } from "@/components/receipts/Pen";
import { TranscriptPanel } from "@/components/receipts/TranscriptPanel";
import { useReceipts } from "@/components/receipts/useReceipts";
import {
  CopyIcon,
  DownloadIcon,
  InfoIcon,
  MenuIcon,
  MicIcon,
  MoreIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  ShareIcon,
  SkipIcon,
  SlackIcon,
  SparkIcon,
  SpeakerIcon,
  StopIcon,
  TrashIcon,
} from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { numberFootnotes } from "@/lib/citations";
import { ApiError, streamEnhance } from "@/lib/client/api";
import {
  hasRecording,
  playCall,
  playSegment,
  releaseRecordings,
  segmentAt,
  spansFor,
  stopClip,
  useClip,
} from "@/lib/client/clip-player";
import { deleteRecordings } from "@/lib/client/local-audio";
import { stopLive } from "@/lib/client/live-controller";
import { takePendingFocus } from "@/lib/client/pending-focus";
import { markSampleTyping, pauseSample, playSample, skipSampleToEnd } from "@/lib/client/sample-controller";
import { useSession } from "@/lib/client/session";
import { deleteMeeting, getMeeting, patchMeetingState, useMeeting } from "@/lib/client/store";
import { toast } from "@/lib/client/toast";
import { toMarkdown, toSlack } from "@/lib/export";
import { formatDate, formatDuration } from "@/lib/format";
import {
  normalizeNotes,
  SAMPLE_CACHED_ENHANCEMENT,
  SAMPLE_DEFAULT_NOTES,
  SAMPLE_SEGMENTS,
  SAMPLE_TITLE,
} from "@/lib/sample";
import { isGenericTitle, TEMPLATES } from "@/lib/templates";
import type { EnhancedNotes, TemplateId } from "@/lib/types";
import { AskBox } from "./AskBox";
import { Menu } from "./Menu";
import { focusNotes, Notepad } from "./Notepad";
import { copyText, downloadMarkdown, ShareDialog } from "./ShareDialog";
import { RecordingPill, useTicker } from "./StatusPill";

interface Props {
  meetingId: string;
  isMobile: boolean;
  onOpenSidebar: () => void;
  onRequestStart: () => void;
  onRetryCapture: () => void;
  onSettings: () => void;
  onDeleted: () => void;
  registerEnhance: (fn: (() => void) | null) => void;
}

interface EnhanceError {
  code: string;
  message: string;
  offerCached?: boolean;
}

const isMacLike = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function MeetingPane({
  meetingId,
  isMobile,
  onOpenSidebar,
  onRequestStart,
  onRetryCapture,
  onSettings,
  onDeleted,
  registerEnhance,
}: Props) {
  const m = useMeeting(meetingId);
  const session = useSession();
  const here = session.meetingId === meetingId;
  const live = here && session.kind === "live";
  const sample = here && session.kind === "sample" ? session.sample : null;
  const liveElapsed = useTicker(live, session.startedAt);
  const clip = useClip();

  const [partial, setPartial] = useState<EnhancedNotes | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<EnhanceError | null>(null);
  const [view, setView] = useState<"enhanced" | "notes">("notes");
  const [mobileTab, setMobileTab] = useState<"notes" | "transcript">("notes");
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dismissedIssues, setDismissedIssues] = useState<string[]>([]);
  const [flash, setFlash] = useState<{ id: string; nonce: number } | null>(null);
  const onLand = useCallback((id: string) => setFlash((f) => ({ id, nonce: (f?.nonce ?? 0) + 1 })), []);
  const abortRef = useRef<AbortController | null>(null);

  // Reset per-meeting UI state.
  useEffect(() => {
    abortRef.current?.abort();
    setPartial(null);
    setStreaming(false);
    setError(null);
    setMobileTab("notes");
    setDismissedIssues([]);
    setConfirmDelete(false);
    const mm = getMeeting(meetingId);
    setView(mm?.enhanced ? "enhanced" : "notes");
  }, [meetingId]);

  // When a meeting finishes loading, open its enhanced notes by default.
  const loaded = !!m;
  const hasEnhanced = !!m?.enhanced;
  useEffect(() => {
    if (loaded && hasEnhanced) setView((v) => (streaming ? v : "enhanced"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hasEnhanced]);

  const shown = partial ?? m?.enhanced ?? null;
  const numbers = useMemo(() => numberFootnotes(shown), [shown]);
  const segmentsById = useMemo(() => new Map((m?.segments ?? []).map((s) => [s.id, s])), [m?.segments]);
  const receipts = useReceipts(m?.enhanced ?? null);


  const playCached = useCallback(
    async (id: string) => {
      setStreaming(true);
      setView("enhanced");
      const full = SAMPLE_CACHED_ENHANCEMENT;
      const steps: EnhancedNotes[] = [];
      full.sections.forEach((s, si) => {
        for (let bi = 0; bi <= s.bullets.length; bi++) {
          steps.push({
            title: full.title,
            sections: [...full.sections.slice(0, si), { heading: s.heading, bullets: s.bullets.slice(0, bi) }],
          });
        }
      });
      for (const step of steps) {
        setPartial(step);
        await new Promise((r) => setTimeout(r, step.sections.at(-1)?.bullets.length ? 230 : 160));
      }
      patchMeetingState(
        id,
        { enhanced: full, enhancedAt: Date.now(), enhancedSource: "cached", title: getMeeting(id)?.title || SAMPLE_TITLE },
        { immediate: true },
      );
      setPartial(null);
      setStreaming(false);
    },
    [],
  );

  const runEnhance = useCallback(async () => {
    if (streaming) return;
    let cur = getMeeting(meetingId);
    if (!cur) return;
    if (session.kind === "sample" && session.meetingId === meetingId && session.sample.phase !== "done") {
      skipSampleToEnd();
      cur = getMeeting(meetingId)!;
    }
    if (!cur.notes.replace(/^[\s\-*•]+$/gm, "").trim() && cur.segments.length === 0) {
      toast("Nothing to enhance yet. Type a few notes or record some of the meeting first.");
      return;
    }
    const previous = cur.enhanced
      ? { enhanced: cur.enhanced, enhancedAt: cur.enhancedAt, enhancedSource: cur.enhancedSource }
      : null;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setStreaming(true);
    setView("enhanced");
    setMobileTab("notes");
    setPartial({ sections: [] });
    const input = { template: cur.template, title: cur.title, userNotes: cur.notes, segments: cur.segments };
    try {
      const final = await streamEnhance(input, (p) => !ac.signal.aborted && setPartial(p), ac.signal);
      if (ac.signal.aborted) return;
      const latest = getMeeting(meetingId);
      const retitle =
        latest &&
        (latest.title === "Untitled meeting" || !latest.title.trim()) &&
        final.title &&
        !isGenericTitle(final.title, cur.template);
      patchMeetingState(
        meetingId,
        {
          enhanced: final,
          enhancedAt: Date.now(),
          enhancedSource: "live",
          ...(retitle ? { title: final.title } : {}),
        },
        { immediate: true },
      );
      if (final.sections.length === 0) {
        toast("The AI couldn't find anything it could cite. Try adding a few notes.");
      } else if (previous) {
        toast("Notes re-enhanced.", {
          duration: 8000,
          action: {
            label: "Undo",
            onClick: () =>
              patchMeetingState(
                meetingId,
                { enhanced: previous.enhanced, enhancedAt: previous.enhancedAt, enhancedSource: previous.enhancedSource },
                { immediate: true },
              ),
          },
        });
      }
      setPartial(null);
      setStreaming(false);
    } catch (e) {
      if ((e as Error).name === "AbortError" || ac.signal.aborted) return;
      setPartial(null);
      setStreaming(false);
      const err = e instanceof ApiError ? e : new ApiError("error", "Enhance failed. Please try again.", 0);
      const isSample = cur.isSample && cur.segments.length === SAMPLE_SEGMENTS.length;
      if (isSample && (err.code === "no_key" || err.code === "limit")) {
        if (normalizeNotes(cur.notes) === normalizeNotes(SAMPLE_DEFAULT_NOTES)) {
          toast(
            err.code === "no_key"
              ? "No AI key on this server, so here's the cached demo for these notes."
              : "Today's free allowance is used up, so here's the cached demo for these notes.",
          );
          await playCached(meetingId);
          return;
        }
        setError({ code: err.code, message: err.message, offerCached: true });
        return;
      }
      setError({ code: err.code, message: err.message });
      if (getMeeting(meetingId)?.enhanced) setView("enhanced");
      else setView("notes");
    }
  }, [meetingId, playCached, session, streaming]);

  useEffect(() => {
    registerEnhance(() => void runEnhance());
    return () => registerEnhance(null);
  }, [registerEnhance, runEnhance]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(
    () => () => {
      stopClip();
      releaseRecordings();
    },
    [meetingId],
  );
  const spans = useMemo(() => (m ? spansFor(m) : []), [m]);

  // Arriving from "Ask your meetings": reveal the cited line.
  const clickCite = receipts.clickCite;
  useEffect(() => {
    if (!loaded) return;
    const reveal = () => {
      const id = takePendingFocus(meetingId);
      if (!id) return;
      setMobileTab("transcript");
      setTimeout(() => clickCite(id), 120);
    };
    reveal();
    window.addEventListener("footnote:pending-focus", reveal);
    return () => window.removeEventListener("footnote:pending-focus", reveal);
  }, [loaded, meetingId, clickCite]);

  if (!m) {
    return (
      <div className="flex h-full items-center justify-center text-muted" aria-busy>
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-ink/40" />
      </div>
    );
  }

  const meeting = m;
  const elapsed = live ? liveElapsed : sample ? sample.positionMs : meeting.durationMs;
  const sampleDone = sample?.phase === "done" || (meeting.isSample && meeting.status === "ended");
  const nudge = sampleDone && !meeting.enhanced && !streaming && !error;
  const issues = here ? session.issues.filter((i) => !dismissedIssues.includes(i.source + i.code)) : [];
  // Recording, but nothing is actually listening (mic blocked, tab not shared).
  const hearing = (st: string) => st === "on" || st === "starting";
  const notesOnly = live && !hearing(session.sources.mic) && !hearing(session.sources.tab);
  const samplePlaying = !!sample && sample.phase !== "done";
  const mod = isMacLike() ? "⌘" : "Ctrl";
  // Nothing to write up yet: no notes typed and nothing heard.
  const nothingYet = !meeting.notes.replace(/^[\s\-*•]+$/gm, "").trim() && meeting.segments.length === 0 && !sample;
  // Receipts you can hear: the sample call has a recording behind every line.
  const audible = hasRecording(meeting) && !samplePlaying && !live;
  const clipHere = clip.meetingId === meeting.id && clip.playing;
  const listening = clipHere && !clip.segmentId;
  const playingNow = clipHere
    ? (() => {
        const id = clip.segmentId ?? segmentAt(spans, clip.positionMs);
        const seg = id ? spans.find((x) => x.id === id) : null;
        if (!id || !seg) return null;
        const progress = Math.min(1, Math.max(0, (clip.positionMs - seg.t) / Math.max(1, seg.end - seg.t)));
        return { id, progress, single: !!clip.segmentId };
      })()
    : null;
  const playCite = (id: string) => {
    if (audible) playSegment(meeting, id);
  };

  const menuItems = [
    {
      label: "Share…",
      icon: <ShareIcon size={16} />,
      onSelect: () => setShareOpen(true),
      hidden: !isMobile,
    },
    {
      label: view === "enhanced" ? "Show my original notes" : "Show enhanced notes",
      icon: <NoteIcon size={17} />,
      onSelect: () => setView(view === "enhanced" ? "notes" : "enhanced"),
      hidden: !meeting.enhanced,
    },
    {
      label: "Copy as Markdown",
      icon: <CopyIcon size={17} />,
      onSelect: () => copyText(toMarkdown(meeting), "Markdown copied, with footnotes."),
      separatorBefore: !!meeting.enhanced,
    },
    { label: "Copy for Slack", icon: <SlackIcon size={17} />, onSelect: () => copyText(toSlack(meeting), "Copied for Slack.") },
    { label: "Download .md", icon: <DownloadIcon size={17} />, onSelect: () => downloadMarkdown(meeting) },
    {
      label: "Delete this meeting's audio",
      icon: <SpeakerIcon size={16} />,
      onSelect: async () => {
        stopClip();
        releaseRecordings();
        await deleteRecordings(meeting.id);
        patchMeetingState(meeting.id, { hasAudio: false }, { immediate: true });
        toast("Audio deleted. The transcript and notes stay.");
      },
      hidden: !meeting.hasAudio || live,
      separatorBefore: true,
    },
    {
      label: "Delete meeting",
      icon: <TrashIcon size={17} />,
      onSelect: () => setConfirmDelete(true),
      danger: true,
      separatorBefore: !meeting.hasAudio || live,
    },
  ];

  /* ---------- header status ---------- */
  let status: React.ReactNode;
  if (live) {
    status = (
      <div className="flex items-center gap-2">
        {notesOnly ? (
          <RecordingPill label="Notes only" elapsedMs={elapsed} live={false} dot="muted" />
        ) : (
          <RecordingPill label="Recording" elapsedMs={elapsed} live />
        )}
        <button
          type="button"
          onClick={() => stopLive()}
          className={cx(btn.base, btn.secondary, "h-10 shrink-0 px-4 text-[10.5px]")}
          aria-label={notesOnly ? "End meeting" : "Stop recording"}
        >
          <StopIcon size={14} /> <span className="hidden sm:inline">{notesOnly ? "End" : "Stop"}</span>
        </button>
      </div>
    );
  } else if (sample && sample.phase !== "done") {
    const playing = sample.phase === "playing";
    // While the banner asks to press play, it holds the only play button.
    const waiting = sample.blocked || sample.phase === "ready";
    status = (
      <div className="flex items-center gap-2">
        <RecordingPill label={playing ? "Sample call" : "Paused"} elapsedMs={elapsed} live={playing} dot={playing ? "accent" : "muted"} />
        {!waiting && (
          <button
            type="button"
            onClick={() => (playing ? pauseSample() : void playSample())}
            className={cx(btn.base, btn.secondary, btn.icon, "h-10 w-10 shrink-0")}
            aria-label={playing ? "Pause sample" : "Play sample"}
          >
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => skipSampleToEnd()}
          aria-label="Skip to end"
          title="Skip to the end of the call"
          className={cx(btn.base, btn.secondary, "h-10 shrink-0 px-3 text-[10.5px] sm:px-4")}
        >
          <SkipIcon size={15} /> <span className="hidden sm:inline">Skip to end</span>
        </button>
      </div>
    );
  } else if (meeting.status === "draft") {
    status = (
      <button type="button" onClick={onRequestStart} className={cx(btn.base, btn.secondary, "h-10 px-5 text-[10.5px]")}>
        <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
        Start recording
      </button>
    );
  } else {
    status = (
      <div className="flex items-center gap-2">
        <RecordingPill
          label={listening ? "Playing" : "Ended"}
          elapsedMs={listening ? clip.positionMs : meeting.durationMs}
          live={listening}
          dot={listening ? "accent" : "muted"}
        />
        {audible && (
          <button
            type="button"
            onClick={() => (listening ? stopClip() : playCall(meeting))}
            className={cx(btn.base, btn.secondary, "h-10 shrink-0 px-4 text-[10.5px]")}
            aria-label={listening ? "Stop listening" : "Listen to the call"}
          >
            {listening ? <PauseIcon size={15} /> : <SpeakerIcon size={16} />}
            <span className="hidden sm:inline">{listening ? "Stop" : "Listen"}</span>
          </button>
        )}
        {!meeting.isSample && (
          <button
            type="button"
            onClick={onRequestStart}
            className={cx(btn.base, btn.ghost, "on-wood-2 h-10 px-3 text-[10.5px] max-sm:hidden")}
          >
            Resume
          </button>
        )}
      </div>
    );
  }

  const transcriptEmpty = (
    <div className="px-2 pt-3 font-serif text-[16px] leading-relaxed text-muted">
      {notesOnly ? (
        <>
          <p className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 rounded-full bg-faint" /> Not listening
          </p>
          <p className="mt-1">
            Footnote can&rsquo;t hear this meeting, so it&rsquo;s notes only for now. Your notes still save, and Enhance
            still tidies them up.
          </p>
          <SourceList sources={session.sources} />
          <button type="button" onClick={onRetryCapture} className={cx(btn.base, btn.secondary, btn.sm, "mt-4")}>
            <MicIcon size={16} /> Try the mic again
          </button>
        </>
      ) : live ? (
        <>
          <p className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" /> Listening…
          </p>
          <p className="mt-1">Lines appear here as people talk.</p>
          <SourceList sources={session.sources} />
        </>
      ) : sample ? (
        <p>The call is about to start…</p>
      ) : meeting.status === "draft" ? (
        <>
          <p>No transcript yet.</p>
          <p className="mt-1">Start recording to capture the conversation, or just take notes.</p>
          <button type="button" onClick={onRequestStart} className={cx(btn.base, btn.secondary, btn.sm, "mt-4")}>
            <MicIcon size={16} /> Start recording
          </button>
        </>
      ) : (
        <p>Nothing was transcribed in this meeting.</p>
      )}
    </div>
  );


  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Top bar, on the desk */}
      <header className="flex h-[64px] shrink-0 items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-5 lg:pl-1">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="pill h-10 w-10 shrink-0 p-0 tracking-normal lg:hidden"
          aria-label="Open meetings"
        >
          <MenuIcon size={20} />
        </button>
        <div className="min-w-0 shrink">{status}</div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => void runEnhance()}
            disabled={streaming || nothingYet}
            title={nothingYet ? "Type a few notes or record first" : `${meeting.enhanced ? "Re-enhance" : "Enhance"} notes (${mod}+Enter)`}
            className={cx(
              btn.base,
              nudge ? btn.primary : btn.secondary,
              "h-10 shrink-0 px-4 text-[10.5px] sm:px-5",
              nudge && "ring-[5px] ring-white/45",
            )}
          >
            {streaming ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            ) : (
              <SparkIcon size={15} className={cx(!nudge && "hidden sm:block")} />
            )}
            <span className={cx(nudge ? "" : "hidden sm:inline")}>
              {streaming ? "Enhancing…" : meeting.enhanced ? "Re-enhance" : "Enhance notes"}
            </span>
            {!streaming && !nudge && <span className="sm:hidden">{meeting.enhanced ? "Redo" : "Enhance"}</span>}
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={cx(btn.base, btn.secondary, "h-10 shrink-0 px-4 text-[10.5px] max-sm:hidden sm:px-5")}
            aria-label="Share"
          >
            <ShareIcon size={15} />
            <span className="hidden sm:inline">Share</span>
          </button>
          <Menu label="More actions" trigger={<MoreIcon size={20} />} items={menuItems} />
        </div>
      </header>

      {/* Phone tabs */}
      <div className="paper paper-stone mx-3 mb-2 flex shrink-0 rounded-full p-1 md:hidden" role="tablist" aria-label="View">
        {(["notes", "transcript"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={mobileTab === t}
            onClick={() => setMobileTab(t)}
            className={cx(
              "flex-1 rounded-full py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
              mobileTab === t ? "pill text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t === "notes" ? "Notes" : "Transcript"}
            {t === "transcript" && meeting.segments.length > 0 && (
              <span className="ml-1.5 font-mono text-[11px] tracking-normal text-muted">{meeting.segments.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Document */}
        <main
          className={cx(
            "scroll-thin min-w-0 flex-1 overflow-y-auto px-2 pb-3 pt-1 sm:px-4 sm:pb-5 lg:pl-1",
            isMobile && mobileTab !== "notes" && "hidden",
          )}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button, [data-bullet], a, input, textarea")) receipts.clear();
          }}
        >
          <article data-sheet={meeting.id} className="paper paper-cream sheet-shadow mx-auto min-h-[calc(100%-4px)] w-full max-w-[800px] rounded-[3px] px-5 pb-24 pt-9 sm:px-12 sm:pt-12 xl:px-[72px] xl:pt-14">
            <label htmlFor="meeting-title" className="sr-only">
              Meeting title
            </label>
            <textarea
              id="meeting-title"
              rows={1}
              value={meeting.title === "Untitled meeting" ? "" : meeting.title}
              placeholder="Untitled meeting"
              onChange={(e) => patchMeetingState(meeting.id, { title: e.target.value.replace(/\n/g, " ") })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                  focusNotes();
                }
              }}
              onBlur={(e) => e.target.value !== e.target.value.trim() && patchMeetingState(meeting.id, { title: e.target.value.trim() })}
              className="block w-full resize-none overflow-hidden bg-transparent [field-sizing:content] [text-wrap:balance] font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.022em] text-ink placeholder:text-faint focus:outline-none sm:text-[46px]"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[16.5px] italic text-muted sm:text-[18px]">
              <span>{formatDate(meeting.createdAt)}</span>
              {meeting.durationMs > 0 && (
                <>
                  <span aria-hidden>•</span>
                  <span>{formatDuration(meeting.durationMs)}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <label className="relative inline-flex items-center">
                <span className="sr-only">Template</span>
                <select
                  value={meeting.template}
                  onChange={(e) => patchMeetingState(meeting.id, { template: e.target.value as TemplateId })}
                  className="cursor-pointer appearance-none rounded-md bg-transparent pr-1 italic hover:text-ink focus:outline-none"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} template
                    </option>
                  ))}
                </select>
              </label>
              {meeting.isExample && (
                <span className="ml-2 inline-block -rotate-[2deg] rounded-[2px] border-[1.5px] border-accent/60 px-1.5 py-[1px] font-sans text-[9.5px] font-bold not-italic uppercase tracking-[0.18em] text-accent/90">
                  Example
                </span>
              )}
              {meeting.enhancedSource === "cached" && !meeting.isExample && view === "enhanced" && (
                <span className="ml-2 inline-block -rotate-[2deg] rounded-[2px] border-[1.5px] border-accent/60 px-1.5 py-[1px] font-sans text-[9.5px] font-bold not-italic uppercase tracking-[0.18em] text-accent/90">
                  Cached demo
                </span>
              )}
            </div>

            {/* Banners */}
            <div className="mt-6 space-y-3 empty:hidden">
              {sample && sample.phase !== "done" && (
                <SampleBanner
                  blocked={sample.blocked || sample.phase === "ready"}
                  tookOver={sample.userTookOver}
                  onPlay={() => void playSample()}
                />
              )}
              {nudge && (
                <div className="paper paper-butter animate-settle flex -rotate-[0.6deg] flex-wrap items-center gap-3 rounded-[2px] px-5 py-4 max-sm:flex-col max-sm:items-start">
                  <SparkIcon size={18} className="text-ink" />
                  <p className="flex-1 text-[16.5px] leading-snug text-ink-2">
                    That&rsquo;s the whole call. <strong className="font-semibold text-ink">Now hit Enhance</strong> and
                    watch every line get its receipt.
                  </p>
                  <button type="button" onClick={() => void runEnhance()} className={cx(btn.base, btn.primary, btn.sm)}>
                    Enhance <kbd className="font-sans text-[11px] tracking-normal opacity-70">{mod}↵</kbd>
                  </button>
                </div>
              )}
              {issues.map((issue) => (
                <div
                  key={issue.source + issue.code}
                  className="paper paper-blush animate-settle flex rotate-[0.4deg] items-start gap-3 rounded-[2px] px-5 py-4 text-[15.5px] leading-relaxed"
                  role="alert"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                  <div className="flex-1 text-ink-2">
                    <p>{issue.message}</p>
                    {issue.code === "denied" && issue.source === "mic" && (
                      <p className="mt-1 text-[13.5px] text-muted">
                        In Chrome: click the icon left of the address, set Microphone to Allow, then try again.
                      </p>
                    )}
                    <div className="mt-2 flex gap-3">
                      {(issue.code === "denied" || issue.code === "no_audio" || issue.code === "ended") && (
                        <button type="button" onClick={onRetryCapture} className="font-medium text-ink underline underline-offset-2">
                          Try again
                        </button>
                      )}
                      {(issue.code === "limit" || issue.code === "no_key") && (
                        <button type="button" onClick={onSettings} className="font-medium text-ink underline underline-offset-2">
                          Add your key
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDismissedIssues((d) => [...d, issue.source + issue.code])}
                        className="text-muted hover:text-ink"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {error && (
                <div
                  className="paper paper-blush animate-settle flex rotate-[0.4deg] items-start gap-3 rounded-[2px] px-5 py-4 text-[15.5px] leading-relaxed"
                  role="alert"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                  <div className="flex-1 text-ink-2">
                    <p>{error.message}</p>
                    {error.offerCached && (
                      <p className="mt-1 text-[13.5px] text-muted">
                        The cached demo was made from the sample&rsquo;s original notes, not the ones you typed.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {(error.code === "no_key" || error.code === "limit" || error.code === "upstream") && (
                        <button type="button" onClick={onSettings} className="font-medium text-ink underline underline-offset-2">
                          Add your key
                        </button>
                      )}
                      {error.offerCached && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            void playCached(meeting.id);
                          }}
                          className="font-medium text-ink underline underline-offset-2"
                        >
                          Show the cached demo
                        </button>
                      )}
                      {error.code !== "no_key" && (
                        <button
                          type="button"
                          onClick={() => void runEnhance()}
                          className="font-medium text-ink underline underline-offset-2"
                        >
                          Try again
                        </button>
                      )}
                      <button type="button" onClick={() => setError(null)} className="text-muted hover:text-ink">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            {view === "enhanced" && shown ? (
              <div className="mt-9">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-serif text-[29px] font-medium leading-tight tracking-[-0.015em] sm:text-[32px]">Enhanced notes</h2>
                  {meeting.enhanced && !streaming && (
                    <button
                      type="button"
                      onClick={() => setView("notes")}
                      className="text-[15.5px] italic text-muted underline decoration-rule-strong underline-offset-4 hover:text-ink"
                    >
                      Show my original notes
                    </button>
                  )}
                </div>
                {(numbers.size > 0 || streaming) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-ink" /> Your notes
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-faint" /> Added from the transcript
                      <sup className="font-semibold text-accent">1</sup>
                    </span>
                    <span className="hidden italic sm:inline">
                      {audible ? "Hover a number to see who said it. Click to hear it." : "Hover a number to see who said it."}
                    </span>
                  </p>
                )}
                {numbers.size === 0 && !streaming && meeting.segments.length === 0 && (
                  <p className="mt-1.5 text-[13.5px] text-muted">
                    Tidied from your notes. Record the meeting next time and added lines will cite the transcript.
                  </p>
                )}
                <div className="mt-7">
                  {streaming && shown.sections.length === 0 ? (
                    <Pen label="Reading the transcript…" className="py-2" />
                  ) : (
                    <EnhancedView
                      notes={shown}
                      numbers={numbers}
                      segmentsById={segmentsById}
                      receipts={receipts}
                      streaming={streaming}
                      inlineQuotes={isMobile}
                      onCite={playCite}
                      playingId={playingNow?.single ? playingNow.id : null}
                      audible={audible}
                      onLand={onLand}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-9">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="smallcaps text-muted">Your notes</h2>
                  {meeting.enhanced && (
                    <button
                      type="button"
                      onClick={() => setView("enhanced")}
                      className="text-[15.5px] italic text-muted underline decoration-rule-strong underline-offset-4 hover:text-ink"
                    >
                      Show enhanced notes
                    </button>
                  )}
                </div>
                <div className="mt-3">
                  <Notepad
                    value={meeting.notes}
                    onChange={(v) => patchMeetingState(meeting.id, { notes: v })}
                    onUserInput={() => sample && markSampleTyping()}
                    placeholder="Type rough notes as you listen. Short fragments are fine: Footnote fills in the rest from the transcript, with a receipt for every line."
                    autoFocus={(meeting.status === "draft" || live) && !meeting.notes.trim() && !isMobile}
                  />
                </div>
                {!meeting.enhanced && (meeting.notes.trim() || meeting.segments.length > 0) && !sample && !nudge && (
                  <p className="mt-6 text-[13.5px] text-muted">
                    When you&rsquo;re ready, press <kbd className="rounded border border-rule px-1 font-sans">{mod}</kbd>{" "}
                    <kbd className="rounded border border-rule px-1 font-sans">Enter</kbd> to enhance.
                  </p>
                )}
              </div>
            )}

            {meeting.segments.length > 0 && !streaming && (meeting.status === "ended" || live) && (
              <AskBox meeting={meeting} receipts={receipts} onSettings={onSettings} onCite={playCite} numbers={numbers} />
            )}
          </article>
        </main>

        {/* Transcript */}
        <aside
          className={cx(
            "flex min-h-0 shrink-0 flex-col px-3 pb-4 pt-3 md:w-[340px] md:pl-1 md:pr-4 md:pt-2 xl:w-[392px] xl:pr-5",
            isMobile ? (mobileTab === "transcript" ? "flex-1" : "hidden") : "",
          )}
          aria-label="Transcript"
        >
          <TranscriptPanel
            className="h-full"
            segments={meeting.segments}
            interim={here ? session.interim : null}
            numbers={numbers}
            notes={meeting.enhanced}
            receipts={receipts}
            live={(live && !notesOnly) || (!!sample && sample.phase === "playing")}
            empty={transcriptEmpty}
            playable={audible}
            playing={playingNow}
            onPlay={(id) => (playingNow?.id === id ? stopClip() : playSegment(meeting, id))}
            flash={flash}
            header={
              <div className="shrink-0 px-5 pb-1 pt-5 text-center">
                <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.3em]">Transcript</h2>
                <p className="mt-1 truncate font-mono text-[11px] uppercase text-[#6f6a60]">
                  {meeting.title || "Untitled meeting"}
                </p>
                <p className="mt-0.5 flex justify-center gap-2 font-mono text-[11px] uppercase text-[#6f6a60]">
                  <span>{formatDate(meeting.createdAt)}</span>
                  <span aria-hidden>·</span>
                  {(live && !notesOnly) || (sample && sample.phase === "playing") ? (
                    <span className="inline-flex items-center gap-1.5 text-accent">
                      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" /> Live
                    </span>
                  ) : meeting.segments.length > 0 ? (
                    <span>{meeting.segments.length} lines</span>
                  ) : (
                    <span>No lines yet</span>
                  )}
                </p>
                <hr className="receipt-rule mt-3" />
              </div>
            }
          />
        </aside>
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} meeting={meeting} />
      <ConfirmDelete
        open={confirmDelete}
        title={meeting.title || "Untitled meeting"}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (live) stopLive();
          setConfirmDelete(false);
          await deleteMeeting(meeting.id);
          toast("Meeting deleted.");
          onDeleted();
        }}
      />
    </div>
  );
}

function SourceList({ sources }: { sources: ReturnType<typeof useSession>["sources"] }) {
  const label = (s: string) =>
    s === "on" ? "on" : s === "starting" ? "starting…" : s === "denied" ? "blocked" : s === "off" ? "off" : s === "unsupported" ? "unavailable" : "error";
  return (
    <ul className="mt-4 space-y-1 text-[13.5px]">
      <li className="flex items-center gap-2">
        <span className={cx("h-1.5 w-1.5 rounded-full", sources.mic === "on" ? "bg-ink" : "bg-rule-strong")} />
        Your mic: {label(sources.mic)}
        {sources.mic === "on" && sources.micMode === "chunks" && " (via OpenAI)"}
      </li>
      <li className="flex items-center gap-2">
        <span className={cx("h-1.5 w-1.5 rounded-full", sources.tab === "on" ? "bg-ink" : "bg-rule-strong")} />
        Meeting tab: {label(sources.tab)}
        {sources.tab === "on" && " (lines arrive every ~10s)"}
      </li>
    </ul>
  );
}

function SampleBanner({ blocked, tookOver, onPlay }: { blocked: boolean; tookOver: boolean; onPlay: () => void }) {
  if (blocked) {
    return (
      <div className="paper paper-sky animate-settle flex -rotate-[0.4deg] flex-col items-start gap-4 rounded-[2px] px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[20px] font-medium text-ink">A 2-minute renewal call with Dana from Acme</p>
          <p className="mt-0.5 text-[15px] text-ink-2">
            Press play: the transcript and your rough notes appear as if you were on the call. Sound on.
          </p>
        </div>
        <button type="button" onClick={onPlay} className={cx(btn.base, btn.primary, btn.md, "w-full shrink-0 sm:w-auto")}>
          <PlayIcon size={15} /> Play the sample call
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 border-l-2 border-margin/70 py-0.5 pl-3.5 text-[15.5px] italic leading-relaxed text-muted">
      <InfoIcon size={16} className="mt-[4px] shrink-0 not-italic" />
      <p>
        {tookOver
          ? "You're taking the notes now. Type anything; Enhance works from your notes and the transcript."
          : "A staged sales call with AI-generated voices. The rough notes below are typed as if by you. Click into them to add your own."}
      </p>
    </div>
  );
}

function ConfirmDelete({
  open,
  title,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="desk-dialog paper paper-cream m-auto w-[calc(100%-24px)] max-w-[420px] rounded-[3px] p-7 text-ink shadow-lift"
    >
      <h2 className="font-serif text-[25px] font-medium">Delete this meeting?</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        &ldquo;{title}&rdquo; and its transcript will be removed from this device. This can&rsquo;t be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cx(btn.base, btn.secondary, btn.md)}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={cx(btn.base, btn.primary, btn.md)}>
          Delete
        </button>
      </div>
    </dialog>
  );
}

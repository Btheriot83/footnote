"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EnhancedView } from "@/components/receipts/EnhancedView";
import { TranscriptPanel } from "@/components/receipts/TranscriptPanel";
import { useReceipts } from "@/components/receipts/useReceipts";
import { PauseIcon, SpeakerIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { numberFootnotes } from "@/lib/citations";
import { hasRecording, playCall, playSegment, segmentAt, spansFor, stopClip, useClip } from "@/lib/client/clip-player";
import { formatDate, formatDuration } from "@/lib/format";
import { decodeShare, type SharePayload } from "@/lib/share";
import { getTemplate } from "@/lib/templates";

export function SharedNote() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ok"; data: SharePayload }>({
    status: "loading",
  });
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const read = () => {
      const data = decodeShare(window.location.hash);
      setState(data ? { status: "ok", data } : { status: "error" });
    };
    read();
    window.addEventListener("hashchange", read);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => setWide(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("hashchange", read);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const data = state.status === "ok" ? state.data : null;
  const numbers = useMemo(() => numberFootnotes(data?.enhanced), [data]);
  const byId = useMemo(() => new Map((data?.segments ?? []).map((s) => [s.id, s])), [data]);
  const receipts = useReceipts(data?.enhanced ?? null);

  // A shared sample call can still be heard: its audio ships with the app.
  const clip = useClip();
  const playable = useMemo(
    () =>
      data
        ? { id: "shared", isSample: !!data.sample, segments: data.segments, hasAudio: false, durationMs: data.durationMs }
        : null,
    [data],
  );
  const audible = !!playable && hasRecording(playable);
  const spans = useMemo(() => (playable ? spansFor(playable) : []), [playable]);
  const clipHere = clip.meetingId === "shared" && clip.playing;
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
  useEffect(() => () => stopClip(), []);

  useEffect(() => {
    if (data) document.title = `${data.title} · Footnote`;
  }, [data]);

  return (
    <div className="desk-page flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-[68px] shrink-0 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-sm">
          <Wordmark size={26} />
        </Link>
        <span className="smallcaps hidden text-ink-2 sm:inline">Shared note · read-only</span>
        <Link href="/" className={cx(btn.base, btn.secondary, btn.sm, "ml-auto")}>
          Make notes like this
        </Link>
      </header>

      {state.status === "loading" ? (
        <div className="flex flex-1 items-center justify-center" aria-busy>
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-ink/40" />
        </div>
      ) : state.status === "error" || !data ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="paper paper-cream max-w-[480px] animate-settle rounded-[3px] px-8 py-10 text-center">
            <h1 className="font-serif text-[34px] font-medium leading-tight tracking-[-0.02em]">This link is incomplete</h1>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
              Shared notes live entirely inside the link, so a link that was cut short can&rsquo;t be opened. Ask for the
              full link again.
            </p>
            <Link href="/" className={cx(btn.base, btn.primary, btn.md, "mt-6")}>
              What is Footnote?
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="scroll-thin min-w-0 flex-1 overflow-y-auto px-2 pb-3 sm:px-4 sm:pb-5">
            <article className="paper paper-cream mx-auto min-h-[calc(100%-4px)] w-full max-w-[800px] animate-settle rounded-[3px] px-5 pb-24 pt-9 sm:px-12 sm:pt-12 xl:px-[72px] xl:pt-14">
              <h1 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.022em] sm:text-[46px]">{data.title}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[16.5px] italic text-muted sm:text-[18px]">
                  {formatDate(data.createdAt, { year: true })}
                  {data.durationMs > 0 && <> • {formatDuration(data.durationMs)}</>} · {getTemplate(data.template).name}{" "}
                  template
                </p>
                {audible && !data.citedOnly && (
                  <button
                    type="button"
                    onClick={() => (listening ? stopClip() : playable && playCall(playable))}
                    className={cx(btn.base, btn.secondary, btn.sm)}
                  >
                    {listening ? <PauseIcon size={14} /> : <SpeakerIcon size={15} />}
                    {listening ? "Stop" : "Listen to the call"}
                  </button>
                )}
              </div>
              {data.enhanced && data.enhanced.sections.length > 0 ? (
                <div className="mt-9">
                  <h2 className="font-serif text-[29px] font-medium leading-tight tracking-[-0.015em] sm:text-[32px]">Enhanced notes</h2>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 text-[14.5px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-ink" /> Written by the note-taker
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-faint" /> Added from the transcript
                      <sup className="font-semibold text-accent">1</sup>
                    </span>
                    {audible && <span className="hidden italic sm:inline">Click a number to hear the moment.</span>}
                  </p>
                  <div className="mt-7">
                    <EnhancedView
                      notes={data.enhanced}
                      numbers={numbers}
                      segmentsById={byId}
                      receipts={receipts}
                      inlineQuotes={!wide}
                      onCite={audible && playable ? (id) => playSegment(playable, id) : undefined}
                      playingId={playingNow?.single ? playingNow.id : null}
                    />
                  </div>
                </div>
              ) : null}
              {data.notes && (
                <section className="mt-12">
                  <h2 className="smallcaps text-muted">
                    {data.enhanced ? "Original rough notes" : "Notes"}
                  </h2>
                  <pre className="mt-3 whitespace-pre-wrap font-serif text-[18px] leading-[1.7] text-ink">{data.notes}</pre>
                </section>
              )}
              {!wide && data.segments.length > 0 && !data.enhanced && (
                <section className="mt-12">
                  <h2 className="smallcaps text-muted">Transcript</h2>
                  <ol className="receipt mt-4 space-y-3 px-5 py-4">
                    {data.segments.map((s) => (
                      <li key={s.id}>
                        <p className="text-[11.5px] uppercase text-[#6a655b]">{s.label || s.speaker}</p>
                        <p className="text-[13.5px] leading-[1.6]">{s.text}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </article>
          </main>
          {wide && data.segments.length > 0 && (
            <aside className="flex w-[392px] shrink-0 flex-col pb-4 pl-1 pr-5 pt-2" aria-label="Transcript">
              <TranscriptPanel
                className="h-full"
                segments={data.segments}
                numbers={numbers}
                notes={data.enhanced}
                receipts={receipts}
                playable={audible}
                playing={playingNow}
                onPlay={(id) => (playingNow?.id === id ? stopClip() : playable && playSegment(playable, id))}
                header={
                  <div className="shrink-0 px-5 pb-1 pt-5 text-center">
                    <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.3em]">
                      {data.citedOnly ? "Sources" : "Transcript"}
                    </h2>
                    <p className="mt-1 truncate font-mono text-[11px] uppercase text-[#6f6a60]">{data.title}</p>
                    {data.citedOnly && (
                      <p className="mt-1 font-mono text-[11px] uppercase text-[#6f6a60]">Only the quoted lines were shared</p>
                    )}
                    <hr className="receipt-rule mt-3" />
                  </div>
                }
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

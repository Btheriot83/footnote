"use client";
import { useEffect, useRef } from "react";
import { PauseIcon, SpeakerIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { citingBullets } from "@/lib/citations";
import { formatClock } from "@/lib/format";
import type { EnhancedNotes, Segment } from "@/lib/types";
import type { Receipts } from "./useReceipts";

interface Props {
  segments: Segment[];
  interim?: { t: number; text: string; speaker?: "you" | "them"; label?: string } | null;
  numbers: Map<string, number>;
  notes: EnhancedNotes | null | undefined;
  receipts: Receipts;
  live?: boolean;
  empty?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  /** Only show footnote-numbered lines (share page with cited-only transcript). */
  compactGaps?: boolean;
  /** The meeting has a recording: each line can be played back. */
  playable?: boolean;
  /** Line currently sounding, with progress through it (0..1). */
  playing?: { id: string; progress: number; single: boolean } | null;
  onPlay?: (id: string) => void;
  /** A footnote just landed on this line while the notes were being written. */
  flash?: { id: string; nonce: number } | null;
}

function speakerLabel(s: { speaker?: "you" | "them"; label?: string }) {
  return s.label || (s.speaker === "them" ? "Them" : "You");
}

export function TranscriptPanel({
  segments,
  interim,
  numbers,
  notes,
  receipts,
  live,
  empty,
  header,
  className,
  playable,
  playing,
  onPlay,
  flash,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Follow the conversation while live, unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !live || !stickToBottom.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [segments.length, interim?.text, live]);

  // Receipts: bring the cited line into view.
  useEffect(() => {
    const id = receipts.focusSegment?.id;
    if (!id) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-segment="${id}"]`);
    if (!el || !scroller.current) return;
    if (scroller.current.offsetParent === null) return; // hidden (phone tab)
    const box = scroller.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const target = scroller.current.scrollTop + (r.top - box.top) - box.height / 2 + r.height / 2;
    scroller.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    stickToBottom.current = false;
  }, [receipts.focusSegment]);

  // A footnote landing in the notes lights up its line (and brings it into view, gently).
  const lastFlashScroll = useRef(0);
  useEffect(() => {
    if (!flash || !scroller.current || scroller.current.offsetParent === null) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-segment="${flash.id}"] > div`);
    if (!el) return;
    el.animate([{ backgroundColor: "rgba(240,96,58,0.28)" }, { backgroundColor: "rgba(240,96,58,0)" }], {
      duration: 1100,
      easing: "ease-out",
    });
    const now = performance.now();
    if (now - lastFlashScroll.current < 420) return;
    lastFlashScroll.current = now;
    const box = scroller.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < box.top + 30 || r.bottom > box.bottom - 30) {
      const target = scroller.current.scrollTop + (r.top - box.top) - box.height / 2 + r.height / 2;
      scroller.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      stickToBottom.current = false;
    }
  }, [flash]);

  // Follow along while the recording plays.
  const playingId = playing?.id;
  useEffect(() => {
    if (!playingId || !scroller.current || scroller.current.offsetParent === null) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-segment="${playingId}"]`);
    if (!el) return;
    const box = scroller.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < box.top + 40 || r.bottom > box.bottom - 40) {
      const target = scroller.current.scrollTop + (r.top - box.top) - box.height / 3;
      scroller.current.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }
  }, [playingId]);

  return (
    <div className={cx("receipt flex min-h-0 flex-col", className)}>
      {header}
      <div
        ref={scroller}
        className="scroll-thin fade-top min-h-0 flex-1 overflow-y-auto px-2.5 pb-8 pt-3 sm:px-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        }}
        aria-live={live ? "polite" : undefined}
        aria-relevant="additions"
      >
        {segments.length === 0 && !interim ? (
          empty
        ) : (
          <ol className="space-y-0.5">
            {segments.map((s) => {
              const n = numbers.get(s.id);
              const active = receipts.activeSegments.has(s.id);
              const open = receipts.openLine === s.id;
              const citing = open ? citingBullets(notes, s.id) : [];
              const sounding = playing?.id === s.id;
              return (
                <li key={s.id} data-segment={s.id} className="group/line relative animate-print">
                  <div
                    role={n ? "button" : undefined}
                    tabIndex={n ? 0 : undefined}
                    aria-expanded={n ? open : undefined}
                    aria-label={n ? `Line cited as source ${n}. Show which notes cite it.` : undefined}
                    onClick={n ? () => receipts.toggleLine(s.id) : undefined}
                    onKeyDown={
                      n
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              receipts.toggleLine(s.id);
                            }
                          }
                        : undefined
                    }
                    data-active={active || undefined}
                    className={cx(
                      "relative overflow-hidden rounded-[3px] px-2.5 py-2.5 transition-colors duration-200",
                      sounding && !(active || playing?.single) ? "bg-black/[0.05]" : n ? "hover:bg-black/[0.035]" : "",
                      n && "cursor-pointer",
                    )}
                  >
                    {sounding && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-0 h-[2px] rounded-full bg-accent/70 transition-[width] duration-100 ease-linear"
                        style={{ width: `${Math.round((playing?.progress ?? 0) * 100)}%` }}
                      />
                    )}
                    <div className={cx("flex items-baseline justify-between gap-3 text-[11.5px] uppercase text-[#6a655b]", playable && "pr-8")}>
                      <span className="truncate">
                        {speakerLabel(s)}
                        {n && (
                          <span className="fn-mark !text-[10px]">{n}</span>
                        )}
                      </span>
                      <time className="shrink-0 tabular-nums">{formatClock(s.t)}</time>
                    </div>
                    <p className="mt-1 text-[13.5px] leading-[1.62] text-[#26241f]">
                      <span
                        key={active || (sounding && playing?.single) ? "on" : "off"}
                        className={cx(active || (sounding && playing?.single) ? "hl hl-swipe" : "")}
                      >
                        {s.text}
                      </span>
                    </p>
                  </div>
                  {playable && onPlay && (
                    <button
                      type="button"
                      onClick={() => onPlay(s.id)}
                      aria-label={sounding ? "Stop playback" : `Hear this line (${formatClock(s.t)})`}
                      title={sounding ? "Stop" : "Hear this moment"}
                      className={cx(
                        "absolute right-1 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted transition-opacity hover:bg-black/[0.06] hover:text-ink focus-visible:opacity-100",
                        sounding ? "text-accent opacity-100" : "opacity-0 group-hover/line:opacity-100 [@media(hover:none)]:opacity-60",
                      )}
                    >
                      {sounding ? <PauseIcon size={14} /> : <SpeakerIcon size={16} />}
                    </button>
                  )}
                  {open && (
                    <div className="paper paper-cream animate-settle mx-2 mb-3 mt-1 rotate-[-0.5deg] rounded-[2px] p-3 font-serif">
                      <p className="smallcaps mb-1.5 text-[10px] text-muted">Cited in your notes</p>
                      {citing.length === 0 ? (
                        <p className="text-[15px] italic text-muted">No bullets cite this line.</p>
                      ) : (
                        <ul className="space-y-1">
                          {citing.map((b) => (
                            <li key={b.key}>
                              <button
                                type="button"
                                onClick={() => receipts.selectBullet(b.key)}
                                className="w-full rounded-sm px-2 py-1.5 text-left text-[15.5px] leading-snug text-ink-2 hover:bg-wash"
                              >
                                <span className="block text-[13px] italic text-muted">{b.heading}</span>
                                {b.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {interim && interim.text && (
              <li className="px-2.5 py-2.5" aria-hidden>
                <div className="flex items-baseline justify-between gap-3 text-[11.5px] uppercase text-[#6a655b]">
                  <span className="flex items-center gap-1.5">
                    {speakerLabel(interim)}
                    <span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-faint" />
                  </span>
                  <time className="tabular-nums">{formatClock(interim.t)}</time>
                </div>
                <p className="mt-1 text-[13.5px] leading-[1.62] text-faint">{interim.text}</p>
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}

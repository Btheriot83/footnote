"use client";
import { useEffect, useRef } from "react";
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

  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      {header}
      <div
        ref={scroller}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-5"
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
          <ol className="space-y-1.5">
            {segments.map((s) => {
              const n = numbers.get(s.id);
              const active = receipts.activeSegments.has(s.id);
              const open = receipts.openLine === s.id;
              const citing = open ? citingBullets(notes, s.id) : [];
              return (
                <li key={s.id} data-segment={s.id} className="animate-fade-up">
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
                    className={cx(
                      "rounded-2xl px-3 py-3 transition-colors duration-200",
                      active ? "bg-accent-soft" : n ? "hover:bg-paper-2/70" : "",
                      n && "cursor-pointer",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[14px] text-muted">
                      <span className="truncate">
                        {speakerLabel(s)}
                        {n && (
                          <span className="ml-1.5 align-super text-[10.5px] font-semibold text-accent">{n}</span>
                        )}
                      </span>
                      <time className="shrink-0 tabular-nums">{formatClock(s.t)}</time>
                    </div>
                    <p className="mt-1 font-serif text-[17.5px] leading-[1.45] text-ink">{s.text}</p>
                  </div>
                  {open && (
                    <div className="animate-fade-in mx-3 mb-2 mt-1 rounded-xl border border-rule bg-sheet p-3 shadow-card">
                      <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
                        Cited in your notes
                      </p>
                      {citing.length === 0 ? (
                        <p className="text-[14px] text-muted">No bullets cite this line.</p>
                      ) : (
                        <ul className="space-y-1">
                          {citing.map((b) => (
                            <li key={b.key}>
                              <button
                                type="button"
                                onClick={() => receipts.selectBullet(b.key)}
                                className="w-full rounded-lg px-2 py-1.5 text-left text-[14.5px] leading-snug text-ink-2 hover:bg-paper-2"
                              >
                                <span className="block text-[12px] text-muted">{b.heading}</span>
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
              <li className="px-3 py-3" aria-hidden>
                <div className="flex items-baseline justify-between gap-3 text-[14px] text-muted">
                  <span className="flex items-center gap-1.5">
                    {speakerLabel(interim)}
                    <span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-faint" />
                  </span>
                  <time className="tabular-nums">{formatClock(interim.t)}</time>
                </div>
                <p className="mt-1 font-serif text-[17.5px] leading-[1.45] text-faint">{interim.text}</p>
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}

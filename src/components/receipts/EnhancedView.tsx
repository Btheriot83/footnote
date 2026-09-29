"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { formatClock } from "@/lib/format";
import type { EnhancedNotes, Segment } from "@/lib/types";
import { ReceiptPopover } from "./ReceiptPopover";
import type { Receipts } from "./useReceipts";

interface Props {
  notes: EnhancedNotes;
  numbers: Map<string, number>;
  segmentsById: Map<string, Segment>;
  receipts: Receipts;
  streaming?: boolean;
  /** When the transcript isn't visible (phone, share page), footnotes open an inline quote. */
  inlineQuotes?: boolean;
  /** Called when a footnote is clicked (e.g. to play that moment). */
  onCite?: (segmentId: string) => void;
  /** Segment currently playing, so its footnotes can show it. */
  playingId?: string | null;
  /** The cited moments have audio: the hover receipt offers "hear it". */
  audible?: boolean;
  /** A footnote has just been stamped onto the page while writing (to flash its line). */
  onLand?: (segmentId: string) => void;
}

const HOVER_OPEN_MS = 140;
const HOVER_CLOSE_MS = 220;

export function EnhancedView({
  notes,
  numbers,
  segmentsById,
  receipts,
  streaming,
  inlineQuotes,
  onCite,
  playingId,
  audible,
  onLand,
}: Props) {
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const [pop, setPop] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landed = useRef<Set<string> | null>(null);

  // While the notes are being written, each footnote that lands flashes its transcript line.
  useEffect(() => {
    if (!streaming) {
      landed.current = null;
      return;
    }
    if (!landed.current) landed.current = new Set();
    const seen = landed.current;
    const fresh: string[] = [];
    notes.sections.forEach((s) => s.bullets.forEach((b) => b.cites.forEach((c) => !seen.has(c) && (seen.add(c), fresh.push(c)))));
    if (!fresh.length || !onLand) return;
    const timers = fresh.map((c, i) => setTimeout(() => onLand(c), 620 + i * 90));
    return () => timers.forEach(clearTimeout);
  }, [notes, streaming, onLand]);

  const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const openPop = (id: string, el: HTMLElement) => {
    if (inlineQuotes || !hoverable()) return;
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop({ id, anchor: el.getBoundingClientRect() }), pop ? 0 : HOVER_OPEN_MS);
  };
  const closePop = () => {
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop(null), HOVER_CLOSE_MS);
  };
  const keepPop = () => {
    if (popTimer.current) clearTimeout(popTimer.current);
  };
  useEffect(() => {
    if (!pop) return;
    const close = () => setPop(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [pop]);
  useEffect(() => () => {
    if (popTimer.current) clearTimeout(popTimer.current);
  }, []);
  const popSeg = pop ? segmentsById.get(pop.id) : null;

  // Scroll to and flash a bullet selected from the transcript.
  useEffect(() => {
    if (!receipts.flashBullet) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-bullet="${receipts.flashBullet.key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate(
      [{ backgroundColor: "rgba(224,72,43,0.16)" }, { backgroundColor: "rgba(224,72,43,0)" }],
      { duration: 1400, easing: "ease-out" },
    );
  }, [receipts.flashBullet]);

  return (
    <div ref={rootRef} className="space-y-7" onMouseLeave={() => receipts.hoverCites(null)}>
      {notes.sections.map((section, si) => (
        <section key={si}>
          <h3
            className={cx(
              "font-serif text-[25px] font-medium leading-tight tracking-[-0.015em] text-ink sm:text-[27px]",
              streaming && "ink-in",
            )}
            style={{ ["--ink-dur" as string]: "650ms" }}
          >
            {section.heading}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {section.bullets.map((b, bi) => {
              const key = `${si}:${bi}`;
              const highlighted = receipts.highlightedBullets.has(key);
              const quoteOpen = openQuote === key;
              const [head, last] = splitLastWord(b.text);
              const tone = b.origin === "you" ? "text-ink" : "text-ink-2";
              return (
                <li
                  key={bi}
                  data-bullet={key}
                  data-origin={b.origin}
                  className={cx(
                    "group relative -mx-2 rounded-lg px-2 py-0.5 pl-7 font-serif text-[18.5px] leading-[1.55] transition-colors sm:text-[19.5px]",
                    streaming && "ink-in",
                    highlighted && "bg-accent-softer shadow-[inset_2px_0_0_var(--color-accent)]",
                  )}
                  onMouseEnter={() => b.cites.length && receipts.hoverCites(b.cites)}
                >
                  <span
                    aria-hidden
                    className={cx("absolute left-2.5 top-[0.72em]", b.origin === "you" ? "dot-you" : "dot-ai -ml-px")}
                  />
                  <span className={tone}>{head}</span>
                  {/* The last word and its footnote numbers never wrap apart. */}
                  <span className="whitespace-nowrap">
                    <span className={tone}>
                      {last}
                      {b.origin === "ai" && <span className="sr-only"> (added by AI)</span>}
                    </span>
                    {inlineQuotes && sortedCites(b.cites, numbers).length > 1 ? (
                      // Where fingers tap, a bullet's footnotes are one pill: one tap opens all its sources.
                      (() => {
                        const cs = sortedCites(b.cites, numbers);
                        const first = cs[0];
                        return (
                          <button
                            type="button"
                            className={cx("fn-mark fn-group", streaming && "stamp")}
                            style={streaming ? { ["--stamp-delay" as string]: "560ms" } : undefined}
                            data-active={cs.some((c) => receipts.activeSegments.has(c)) || quoteOpen}
                            data-playing={cs.includes(playingId ?? "") || undefined}
                            aria-expanded={quoteOpen}
                            aria-label={`Sources ${cs.map((c) => numbers.get(c)).join(" and ")}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              receipts.clickCite(first);
                              onCite?.(first);
                              setOpenQuote(quoteOpen ? null : key);
                            }}
                          >
                            {cs.map((c) => (
                              <span key={c}>{numbers.get(c)}</span>
                            ))}
                          </button>
                        );
                      })()
                    ) : sortedCites(b.cites, numbers)
                      .map((c, ci) => {
                        const n = numbers.get(c);
                        const seg = segmentsById.get(c);
                        if (!n) return null;
                        return (
                          <button
                            key={c}
                            type="button"
                            className={cx("fn-mark", streaming && "stamp")}
                            style={streaming ? { ["--stamp-delay" as string]: `${560 + ci * 110}ms` } : undefined}
                            data-active={receipts.activeSegments.has(c) || pop?.id === c}
                            data-playing={playingId === c || undefined}
                            aria-expanded={inlineQuotes ? quoteOpen : undefined}
                            aria-label={`Source ${n}${seg ? `: ${seg.label || seg.speaker} at ${formatClock(seg.t)}` : ""}`}
                            onMouseEnter={(e) => {
                              receipts.hoverCites([c]);
                              openPop(c, e.currentTarget);
                            }}
                            onMouseLeave={closePop}
                            onFocus={() => receipts.hoverCites([c])}
                            onClick={(e) => {
                              e.stopPropagation();
                              receipts.clickCite(c);
                              onCite?.(c);
                              if (inlineQuotes) setOpenQuote(quoteOpen ? null : key);
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                  </span>
                  {inlineQuotes && quoteOpen && (
                    <div className="feed mb-3 mt-3" style={{ ["--feed-dur" as string]: "480ms", ["--feed-steps" as string]: "7" }}>
                      <div className="receipt space-y-2 px-4 py-3">
                        {sortedCites(b.cites, numbers).map((c) => {
                          const seg = segmentsById.get(c);
                          if (!seg) return null;
                          return (
                            <figure key={c} className="text-[13.5px] leading-[1.6]">
                              <figcaption className="mb-0.5 flex items-baseline justify-between text-[11.5px] uppercase text-[var(--receipt-dim)]">
                                <span>
                                  {seg.label || seg.speaker} <span className="fn-mark !text-[10px]">{numbers.get(c)}</span>
                                </span>
                                <span className="tabular-nums">{formatClock(seg.t)}</span>
                              </figcaption>
                              <blockquote className="text-[var(--receipt-ink)]">
                                <span className="hl hl-swipe" style={{ ["--hl-delay" as string]: "420ms" }}>
                                  {seg.text}
                                </span>
                              </blockquote>
                              {audible && onCite && (
                                <button
                                  type="button"
                                  onClick={() => onCite(c)}
                                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-[var(--receipt-ink)]"
                                >
                                  {playingId === c ? "■ PLAYING" : "▶ HEAR IT"}
                                </button>
                              )}
                            </figure>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {streaming && si === notes.sections.length - 1 && (
              <li className="relative pl-7 font-serif text-[19px] text-faint" aria-hidden>
                <span className="caret-blink" />
              </li>
            )}
          </ul>
        </section>
      ))}
      {pop && popSeg && (
        <ReceiptPopover
          seg={popSeg}
          n={numbers.get(pop.id) ?? 0}
          anchor={pop.anchor}
          audible={audible}
          playing={playingId === pop.id}
          onHear={onCite ? () => onCite(pop.id) : undefined}
          onEnter={keepPop}
          onLeave={closePop}
        />
      )}
    </div>
  );
}

function sortedCites(cites: string[], numbers: Map<string, number>): string[] {
  return [...cites].filter((c) => numbers.has(c)).sort((a, z) => (numbers.get(a) ?? 0) - (numbers.get(z) ?? 0));
}

/** "a b c" -> ["a b ", "c"], so the last word can sit with its footnote markers. */
export function splitLastWord(text: string): [string, string] {
  const i = text.trimEnd().lastIndexOf(" ");
  return i < 0 ? ["", text] : [text.slice(0, i + 1), text.slice(i + 1)];
}

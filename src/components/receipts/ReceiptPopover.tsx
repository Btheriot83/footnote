"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PauseIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { formatClock } from "@/lib/format";
import type { Segment } from "@/lib/types";

/**
 * The same thermal slip the landing page prints, as a footnote's hover card: who said
 * it, when, the words themselves highlighted, and "hear it" when there's audio. It
 * feeds down out of the footnote like paper from a printer.
 */
export function ReceiptPopover({
  seg,
  n,
  anchor,
  audible,
  playing,
  onHear,
  onEnter,
  onLeave,
}: {
  seg: Segment;
  n: number;
  anchor: DOMRect;
  audible?: boolean;
  playing?: boolean;
  onHear?: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(vw - w - 12, Math.max(12, anchor.left + anchor.width / 2 - w / 2));
    const below = anchor.bottom + 10 + h < vh - 8 || anchor.top - h - 10 < 8;
    const top = below ? anchor.bottom + 8 : anchor.top - h - 8;
    setPos({ left, top, below });
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed z-[55] w-[300px] [clip-path:inset(-4px_-40px_-60px_-40px)]"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
    >
      <div
        key={seg.id}
        className={cx(pos?.below === false ? "animate-settle" : "feed")}
        style={{ ["--feed-dur" as string]: "420ms", ["--feed-steps" as string]: "6" }}
      >
        <div className="receipt px-4 pb-3 pt-3 text-[12.5px] leading-[1.55] shadow-lift">
          <p className="flex items-baseline justify-between gap-3 text-[11px] uppercase text-[var(--receipt-dim)]">
            <span className="truncate">
              {seg.label || (seg.speaker === "them" ? "Them" : "You")} <span className="fn-mark !text-[10px]">{n}</span>
            </span>
            <span className="tabular-nums">{formatClock(seg.t)}</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--receipt-ink)]">
            <span className="hl hl-swipe" style={{ ["--hl-delay" as string]: "380ms" }}>
              {seg.text}
            </span>
          </p>
          {audible && onHear && (
            <>
              <hr className="receipt-rule my-2" />
              <button
                type="button"
                onClick={onHear}
                className="-mx-1.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-[var(--receipt-ink)] hover:bg-[#efe9dc]"
              >
                {playing ? <PauseIcon size={12} /> : <span aria-hidden>▶</span>}
                {playing ? "PLAYING" : "HEAR IT"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

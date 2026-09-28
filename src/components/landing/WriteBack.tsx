"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SparkIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { Receipt, ReceiptRule } from "./Paper";
import { useSampleClip } from "./useSampleClip";

const TYPED = "40 → 120 seats by march";
const QUOTE = { who: "DANA (ACME)", at: "00:26", before: "Support goes from 40 people to about 110 by March.", quote: "With ops and success, call it 120 seats.", from: 26500, to: 34700 };

/*
 * Phases of the little film:
 * 0 waiting · 1 typing · 2 Enhance pressed · 3 the line inks in · 4 its footnote
 * stamps · 5 the receipt prints · 6 done (highlight sweeps).
 */
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Shows a receipt being earned instead of explaining it: a rough note is typed, Enhance
 * is pressed, a gray line inks onto the page, its footnote stamps in, and a receipt
 * slides out with the words highlighted. Plays when scrolled into view; replays on hover.
 */
export function WriteBack() {
  const [phase, setPhase] = useState<Phase>(0);
  const [typed, setTyped] = useState(0);
  const [run, setRun] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const left = useRef(false);
  const clip = useSampleClip();

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = useCallback(() => {
    clear();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(TYPED.length);
      setPhase(6);
      return;
    }
    setRun((r) => r + 1);
    setPhase(1);
    setTyped(0);
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const perChar = 58;
    for (let i = 1; i <= TYPED.length; i++) at(250 + i * perChar + (i % 5 === 0 ? 40 : 0), () => setTyped(i));
    const typedAt = 250 + TYPED.length * perChar + 300;
    at(typedAt, () => setPhase(2));
    at(typedAt + 420, () => setPhase(3));
    at(typedAt + 1320, () => setPhase(4));
    at(typedAt + 1900, () => setPhase(5));
    at(typedAt + 3100, () => setPhase(6));
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const r = requestAnimationFrame(play);
      return () => cancelAnimationFrame(r);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, [play]);

  const done = phase === 6;
  return (
    <div
      ref={root}
      className="relative mx-auto mt-14 max-w-[1120px] lg:mt-16"
      onMouseLeave={() => (left.current = true)}
      onMouseEnter={() => {
        if (done && left.current) {
          left.current = false;
          play();
        }
      }}
    >
      <div className="grid items-center gap-8 lg:grid-cols-[340px_140px_1fr] lg:gap-6">
        {/* 1. Rough notes on an index card */}
        <div className="mx-auto w-full max-w-[350px] -rotate-[2deg]">
          <div className="paper paper-index lift rounded-[2px] pb-7 pl-[54px] pr-5 pt-[14px] [--rule-gap:34px] [--rule-top:44px]">
            <p className="smallcaps h-[30px] pt-[9px] text-pen/80">Your notes · 00:31</p>
            <ul className="translate-y-[6px] font-hand text-[24px] leading-[34px] text-pen">
              <li>acme renewal w/ Dana (ops)</li>
              <li>series B closed?? 32M</li>
              <li className="min-h-[34px]">
                {TYPED.slice(0, phase === 0 ? 0 : phase >= 2 ? TYPED.length : typed)}
                {phase === 1 && <span className="caret-blink text-pen/70" aria-hidden />}
              </li>
            </ul>
          </div>
        </div>

        {/* 2. The one keystroke */}
        <div className="flex flex-col items-center gap-2" aria-hidden>
          <span
            className={cx(
              "pill h-11 px-5 text-[11px] transition-[scale,background,color] duration-300",
              phase >= 2 && "pill-ink",
              phase === 2 && "scale-[0.93]",
            )}
          >
            <SparkIcon size={15} /> Enhance
          </span>
          <span className="on-wood-2 font-hand text-[19px]">one keystroke</span>
          <svg width="90" height="22" viewBox="0 0 90 22" className="hidden text-[var(--on-wood-2)] lg:block" fill="none">
            <path d="M2 12c18-8 40-9 60-3 7 2 14 3 24 0M78 3l8 6-9 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* 3. The page, and the receipt it earns */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="paper paper-cream sheet-shadow relative z-[2] rotate-[1deg] rounded-[2px] px-7 pb-7 pt-6 sm:px-9">
            <p className="smallcaps text-muted">Enhanced notes</p>
            <h3 className="mt-2 font-serif text-[25px] font-medium leading-tight tracking-[-0.01em]">What they need</h3>
            <ul className="mt-3 space-y-2 font-serif text-[18.5px] leading-snug">
              <li className="flex gap-2.5 text-ink">
                <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
                <span>Renewal with Dana from ops</span>
              </li>
              <li className="flex min-h-[1.4em] gap-2.5 text-muted">
                {phase >= 3 && (
                  <>
                    <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-faint" />
                    <span key={`ink-${run}`} className="ink-in">
                      Seats grow from 40 to about 120 by{" "}
                      <span className="whitespace-nowrap">
                        March
                        {phase >= 4 && (
                          <span key={`fn-${run}`} className="fn-mark stamp" data-active={phase === 4 || phase === 5}>
                            2
                          </span>
                        )}
                      </span>
                    </span>
                  </>
                )}
              </li>
            </ul>
          </div>
          <div className="relative z-[1] mx-auto -mt-1 w-[88%] [clip-path:inset(0_-60px_-80px_-60px)]">
            {phase >= 5 ? (
              <div key={`slip-${run}`} className="feed" style={{ ["--feed-dur" as string]: "1100ms" }}>
                <Receipt className="-rotate-[1.2deg] px-5 pb-4 pt-4">
                  <p className="flex justify-between text-[11.5px] text-[#5d584f]">
                    <span>
                      {QUOTE.who} <span className="fn-mark !text-[10px]">2</span>
                    </span>
                    <span className="tabular-nums">{QUOTE.at}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.6] text-[var(--receipt-ink)]">
                    {QUOTE.before}{" "}
                    <mark className="hl hl-swipe bg-transparent text-inherit" style={{ ["--hl-delay" as string]: "1150ms" }}>
                      {QUOTE.quote}
                    </mark>
                  </p>
                  <ReceiptRule />
                  <div className="flex items-center justify-between text-[11px] text-[var(--receipt-dim)]">
                    <span>THE RECEIPT</span>
                    <button
                      type="button"
                      onClick={() => void clip.play("writeback", QUOTE.from, QUOTE.to)}
                      className="-mr-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono tracking-[0.08em] text-[var(--receipt-ink)] hover:bg-[#efe9dc]"
                      aria-label={clip.playing ? "Stop" : "Hear Dana say it (00:26)"}
                    >
                      {clip.playing ? <span className="h-2 w-2 rounded-[1px] bg-accent" aria-hidden /> : <span aria-hidden>▶</span>}
                      {clip.playing ? "PLAYING" : "HEAR IT"}
                    </button>
                  </div>
                </Receipt>
              </div>
            ) : (
              <div className="h-[150px]" />
            )}
          </div>
          {done && (
            <button
              type="button"
              onClick={play}
              className="on-wood-2 animate-fade-in absolute -bottom-9 right-2 rounded-full px-2 py-1 font-hand text-[19px] hover:underline"
            >
              ↺ watch it again
            </button>
          )}
        </div>
      </div>
      <p className="sr-only">
        A rough note, “40 → 120 seats by march”, becomes the line “Seats grow from 40 to about 120 by March”, footnote 2,
        which cites Dana at 00:26: “Support goes from 40 people to about 110 by March. With ops and success, call it 120 seats.”
      </p>
    </div>
  );
}

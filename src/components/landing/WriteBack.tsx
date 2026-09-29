"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SparkIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { Receipt, ReceiptRule } from "./Paper";
import { useSampleClip } from "./useSampleClip";

const TYPED = "40 → 120 seats by march";
const LINES = [
  { text: "Series B closed: $32M", origin: "you", n: 1 },
  { text: "Led by Northstar, two weeks ago", origin: "ai", n: 1 },
  { text: "Seats grow from 40 to about 120 by March", origin: "you", n: 2 },
] as const;
/** Each footnote's receipt: the words it cites and the seconds of the sample call they were said in. */
const QUOTES = {
  1: { who: "DANA (ACME)", at: "00:15", before: "Right, we closed our Series B two weeks ago.", quote: "$32 million, led by Northstar.", from: 15760, to: 22500 },
  2: { who: "DANA (ACME)", at: "00:26", before: "Support goes from 40 people to about 110 by March.", quote: "With ops and success, call it 120 seats.", from: 26500, to: 34700 },
} as const;
type Fn = keyof typeof QUOTES;

/*
 * Phases of the little film:
 * 0 waiting · 1 typing · 2 Enhance pressed · 3 the lines ink in · 4 their footnotes
 * stamp · 5 the receipt prints · 6 done (highlight sweeps).
 */
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Shows a receipt being earned instead of explaining it: a rough note is typed, Enhance
 * is pressed, the lines ink onto the page (what the call added marked with a red ring), its footnote stamps in, and a receipt
 * slides out with the words highlighted. Plays when scrolled into view; a footnote plays what it cites.
 */
export function WriteBack() {
  const [phase, setPhase] = useState<Phase>(0);
  const [typed, setTyped] = useState(0);
  const [run, setRun] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clip = useSampleClip();
  /** Which footnote's receipt is out, and a counter that re-feeds (slip) or re-swipes (hl) it. */
  const [shown, setShown] = useState<Fn>(2);
  const [slip, setSlip] = useState(0);
  const [swipe, setSwipe] = useState(0);
  const playingFn = clip.playing?.startsWith("wb-") ? (Number(clip.playing.slice(3)) as Fn) : null;

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
    setShown(2);
    setSwipe(0);
    setPhase(1);
    setTyped(0);
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const perChar = 58;
    for (let i = 1; i <= TYPED.length; i++) at(250 + i * perChar + (i % 5 === 0 ? 40 : 0), () => setTyped(i));
    const typedAt = 250 + TYPED.length * perChar + 300;
    at(typedAt, () => setPhase(2));
    at(typedAt + 420, () => setPhase(3));
    at(typedAt + 1700, () => setPhase(4));
    at(typedAt + 2300, () => setPhase(5));
    at(typedAt + 3500, () => setPhase(6));
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

  /** A footnote on the page: its receipt prints (or re-highlights if it's already out) and the cited seconds play. Again stops. */
  const hear = (n: Fn) => {
    if (playingFn === n) {
      clip.stop();
      return;
    }
    // Clicking settles the little film where it is: no timer yanks the page back mid-listen.
    clear();
    setTyped(TYPED.length);
    setPhase(6);
    if (phase >= 5 && shown === n) setSwipe((k) => k + 1);
    else {
      setShown(n);
      setSwipe(0);
      setSlip((k) => k + 1);
    }
    const q = QUOTES[n];
    void clip.play(`wb-${n}`, q.from, q.to);
  };
  const q = QUOTES[shown];
  return (
    <div
      ref={root}
      className="relative mx-auto mt-14 max-w-[1120px] lg:mt-16"
      data-demo="write-up"
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
            <h3 className="mt-2 font-serif text-[25px] font-medium leading-tight tracking-[-0.01em]">Where they are</h3>
            {/* Every note line comes back written up; what the call adds is its own line, ringed in red. */}
            <ul className="mt-3 space-y-2 font-serif text-[18.5px] leading-snug">
              {LINES.map((l, i) => (
                <li key={i} className={cx("flex min-h-[1.4em] gap-2.5", l.origin === "you" ? "text-ink" : "text-ink-2")}>
                  {phase >= 3 ? (
                    <>
                      <span className={cx("mt-[0.5em]", l.origin === "you" ? "dot-you" : "dot-ai")} />
                      <span key={`ink-${run}`} className="ink-in" style={{ ["--ink-delay" as string]: `${i * 260}ms` }}>
                        {l.text.slice(0, l.text.lastIndexOf(" ") + 1)}
                        <span className="whitespace-nowrap">
                          {l.text.slice(l.text.lastIndexOf(" ") + 1)}
                          {phase >= 4 && (
                            <button
                              type="button"
                              key={`fn-${run}`}
                              onClick={() => hear(l.n)}
                              className="fn-mark stamp"
                              style={{ ["--stamp-delay" as string]: `${i * 120}ms` }}
                              data-active={l.n === shown && phase >= 4}
                              data-playing={playingFn === l.n || undefined}
                              data-footnote={l.n}
                              aria-pressed={playingFn === l.n}
                              aria-label={
                                playingFn === l.n
                                  ? `Footnote ${l.n}: stop playing Dana at ${QUOTES[l.n].at.replace(/^0/, "")}`
                                  : `Footnote ${l.n}: hear Dana at ${QUOTES[l.n].at.replace(/^0/, "")}`
                              }
                            >
                              {l.n}
                            </button>
                          )}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span aria-hidden className="ghost-line mt-[0.45em] block h-3 rounded-full" style={{ width: `${[58, 66, 82][i]}%` }} />
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="dot-you" /> from your notes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="dot-ai" /> added from the call
              </span>
            </p>
          </div>
          <div className="relative z-[1] mx-auto -mt-1 w-[88%] [clip-path:inset(0_-60px_-80px_-60px)]">
            {phase >= 5 ? (
              <div key={`slip-${run}-${slip}`} className="feed" style={{ ["--feed-dur" as string]: "1100ms" }}>
                <Receipt className="-rotate-[1.2deg] px-5 pb-4 pt-4">
                  <p className="flex justify-between text-[11.5px] text-[#5d584f]">
                    <span>
                      {q.who} <span className="fn-mark !text-[10px]">{shown}</span>
                    </span>
                    <span className="tabular-nums">{q.at}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.6] text-[var(--receipt-ink)]">
                    {q.before}{" "}
                    <mark
                      key={swipe}
                      className="hl hl-swipe bg-transparent text-inherit"
                      style={{ ["--hl-delay" as string]: swipe ? "0ms" : "1150ms" }}
                    >
                      {q.quote}
                    </mark>
                  </p>
                  <ReceiptRule />
                  <div className="flex items-center justify-between text-[11px] text-[var(--receipt-dim)]">
                    <span>THE RECEIPT</span>
                    <button
                      type="button"
                      onClick={() => hear(shown)}
                      className="-mr-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 font-mono tracking-[0.08em] text-[var(--receipt-ink)] hover:bg-black/[0.06]"
                      aria-label={playingFn === shown ? "Stop" : `Hear Dana say it (${q.at})`}
                    >
                      {playingFn === shown ? <span className="h-2 w-2 rounded-[1px] bg-accent" aria-hidden /> : <span aria-hidden>▶</span>}
                      {playingFn === shown ? "PLAYING" : "HEAR IT"}
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
              onClick={() => {
                clip.stop();
                play();
              }}
              className="on-wood-2 animate-fade-in absolute -bottom-9 right-2 motion-reduce:hidden rounded-full px-2 py-1 font-hand text-[19px] hover:underline"
            >
              ↺ watch it again
            </button>
          )}
        </div>
      </div>
      <p className="sr-only">
        Rough notes, “series B closed?? 32M” and “40 → 120 seats by march”, become “Series B closed: $32M” (footnote 1), an
        added line “Led by Northstar, two weeks ago” (footnote 1), and “Seats grow from 40 to about 120 by March”, footnote 2,
        which cites Dana at 00:26: “Support goes from 40 people to about 110 by March. With ops and success, call it 120 seats.”
      </p>
    </div>
  );
}

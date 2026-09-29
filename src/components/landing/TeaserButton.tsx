"use client";
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import { useSampleClip } from "./useSampleClip";

/** The first exchange that matters: "how are things at Acme?" and the Series B answer. */
const FROM = 8529;
const TO = 22324;
/** Where Dana starts on the Series B: the hero's first receipt. */
const SERIES_B = 15760;

/**
 * The round play button on the call-to-action strip: plays about fourteen seconds of the
 * sample call right here, with a ring that fills as it plays. The whole call is one
 * click further, in the app.
 */
export function TeaserButton({ className }: { className?: string }) {
  const clip = useSampleClip();
  const playing = clip.playing === "teaser";
  // When the preview reaches the Series B line, the hero's printer feeds that receipt.
  const fed = useRef(false);
  const pos = FROM + (TO - FROM) * clip.progress;
  useEffect(() => {
    if (!playing) {
      fed.current = false;
      return;
    }
    if (!fed.current && pos >= SERIES_B) {
      fed.current = true;
      window.dispatchEvent(new CustomEvent("footnote:hear", { detail: 0 }));
    }
  }, [playing, pos]);
  const r = 16.5;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      onClick={() => void clip.play("teaser", FROM, TO)}
      aria-label={playing ? "Stop the preview" : "Hear 14 seconds of the sample call"}
      aria-pressed={playing}
      className={cx(
        "group/teaser relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-[scale,color] duration-500 [transition-timing-function:var(--spring-bouncy)] hover:scale-[1.06] hover:text-ink active:scale-95",
        className,
      )}
    >
      <svg viewBox="0 0 38 38" className="absolute inset-[3px] -rotate-90" aria-hidden>
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--color-rule-strong)" strokeWidth="1.2" />
        <circle
          cx="19"
          cy="19"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (playing ? clip.progress : 0))}
          style={{ transition: playing ? "none" : "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      {playing ? (
        <span className="relative h-[9px] w-[9px] rounded-[1.5px] bg-accent" aria-hidden />
      ) : (
        <svg width="11" height="12" viewBox="0 0 11 12" className="relative ml-[2px]" aria-hidden>
          <path d="M1 1.2v9.6c0 .6.6.9 1.1.6l7.7-4.8c.5-.3.5-1 0-1.3L2.1.5C1.6.2 1 .6 1 1.2Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

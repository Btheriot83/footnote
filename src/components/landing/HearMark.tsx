"use client";
import { cx } from "@/components/ui";
import { useSampleClip } from "./useSampleClip";

/**
 * A footnote on a landing card that keeps its promise: click (or Enter/Space) plays the
 * seconds of the sample call it cites; again stops. The pill fills while it plays.
 */
export function HearMark({
  n,
  who,
  at,
  from,
  to,
  className,
}: {
  n: number;
  who: string;
  /** "0:15" */
  at: string;
  from: number;
  to: number;
  className?: string;
}) {
  const clip = useSampleClip();
  const key = `mark-${n}-${from}`;
  const playing = clip.playing === key;
  return (
    <button
      type="button"
      onClick={() => void clip.play(key, from, to)}
      className={cx("fn-mark", className)}
      data-playing={playing || undefined}
      data-footnote={n}
      aria-pressed={playing}
      aria-label={playing ? `Footnote ${n}: stop playing ${who} at ${at}` : `Footnote ${n}: hear ${who} at ${at}`}
    >
      {n}
    </button>
  );
}

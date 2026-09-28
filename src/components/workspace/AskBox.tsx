"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { AskIcon, CheckIcon, CopyIcon, ListIcon, MailIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { splitLastWord } from "@/components/receipts/EnhancedView";
import { Pen } from "@/components/receipts/Pen";
import type { Receipts } from "@/components/receipts/useReceipts";
import { RECIPES, type Recipe } from "@/lib/ask";
import { askMeeting, ApiError, type AskSentence } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { formatClock } from "@/lib/format";
import { cachedRecipe, isFullSampleTranscript } from "@/lib/sample/cached-asks";
import type { Meeting } from "@/lib/types";

const RECIPE_ICONS: Record<Recipe["id"], React.ReactNode> = {
  "follow-up": <MailIcon size={16} />,
  actions: <ListIcon size={16} />,
  "open-questions": <AskIcon size={16} />,
};

/** Groups sentences into paragraphs (or list items) where the model asked for a break. */
export function toBlocks(sentences: AskSentence[]): AskSentence[][] {
  const blocks: AskSentence[][] = [];
  for (const s of sentences) {
    if (s.newParagraph || blocks.length === 0) blocks.push([s]);
    else blocks[blocks.length - 1].push(s);
  }
  return blocks;
}

/**
 * One compact set of receipts per paragraph (or list item) instead of a chip after every
 * sentence: the unique cited lines, in the order they were said.
 */
export function blockCites(block: AskSentence[], order: (id: string) => number): string[] {
  return [...new Set(block.flatMap((s) => s.cites))].sort((a, b) => order(a) - order(b));
}

/** Receipts beyond this many fold behind a "+n" that opens them. */
export const VISIBLE_CITES = 4;

export function answerToText(sentences: AskSentence[], layout: "prose" | "email" | "list"): string {
  const blocks = toBlocks(sentences).map((b) => b.map((s) => s.text).join(" "));
  return layout === "list" ? blocks.map((b) => `- ${b}`).join("\n") : blocks.join("\n\n");
}

export function AskBox({
  meeting,
  receipts,
  onSettings,
  onCite,
  numbers,
}: {
  meeting: Meeting;
  receipts: Receipts;
  onSettings: () => void;
  onCite?: (id: string) => void;
  /** The notes' footnote numbers, so an answer cites the same line with the same number. */
  numbers?: Map<string, number>;
}) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ label: string; layout: "prose" | "email" | "list" } | null>(null);
  const [answer, setAnswer] = useState<AskSentence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const [cached, setCached] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);
  // Bring a fresh answer into view; it lands below the notes.
  useEffect(() => {
    if (!answer && !error) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [answer, error]);
  const byId = new Map(meeting.segments.map((s) => [s.id, s]));
  const order = (id: string) => byId.get(id)?.t ?? 0;
  const isSample = isFullSampleTranscript(meeting);
  // Lines the notes already cite keep their number; new ones continue after the last.
  const answerNumbers = new Map(numbers ?? []);
  let next = Math.max(0, ...answerNumbers.values());
  answer?.forEach((s) => s.cites.forEach((c) => !answerNumbers.has(c) && answerNumbers.set(c, ++next)));

  async function run(question: string, recipe?: Recipe) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    setAsked({ label: recipe?.label ?? question, layout: recipe?.layout ?? "prose" });
    setAnswer(null);
    setCached(false);
    setExpanded(new Set());
    try {
      setAnswer(await askMeeting(question, meeting.notes, meeting.segments, { recipe: recipe?.id }));
      if (!recipe) setQ("");
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("error", "Something went wrong.", 0);
      // No AI available right now: the sample's recipes have answers computed ahead of time.
      const fallback = (e.code === "no_key" || e.code === "limit") && cachedRecipe(meeting, recipe?.id);
      if (fallback) {
        setAnswer(fallback);
        setCached(true);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (question) void run(question);
  }

  async function copy() {
    if (!answer || !asked) return;
    try {
      await navigator.clipboard.writeText(answerToText(answer, asked.layout));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't access the clipboard.", { tone: "error" });
    }
  }

  const marker = (c: string) => {
    const seg = byId.get(c);
    if (!seg) return null;
    return (
      <button
        key={c}
        type="button"
        className="fn-mark"
        data-active={receipts.activeSegments.has(c)}
        onMouseEnter={() => receipts.hoverCites([c])}
        onMouseLeave={() => receipts.hoverCites(null)}
        onFocus={() => receipts.hoverCites([c])}
        onClick={() => {
          receipts.clickCite(c);
          onCite?.(c);
        }}
        aria-label={`Source: ${seg.label || seg.speaker} at ${formatClock(seg.t)}`}
        title={`${seg.label || seg.speaker}, ${formatClock(seg.t)}`}
      >
        {answerNumbers.get(c) ?? "·"}
      </button>
    );
  };

  // Each sentence carries its own receipts, right after it; a long run folds behind "+n".
  const block = (b: AskSentence[], bi: number) =>
    b.map((s, si) => {
      const cites = blockCites([s], order);
      const key = bi * 1000 + si;
      const open = expanded.has(key) || cites.length <= VISIBLE_CITES;
      const shownCites = open ? cites : cites.slice(0, VISIBLE_CITES - 1);
      const [head, last] = splitLastWord(s.text);
      return (
        <Fragment key={si}>
          {si > 0 && " "}
          {head}
          <span className="whitespace-nowrap">
            {last}
            {shownCites.map(marker)}
            {!open && (
              <button
                type="button"
                className="fn-mark"
                onClick={() => setExpanded((x) => new Set(x).add(key))}
                aria-label={`Show ${cites.length - shownCites.length} more sources`}
              >
                +{cites.length - shownCites.length}
              </button>
            )}
          </span>
        </Fragment>
      );
    });

  return (
    <section className="mt-16 border-t border-rule pt-8" aria-labelledby="ask-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ask-heading" className="font-serif text-[25px] font-medium leading-tight tracking-[-0.015em] text-ink">
          Ask this meeting
        </h2>
        <p className="text-[15px] italic text-muted">Answers cite the transcript, like the notes do.</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={loading}
            onClick={() => void run(r.question, r)}
            className={cx(btn.base, btn.secondary, "h-9 px-4 text-[10.5px]")}
          >
            <span className="text-muted">{RECIPE_ICONS[r.id]}</span>
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="relative mt-3">
        <label htmlFor="ask" className="sr-only">
          Ask this meeting
        </label>
        <AskIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={19} />
        <input
          id="ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Or ask anything… “What did they say about budget?”"
          className="paper paper-white h-12 w-full rounded-[3px] pl-11 pr-20 text-[17px] placeholder:italic placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink-2),var(--shadow-card)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="pill pill-ink absolute right-2 top-1/2 h-8 -translate-y-1/2 px-4 text-[10px]"
        >
          Ask
        </button>
      </form>

      {(loading || answer || error) && asked && (
        <div
          ref={resultRef}
          className={cx(
            "animate-settle mt-5 scroll-mb-6 rounded-[2px] px-6 py-5",
            asked.layout === "email" ? "paper paper-white" : asked.layout === "list" ? "paper paper-butter" : "paper paper-stone",
          )}
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="smallcaps flex items-center gap-2 text-[10.5px] text-muted">
              {asked.label}
              {cached && (
                <span
                  className="-rotate-[2deg] rounded-[2px] border-[1.5px] border-accent/60 px-1.5 py-[1px] text-[9px] font-bold tracking-[0.18em] text-accent/90"
                  title="No AI key is available right now, so this answer was computed ahead of time from the sample call."
                >
                  Cached demo
                </span>
              )}
            </p>
            {answer && answer.length > 0 && (
              <button
                type="button"
                onClick={() => void copy()}
                className="smallcaps -mr-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] text-muted hover:bg-ink/5 hover:text-ink"
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {copied ? "Copied" : asked.layout === "email" ? "Copy email" : "Copy"}
              </button>
            )}
          </div>
          {loading && <Pen label="Reading the transcript…" className="mt-2" />}
          {error && (
            <p className="mt-1.5 text-[14.5px] text-ink-2">
              {error.message}{" "}
              {(error.code === "no_key" || error.code === "limit") && (
                <button type="button" onClick={onSettings} className="font-medium underline underline-offset-2">
                  Add your key
                </button>
              )}
              {error.code === "no_key" && isSample && (
                <span className="mt-1 block text-[13.5px] text-muted">
                  The three one-click recipes above still work here, as cached demos.
                </span>
              )}
            </p>
          )}
          {answer &&
            (answer.length === 0 ? (
              <p className="mt-1.5 font-serif text-[17.5px] text-ink">Nothing in this meeting answers that.</p>
            ) : asked.layout === "list" ? (
              <ul className="mt-2 space-y-2">
                {toBlocks(answer).map((b, bi) => (
                  <li key={bi} className="relative pl-5 font-serif text-[17.5px] leading-relaxed text-ink">
                    <span className="absolute left-1 top-[0.72em] h-[5px] w-[5px] rounded-full bg-ink/60" aria-hidden />
                    {block(b, bi)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 space-y-3 font-serif text-[17.5px] leading-relaxed text-ink">
                {toBlocks(answer).map((b, bi) => (
                  <p key={bi}>{block(b, bi)}</p>
                ))}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

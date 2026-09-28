"use client";
import { useState } from "react";
import { AskIcon, CheckIcon, CopyIcon, ListIcon, MailIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
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
}: {
  meeting: Meeting;
  receipts: Receipts;
  onSettings: () => void;
  onCite?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ label: string; layout: "prose" | "email" | "list" } | null>(null);
  const [answer, setAnswer] = useState<AskSentence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const [cached, setCached] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const byId = new Map(meeting.segments.map((s) => [s.id, s]));
  const order = (id: string) => byId.get(id)?.t ?? 0;
  const isSample = isFullSampleTranscript(meeting);

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
        className="fn-mark ml-0.5 tabular-nums"
        data-active={receipts.activeSegments.has(c)}
        onMouseEnter={() => receipts.hoverCites([c])}
        onMouseLeave={() => receipts.hoverCites(null)}
        onFocus={() => receipts.hoverCites([c])}
        onClick={() => {
          receipts.clickCite(c);
          onCite?.(c);
        }}
        aria-label={`Source: ${seg.label || seg.speaker} at ${formatClock(seg.t)}`}
      >
        {formatClock(seg.t)}
      </button>
    );
  };

  const block = (b: AskSentence[], bi: number) => {
    const cites = blockCites(b, order);
    const open = expanded.has(bi) || cites.length <= VISIBLE_CITES;
    const shownCites = open ? cites : cites.slice(0, VISIBLE_CITES - 1);
    return (
      <>
        {b.map((s) => s.text).join(" ")}
        <span className="whitespace-nowrap">{shownCites.map(marker)}</span>
        {!open && (
          <button
            type="button"
            className="fn-mark ml-0.5"
            onClick={() => setExpanded((x) => new Set(x).add(bi))}
            aria-label={`Show ${cites.length - shownCites.length} more sources`}
          >
            +{cites.length - shownCites.length}
          </button>
        )}
      </>
    );
  };

  return (
    <section className="mt-16 border-t border-rule pt-8" aria-labelledby="ask-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ask-heading" className="font-serif text-[22px] leading-tight text-ink">
          Ask this meeting
        </h2>
        <p className="text-[13px] text-muted">Answers cite the transcript, like the notes do.</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={loading}
            onClick={() => void run(r.question, r)}
            className={cx(btn.base, btn.secondary, "h-9 rounded-full px-3.5 text-[14px] font-normal text-ink-2")}
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
          className="h-12 w-full rounded-2xl border border-rule bg-paper/50 pl-11 pr-20 text-[15.5px] placeholder:text-faint focus:border-rule-strong focus:bg-sheet focus:outline-none"
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-ink px-3 text-[13.5px] font-medium text-paper disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      {(loading || answer || error) && asked && (
        <div
          className={cx(
            "animate-fade-up mt-4 rounded-2xl px-5 py-4",
            asked.layout === "email" ? "border border-rule bg-white shadow-card" : "bg-paper/60",
          )}
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
              {asked.label}
              {cached && (
                <span
                  className="rounded-full border border-rule px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em]"
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
                className="-mr-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted hover:bg-paper-2 hover:text-ink"
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {copied ? "Copied" : asked.layout === "email" ? "Copy email" : "Copy"}
              </button>
            )}
          </div>
          {loading && (
            <div className="mt-3 space-y-2.5" role="status" aria-label="Reading the transcript">
              {[88, 72, 80].map((w, i) => (
                <div key={i} className="h-[13px] animate-pulse rounded-full bg-paper-2" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
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

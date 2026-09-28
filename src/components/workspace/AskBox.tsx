"use client";
import { useState } from "react";
import { AskIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import type { Receipts } from "@/components/receipts/useReceipts";
import { askMeeting, ApiError, type AskSentence } from "@/lib/client/api";
import { formatClock } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export function AskBox({ meeting, receipts, onSettings }: { meeting: Meeting; receipts: Receipts; onSettings: () => void }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<AskSentence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const byId = new Map(meeting.segments.map((s) => [s.id, s]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setError(null);
    setAsked(question);
    setAnswer(null);
    try {
      setAnswer(await askMeeting(question, meeting.notes, meeting.segments));
      setQ("");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("error", "Something went wrong.", 0));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-14 border-t border-rule pt-6" aria-label="Ask this meeting">
      <form onSubmit={submit} className="relative">
        <label htmlFor="ask" className="sr-only">
          Ask this meeting
        </label>
        <AskIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={19} />
        <input
          id="ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask this meeting… e.g. “What did they say about budget?”"
          className="h-12 w-full rounded-2xl border border-rule bg-paper/50 pl-11 pr-20 text-[15.5px] placeholder:text-faint focus:border-rule-strong focus:bg-sheet focus:outline-none"
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-ink px-3 text-[13.5px] font-medium text-paper disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {(loading || answer || error) && (
        <div className="animate-fade-up mt-3 rounded-2xl bg-paper/60 px-4 py-3.5">
          <p className="text-[13px] text-muted">{asked}</p>
          {loading && <p className="mt-1.5 font-serif text-[17px] text-faint">Looking through the transcript…</p>}
          {error && (
            <p className="mt-1.5 text-[14.5px] text-ink-2">
              {error.message}{" "}
              {(error.code === "no_key" || error.code === "limit") && (
                <button type="button" onClick={onSettings} className="font-medium underline underline-offset-2">
                  Add your key
                </button>
              )}
            </p>
          )}
          {answer && (
            <p className="mt-1.5 font-serif text-[17.5px] leading-relaxed text-ink">
              {answer.length === 0 && "No answer found in this meeting."}
              {answer.map((s, i) => (
                <span key={i}>
                  {s.text}
                  {s.cites.map((c) => {
                    const seg = byId.get(c);
                    if (!seg) return null;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={cx("fn-mark ml-0.5 tabular-nums")}
                        data-active={receipts.activeSegments.has(c)}
                        onMouseEnter={() => receipts.hoverCites([c])}
                        onMouseLeave={() => receipts.hoverCites(null)}
                        onFocus={() => receipts.hoverCites([c])}
                        onClick={() => receipts.clickCite(c)}
                        aria-label={`Source: ${seg.label || seg.speaker} at ${formatClock(seg.t)}`}
                      >
                        {formatClock(seg.t)}
                      </button>
                    );
                  })}{" "}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

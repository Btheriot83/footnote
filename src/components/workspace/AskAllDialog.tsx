"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { AskIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { askMeetings, ApiError, type AskSentence } from "@/lib/client/api";
import { formatClock, formatDate } from "@/lib/format";
import { rankMeetings } from "@/lib/rank";
import type { Meeting } from "@/lib/types";
import { toBlocks } from "./AskBox";

const EXAMPLES = ["What did I promise people?", "Where does the Acme deal stand?", "Who is blocked, and on what?"];

interface Props {
  open: boolean;
  onClose: () => void;
  meetings: Meeting[] | undefined;
  initialQuestion?: string;
  onOpenSource: (meetingId: string, segmentId: string) => void;
  onSettings: () => void;
}

/** Granola-style chat across meetings, except every sentence carries a receipt. */
export function AskAllDialog({ open, onClose, meetings, initialQuestion, onOpenSource, onSettings }: Props) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<AskSentence[] | null>(null);
  const [refs, setRefs] = useState<Map<string, Meeting>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAsked = useRef(false);

  const usable = (meetings ?? []).filter((m) => m.segments.length > 0);

  async function run(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    const picked = rankMeetings(usable, text, 5);
    if (picked.length === 0) {
      setError(new ApiError("empty", "None of your meetings has a transcript yet.", 0));
      return;
    }
    const map = new Map(picked.map((m, i) => [`m${i + 1}`, m]));
    setRefs(map);
    setLoading(true);
    setError(null);
    setAnswer(null);
    setAsked(text);
    try {
      const res = await askMeetings(
        text,
        [...map].map(([ref, m]) => ({ ref, title: m.title || "Untitled meeting", date: formatDate(m.createdAt, { year: true }), notes: m.notes, segments: m.segments })),
      );
      setAnswer(res);
      setQ("");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("error", "Something went wrong.", 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      autoAsked.current = false;
      return;
    }
    setQ(initialQuestion ?? "");
    requestAnimationFrame(() => inputRef.current?.focus());
    if (initialQuestion && !autoAsked.current) {
      autoAsked.current = true;
      void run(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  const marker = (c: string) => {
    const [ref, sid] = c.split(":");
    const m = refs.get(ref);
    const seg = m?.segments.find((s) => s.id === sid);
    if (!m || !seg) return null;
    return (
      <button
        key={c}
        type="button"
        onClick={() => onOpenSource(m.id, sid)}
        className="ml-1 inline-flex translate-y-[-0.35em] items-baseline gap-1 rounded-md bg-accent-softer px-1.5 py-[1px] align-baseline font-sans text-[11.5px] font-medium leading-tight text-accent hover:bg-accent-soft"
        title={`${seg.label || seg.speaker}: “${seg.text}”`}
        aria-label={`Source: ${m.title}, ${seg.label || seg.speaker} at ${formatClock(seg.t)}. Open it.`}
      >
        <span className="max-w-[140px] truncate">{m.title || "Untitled"}</span>
        <span className="tabular-nums opacity-80">{formatClock(seg.t)}</span>
      </button>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ask your meetings"
      description={
        usable.length
          ? `Searches the ${usable.length === 1 ? "meeting" : `${usable.length} meetings`} on this device and answers with receipts. Click a source to open that moment.`
          : "Once you have a meeting with a transcript, ask questions across all of them here."
      }
      className="max-w-[680px]"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
        className="relative"
      >
        <label htmlFor="ask-all" className="sr-only">
          Ask your meetings
        </label>
        <AskIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={19} />
        <input
          ref={inputRef}
          id="ask-all"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!usable.length}
          placeholder="What did we decide about pricing?"
          className="h-12 w-full rounded-2xl border border-rule bg-paper/50 pl-11 pr-20 text-[15.5px] placeholder:text-faint focus:border-rule-strong focus:bg-sheet focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!q.trim() || loading}
          className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-ink px-3 text-[13.5px] font-medium text-paper disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      {!asked && !loading && usable.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void run(ex)}
              className="rounded-full border border-rule bg-sheet px-3 py-1.5 text-[13.5px] text-ink-2 hover:border-rule-strong"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {(loading || answer || error) && (
        <div className="animate-fade-up mt-5 rounded-2xl bg-paper/60 px-5 py-4" aria-live="polite">
          {asked && <p className="text-[13px] font-medium text-muted">{asked}</p>}
          {loading && (
            <div className="mt-3 space-y-2.5" role="status" aria-label="Reading your meetings">
              {[90, 76, 84].map((w, i) => (
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
            </p>
          )}
          {answer && (
            <div className={cx("mt-2 space-y-3 font-serif text-[17.5px] leading-relaxed text-ink")}>
              {answer.length === 0 ? (
                <p>Nothing in your meetings answers that.</p>
              ) : (
                toBlocks(answer).map((b, bi) => (
                  <p key={bi}>
                    {b.map((s, i) => (
                      <span key={i}>
                        {s.text}
                        {s.cites.map(marker)}{" "}
                      </span>
                    ))}
                  </p>
                ))
              )}
            </div>
          )}
          {answer && refs.size > 0 && (
            <p className="mt-4 border-t border-rule pt-3 text-[12.5px] text-muted">
              Read {refs.size === 1 ? "1 meeting" : `${refs.size} meetings`}:{" "}
              {[...refs.values()].map((m) => m.title || "Untitled").join(" · ")}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

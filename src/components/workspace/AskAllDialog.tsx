"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { AskIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { askMeetings, ApiError, type AskSentence } from "@/lib/client/api";
import { formatClock, formatDate } from "@/lib/format";
import { rankMeetings } from "@/lib/rank";
import { cachedAskAll, CACHED_QUESTIONS } from "@/lib/sample/cached-asks";
import type { Meeting } from "@/lib/types";
import { toBlocks } from "./AskBox";

/** Suggested questions; each has a cached answer for when no AI key is available. */
const EXAMPLES = CACHED_QUESTIONS;
/** Times shown per source meeting in a paragraph before folding behind "+n". */
const VISIBLE_TIMES = 3;

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
  const [q, setQ] = useState(initialQuestion ?? "");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<AskSentence[] | null>(null);
  const [refs, setRefs] = useState<Map<string, Meeting>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cached, setCached] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
    setCached(false);
    setExpanded(new Set());
    setAsked(text);
    try {
      const res = await askMeetings(
        text,
        [...map].map(([ref, m]) => ({ ref, title: m.title || "Untitled meeting", date: formatDate(m.createdAt, { year: true }), notes: m.notes, segments: m.segments })),
      );
      setAnswer(res);
      setQ("");
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("error", "Something went wrong.", 0);
      // No AI available right now: the suggested questions have answers computed ahead of time.
      const fallback = (e.code === "no_key" || e.code === "limit") && cachedAskAll(text, usable);
      if (fallback) {
        setRefs(fallback.refs);
        setAnswer(fallback.sentences);
        setCached(true);
        setQ("");
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  }

  // Mounted fresh each time it opens (see Workspace), so this runs once per open.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
    if (initialQuestion && !autoAsked.current) {
      autoAsked.current = true;
      const id = setTimeout(() => void run(initialQuestion), 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const time = (m: Meeting, sid: string) => {
    const seg = m.segments.find((s) => s.id === sid);
    if (!seg) return null;
    return (
      <button
        key={sid}
        type="button"
        onClick={() => onOpenSource(m.id, sid)}
        className="rounded px-0.5 tabular-nums hover:bg-accent-soft hover:underline"
        title={`${seg.label || seg.speaker}: “${seg.text}”`}
        aria-label={`Source: ${m.title}, ${seg.label || seg.speaker} at ${formatClock(seg.t)}. Open it.`}
      >
        {formatClock(seg.t)}
      </button>
    );
  };

  /** One chip per source meeting at the end of each paragraph, listing the moments it cites. */
  const sources = (b: AskSentence[], bi: number) => {
    const groups = new Map<string, string[]>();
    for (const c of b.flatMap((s) => s.cites)) {
      const [ref, sid] = c.split(":");
      if (!refs.has(ref)) continue;
      const list = groups.get(ref) ?? [];
      if (!list.includes(sid)) list.push(sid);
      groups.set(ref, list);
    }
    return [...groups].map(([ref, sids]) => {
      const m = refs.get(ref)!;
      const t = (id: string) => m.segments.find((s) => s.id === id)?.t ?? 0;
      const sorted = [...sids].sort((a, b) => t(a) - t(b));
      const key = `${bi}:${ref}`;
      const open = expanded.has(key) || sorted.length <= VISIBLE_TIMES;
      const shownIds = open ? sorted : sorted.slice(0, VISIBLE_TIMES - 1);
      return (
        <span
          key={ref}
          className="ml-1.5 inline-flex translate-y-[-0.2em] flex-wrap items-baseline gap-x-1 rounded-md bg-accent-softer px-1.5 py-[1px] align-baseline font-sans text-[11.5px] font-medium leading-tight text-accent"
        >
          <span className="max-w-[160px] truncate text-accent/90">{m.title || "Untitled"}</span>
          {shownIds.map((sid) => time(m, sid))}
          {!open && (
            <button
              type="button"
              onClick={() => setExpanded((x) => new Set(x).add(key))}
              className="rounded px-0.5 hover:bg-accent-soft"
              aria-label={`Show ${sorted.length - shownIds.length} more moments from ${m.title}`}
            >
              +{sorted.length - shownIds.length}
            </button>
          )}
        </span>
      );
    });
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

      {(!asked || error?.code === "no_key") && !loading && usable.length > 0 && (
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
          {asked && (
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
              {asked}
              {cached && (
                <span
                  className="rounded-full border border-rule px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em]"
                  title="No AI key is available right now, so this answer was computed ahead of time from the example meetings."
                >
                  Cached demo
                </span>
              )}
            </p>
          )}
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
              {error.code === "no_key" && (
                <span className="mt-1 block text-[13.5px] text-muted">
                  The suggested questions have cached answers for the example meetings and the sample call.
                </span>
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
                    {b.map((s) => s.text).join(" ")}
                    {sources(b, bi)}
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

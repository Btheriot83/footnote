"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { AskIcon, KeyIcon, PlayIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { matchesQuery, matchSnippet } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/client/session";
import type { Meeting } from "@/lib/types";

interface Props {
  meetings: Meeting[] | undefined;
  activeId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSample: () => void;
  onSettings: () => void;
  onAskAll: (question?: string) => void;
  /** Short note beside Settings on how AI is paid for right now. */
  aiLabel: string;
}

export const Sidebar = forwardRef<HTMLInputElement, Props>(function Sidebar(
  { meetings, activeId, query, onQuery, onSelect, onNew, onSample, onSettings, onAskAll, aiLabel },
  searchRef,
) {
  const session = useSession();
  const filtered = meetings?.filter((m) => matchesQuery(m, query));
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <nav className="flex h-full flex-col gap-4 px-4 pb-4 pt-5 sm:px-5" aria-label="Meetings">
      <div className="flex items-center px-1.5 pt-1">
        <Link href="/" className="rounded-sm">
          <Wordmark size={29} />
        </Link>
      </div>

      <div className="space-y-3">
        <label className="paper paper-cream relative block rounded-[3px]">
          <span className="sr-only">Search meetings</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={17} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter opens the best match, like a command palette.
              if (e.key === "Enter" && !e.nativeEvent.isComposing && filtered?.[0]) {
                e.preventDefault();
                onSelect(filtered[0].id);
                e.currentTarget.blur();
              }
            }}
            placeholder="Search"
            className="h-11 w-full rounded-[3px] bg-transparent pl-10 pr-12 font-serif text-[17px] italic text-ink placeholder:text-muted focus:bg-white/60 focus:not-italic focus:shadow-[inset_0_0_0_1px_var(--color-rule-strong)] focus:outline-none [&:not(:placeholder-shown)]:not-italic"
          />
          {!query && (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-sans text-[10.5px] font-semibold tracking-[0.1em] text-faint [@media(hover:hover)]:block">
              {isMac ? "⌘K" : "CTRL K"}
            </kbd>
          )}
        </label>
        <button type="button" onClick={onNew} className="pill h-11 w-full justify-between px-5 text-[11px]">
          New meeting
          <PlusIcon className="text-muted" size={16} />
        </button>
      </div>

      <div className="paper relative flex min-h-0 flex-1 flex-col rounded-[3px] [--paper:var(--color-index)]">
        {/* The index card's red margin line. */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[30px] w-px bg-margin/80" />
        <p className="smallcaps border-b border-index-line py-3 pl-[44px] pr-4 text-pen/75">Meetings</p>
        {/* Below the last meeting the card stays ruled, like a real index card. */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-[repeating-linear-gradient(180deg,transparent_0_35px,var(--color-index-line)_35px_36px)] bg-local pb-2">
          {query.trim().length > 2 && meetings?.some((m) => m.segments.length > 0) && (
            <button
              type="button"
              onClick={() => onAskAll(query.trim())}
              className="flex w-full items-start gap-2 border-b border-index-line bg-index py-2.5 pl-[44px] pr-4 text-left text-[15px] text-ink-2 hover:bg-[#f4f7fa]"
            >
              <AskIcon size={15} className="mt-[3px] shrink-0 text-pen" />
              <span>
                Ask your meetings: <span className="text-ink">&ldquo;{query.trim()}&rdquo;</span>
              </span>
            </button>
          )}
          {meetings === undefined ? (
            <div className="space-y-3 py-3 pl-[44px] pr-4" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-sm bg-white/50" />
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <ul>
              {filtered.map((m) => {
                const active = m.id === activeId;
                const live = session.meetingId === m.id && session.kind !== "none" && m.status === "live";
                const snippet = query ? matchSnippet(m, query) : null;
                return (
                  <li key={m.id} className="border-b border-index-line bg-index">
                    <button
                      type="button"
                      onClick={() => onSelect(m.id)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative block w-full py-3 pl-[44px] pr-4 text-left transition-colors",
                        active ? "bg-[#fafbfc]" : "hover:bg-[#f4f7fa]",
                      )}
                    >
                      {active && (
                        <span aria-hidden className="absolute left-[25px] top-[19px] h-[11px] w-[11px] rounded-full bg-accent shadow-[0_0_0_3px_rgba(255,255,255,0.8)]" />
                      )}
                      <span className="flex items-center gap-2">
                        <span className="line-clamp-2 font-serif text-[18px] font-medium leading-snug text-ink">
                          {m.title || "Untitled meeting"}
                        </span>
                        {live && <span className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-accent" aria-label="recording" />}
                      </span>
                      <span className="mt-0.5 block text-[14.5px] italic text-muted">
                        {formatDate(m.createdAt)}
                        {m.isSample && <span> · Sample</span>}
                        {m.isExample && <span> · Example</span>}
                      </span>
                      {snippet && <span className="mt-1 line-clamp-2 block text-[13.5px] text-ink-2">{snippet}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : query ? (
            <p className="py-3 pl-[44px] pr-4 text-[15px] italic text-muted">No meetings match &ldquo;{query}&rdquo;.</p>
          ) : (
            <p className="py-3 pl-[44px] pr-4 text-[15px] leading-relaxed text-muted">
              No meetings yet. They&rsquo;ll be listed here, stored only on this device.
            </p>
          )}
        </div>
      </div>

      <div className="paper paper-stone rounded-[3px] px-2 py-2">
        <button
          type="button"
          onClick={() => onAskAll()}
          className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[15.5px] text-ink-2 hover:bg-white/60"
        >
          <AskIcon size={16} className="text-muted" /> Ask your meetings
        </button>
        <button
          type="button"
          onClick={onSample}
          className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[15.5px] text-ink-2 hover:bg-white/60"
        >
          <PlayIcon size={14} className="text-muted" /> Try the sample call
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[15.5px] text-ink-2 hover:bg-white/60"
        >
          <KeyIcon size={16} className="text-muted" /> Settings
          {aiLabel && <span className="smallcaps ml-auto text-[9.5px] text-muted">{aiLabel}</span>}
        </button>
      </div>
    </nav>
  );
});

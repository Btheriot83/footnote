"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { AskIcon, KeyIcon, PlayIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { cx } from "@/components/ui";
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
    <nav className="flex h-full flex-col bg-paper" aria-label="Meetings">
      <div className="px-6 pb-4 pt-7 sm:px-7">
        <Link href="/" className="inline-flex items-start font-serif text-[31px] leading-none tracking-[-0.015em] text-ink">
          Footnote
          <span className="ml-[1px] mt-[3px] h-[6px] w-[6px] rounded-full bg-accent" aria-hidden />
        </Link>
      </div>

      <div className="space-y-3 px-6 sm:px-7">
        <label className="relative block">
          <span className="sr-only">Search meetings</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" size={19} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-xl border border-rule bg-paper-2/70 pl-11 pr-12 text-[16px] text-ink placeholder:text-ink-2 focus:border-rule-strong focus:bg-sheet focus:outline-none"
          />
          {!query && (
            <kbd className="pointer-events-none absolute right-3 hidden [@media(hover:hover)]:block top-1/2 -translate-y-1/2 rounded-md border border-rule bg-sheet px-1.5 py-0.5 font-sans text-[11px] text-muted">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          )}
        </label>
        <button
          type="button"
          onClick={onNew}
          className="flex h-12 w-full items-center gap-2 rounded-xl border border-rule bg-sheet px-5 text-left text-[16px] font-semibold text-ink shadow-[0_1px_1px_rgba(40,32,20,0.04)] transition-colors hover:border-rule-strong"
        >
          New meeting
          <PlusIcon className="ml-auto text-muted" size={17} />
        </button>
      </div>

      <div className="scroll-thin mt-5 min-h-0 flex-1 overflow-y-auto pb-4">
        {query.trim().length > 2 && meetings?.some((m) => m.segments.length > 0) && (
          <button
            type="button"
            onClick={() => onAskAll(query.trim())}
            className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-start gap-2.5 rounded-xl border border-dashed border-rule-strong px-3 py-2.5 text-left text-[14px] text-ink-2 hover:border-ink-2 hover:bg-sheet sm:mx-5 sm:w-[calc(100%-2.5rem)]"
          >
            <AskIcon size={16} className="mt-[2px] shrink-0 text-muted" />
            <span>
              Ask your meetings: <span className="text-ink">&ldquo;{query.trim()}&rdquo;</span>
            </span>
          </button>
        )}
        {meetings === undefined ? (
          <div className="space-y-3 px-7 pt-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-paper-2" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <ul>
            {filtered.map((m) => {
              const active = m.id === activeId;
              const live = session.meetingId === m.id && session.kind !== "none" && m.status === "live";
              const snippet = query ? matchSnippet(m, query) : null;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "block w-full px-6 py-3.5 text-left transition-colors sm:px-7",
                      active ? "bg-paper-3/80" : "hover:bg-paper-2",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="line-clamp-2 font-serif text-[19px] leading-snug text-ink">{m.title || "Untitled meeting"}</span>
                      {live && <span className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-accent" aria-label="recording" />}
                    </span>
                    <span className="mt-0.5 block text-[14.5px] text-ink-2/80">
                      {formatDate(m.createdAt)}
                      {m.isSample && <span className="text-muted"> · Sample</span>}
                      {m.isExample && <span className="text-muted"> · Example</span>}
                    </span>
                    {snippet && <span className="mt-1 line-clamp-2 block text-[13px] text-muted">{snippet}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : query ? (
          <p className="px-7 pt-2 text-[14.5px] text-muted">No meetings match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="px-7 pt-2 text-[14.5px] leading-relaxed text-muted">
            <p>No meetings yet. They&rsquo;ll be listed here, stored only on this device.</p>
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-rule px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => onAskAll()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14.5px] text-ink-2 hover:bg-paper-2"
        >
          <AskIcon size={16} /> Ask your meetings
        </button>
        <button
          type="button"
          onClick={onSample}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14.5px] text-ink-2 hover:bg-paper-2"
        >
          <PlayIcon size={15} /> Try the sample call
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14.5px] text-ink-2 hover:bg-paper-2"
        >
          <KeyIcon size={16} /> Settings
          {aiLabel && <span className="ml-auto text-[12.5px] text-muted">{aiLabel}</span>}
        </button>
      </div>
    </nav>
  );
});

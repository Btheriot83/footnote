"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MenuIcon, MicIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { Toaster } from "@/components/Toaster";
import { btn, cx } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { db } from "@/lib/db";
import { startLive, stopLive } from "@/lib/client/live-controller";
import { preloadSample, startSample, stopSampleAudio } from "@/lib/client/sample-controller";
import { getSession, resetSession, useSession } from "@/lib/client/session";
import { useKeyStatus, useUserKey } from "@/lib/client/settings";
import { useServerStatus } from "@/lib/client/server-status";
import { createMeeting, flushSaves, getMeeting, loadMeeting } from "@/lib/client/store";
import { getFlag, setFlag } from "@/lib/client/settings";
import { SAMPLE_TEMPLATE, SAMPLE_TITLE } from "@/lib/sample";
import { exampleMeetings } from "@/lib/sample/examples";
import type { Meeting } from "@/lib/types";
import { setPendingFocus } from "@/lib/client/pending-focus";
import { turnPage, waitFor } from "@/lib/client/page-turn";
import { AskAllDialog } from "./AskAllDialog";
import { MeetingPane } from "./MeetingPane";
import { focusNotes } from "./Notepad";
import { NewMeetingDialog, type StartOptions } from "./NewMeetingDialog";
import { PaneSkeleton } from "./Skeleton";
import { SettingsDialog } from "./SettingsDialog";
import { Sidebar } from "./Sidebar";

const ACTIVE_KEY = "footnote.active";

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export function Workspace() {
  const params = useSearchParams();
  const meetings = useLiveQuery(() => db.meetings.orderBy("createdAt").reverse().toArray(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<
    null | { kind: "new" } | { kind: "start"; meetingId: string } | { kind: "settings" } | { kind: "ask"; question?: string }
  >(null);
  const lastCapture = useRef<{ meetingId: string; mic: boolean; tab: boolean; keepAudio: boolean } | null>(null);
  const enhanceRef = useRef<(() => void) | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);
  const isMobile = useIsMobile();
  const isDesktop = useMedia("(min-width: 1024px)");
  const userKey = useUserKey();
  const keyStatus = useKeyStatus();
  const server = useServerStatus();
  const aiLabel =
    userKey && keyStatus !== "bad"
      ? "Your key"
      : userKey
        ? "Key rejected"
        : server?.hosted
          ? "Free allowance"
          : server
            ? "Add a key"
            : "";
  const session = useSession();

  const select = useCallback((id: string | null) => {
    setActiveId(id);
    setDrawer(false);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    const url = id ? `/app?m=${encodeURIComponent(id)}` : "/app";
    window.history.replaceState(null, "", url);
  }, []);

  const runSample = useCallback(async () => {
    if (getSession().kind === "live") stopLive();
    const all = await db.meetings.toArray();
    // Reuse the sample meeting if it's still pristine; otherwise start a fresh one.
    const reusable = all.find((m) => m.isSample && !m.enhanced);
    const m = reusable ?? (await createMeeting({ title: SAMPLE_TITLE, template: SAMPLE_TEMPLATE, isSample: true }));
    await loadMeeting(m.id);
    select(m.id);
    await startSample(m.id);
  }, [select]);

  // Boot: sample link, deep link, or last opened meeting.
  useEffect(() => {
    if (booted.current || meetings === undefined) return;
    booted.current = true;
    preloadSample();
    // First visit: seed two finished example meetings (once; deleting them sticks).
    if (!getFlag("seededExamples")) {
      setFlag("seededExamples", true);
      void db.meetings.bulkPut(exampleMeetings().filter((e) => !meetings.some((m) => m.id === e.id)));
    }
    // Any meeting marked live from a previous visit has ended.
    meetings
      .filter((m) => m.status === "live")
      .forEach((m) => void db.meetings.update(m.id, { status: "ended" }));
    const wantsSample = params.get("sample") === "1";
    const deep = params.get("m");
    let last: string | null = null;
    try {
      last = localStorage.getItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    if (wantsSample) {
      void runSample().finally(() => setReady(true));
      return;
    }
    const pick = [deep, last].find((id) => id && meetings.some((m) => m.id === id)) ?? meetings[0]?.id ?? null;
    // Ready once the meeting is on the desk, so the welcome card never flashes up first.
    if (pick)
      void loadMeeting(pick).then(() => {
        select(pick);
        setReady(true);
      });
    else setReady(true);
  }, [meetings, params, runSample, select]);

  // Keep the selection valid when meetings are deleted.
  useEffect(() => {
    if (!ready || meetings === undefined || !activeId) return;
    if (!meetings.some((m) => m.id === activeId) && !getMeeting(activeId)) {
      select(meetings[0]?.id ?? null);
    }
  }, [meetings, activeId, ready, select]);

  // Keyboard: Cmd/Ctrl+Enter enhances, Cmd/Ctrl+K searches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        enhanceRef.current?.();
      } else if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (window.matchMedia("(max-width: 1023px)").matches) setDrawer(true);
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
      } else if (e.key === "Escape" && drawer) {
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  useEffect(
    () => () => {
      flushSaves();
      stopSampleAudio();
    },
    [],
  );

  const registerEnhance = useCallback((fn: (() => void) | null) => {
    enhanceRef.current = fn;
  }, []);

  async function handleStart(opts: StartOptions) {
    const d = dialog;
    setDialog(null);
    let id: string;
    if (d?.kind === "start") {
      id = d.meetingId;
    } else {
      const s = getSession();
      if (s.kind === "sample") {
        stopSampleAudio();
        resetSession();
      }
      const m = await createMeeting({ title: opts.title, template: opts.template });
      id = m.id;
      select(id);
    }
    // Typing should land in the notes straight away, not on the button that opened the dialog.
    focusNotes();
    if (opts.record) {
      lastCapture.current = { meetingId: id, mic: opts.mic, tab: opts.tab, keepAudio: opts.keepAudio };
      await startLive(id, { mic: opts.mic, tab: opts.tab, keepAudio: opts.keepAudio });
      focusNotes();
    }
  }

  function retryCapture() {
    const last = lastCapture.current;
    if (last && getMeeting(last.meetingId)) void startLive(last.meetingId, { mic: last.mic, tab: last.tab, keepAudio: last.keepAudio });
    else if (activeId) setDialog({ kind: "start", meetingId: activeId });
  }

  const sidebar = (
    <Sidebar
      ref={searchRef}
      meetings={meetings as Meeting[] | undefined}
      activeId={activeId}
      query={query}
      onQuery={setQuery}
      onSelect={(id) => {
        if (id === activeId) {
          setDrawer(false);
          return;
        }
        // Desktop: the sheet on the desk turns like a page to the next meeting.
        const sheet = isDesktop ? document.querySelector<HTMLElement>("[data-sheet]") : null;
        const frame = sheet?.closest("main");
        if (!sheet || !frame) {
          void loadMeeting(id).then(() => select(id));
          return;
        }
        const a = sheet.getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        const top = Math.max(a.top, f.top);
        const bottom = Math.min(a.bottom, f.bottom);
        void turnPage({
          rect: new DOMRect(a.left, top, a.width, Math.max(0, bottom - top)),
          duration: 780,
          onCovered: () => loadMeeting(id).then(() => select(id)),
          ready: () => waitFor(`[data-sheet="${id}"]`, 1200),
        });
      }}
      onNew={() => {
        setDrawer(false);
        setDialog({ kind: "new" });
      }}
      onSample={() => {
        setDrawer(false);
        void runSample();
      }}
      onSettings={() => {
        setDrawer(false);
        setDialog({ kind: "settings" });
      }}
      onAskAll={(question) => {
        setDrawer(false);
        setDialog({ kind: "ask", question });
      }}
      aiLabel={aiLabel}
    />
  );

  return (
    <div className="desk flex h-dvh overflow-hidden text-ink" data-page="app" data-ready={ready || undefined}>
      {/* Desktop sidebar */}
      <aside className="hidden w-[292px] shrink-0 lg:block xl:w-[330px]">{isDesktop && sidebar}</aside>

      {/* Drawer */}
      <div
        className={cx("fixed inset-0 z-40 lg:hidden", drawer ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!drawer}
      >
        <div
          className={cx("absolute inset-0 bg-[rgba(52,38,20,0.32)] transition-opacity duration-200", drawer ? "opacity-100" : "opacity-0")}
          onClick={() => setDrawer(false)}
        />
        <div
          className={cx(
            "desk absolute inset-y-0 left-0 w-[86%] max-w-[340px] transition-[transform,box-shadow] duration-300 ease-out",
            drawer ? "translate-x-0 shadow-[12px_0_40px_-12px_rgba(52,38,20,0.5)]" : "-translate-x-full shadow-none",
          )}
          inert={!drawer}
        >
          {!isDesktop && sidebar}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {activeId ? (
          <MeetingPane
            key={activeId}
            meetingId={activeId}
            isMobile={isMobile}
            onOpenSidebar={() => setDrawer(true)}
            onRequestStart={() => setDialog({ kind: "start", meetingId: activeId })}
            onRetryCapture={retryCapture}
            onSettings={() => setDialog({ kind: "settings" })}
            onDeleted={() => select(null)}
            registerEnhance={registerEnhance}
          />
        ) : (
          <EmptyWorkspace
            loading={!ready}
            hasMeetings={!!meetings?.length}
            onMenu={() => setDrawer(true)}
            onNew={() => setDialog({ kind: "new" })}
            onSample={() => void runSample()}
          />
        )}
      </div>

      <NewMeetingDialog
        open={dialog?.kind === "new" || dialog?.kind === "start"}
        mode={dialog?.kind === "start" ? "start" : "new"}
        initialTemplate={dialog?.kind === "start" ? getMeeting(dialog.meetingId)?.template : undefined}
        onClose={() => setDialog(null)}
        onStart={(o) => void handleStart(o)}
        liveElsewhere={session.kind === "live"}
      />
      <SettingsDialog open={dialog?.kind === "settings"} onClose={() => setDialog(null)} />
      {dialog?.kind === "ask" && (
        <AskAllDialog
          open
          initialQuestion={dialog.question}
          meetings={meetings as Meeting[] | undefined}
          onClose={() => setDialog(null)}
          onSettings={() => setDialog({ kind: "settings" })}
          onOpenSource={(meetingId, segmentId) => {
            setDialog(null);
            setPendingFocus(meetingId, segmentId);
            if (meetingId === activeId) window.dispatchEvent(new Event("footnote:pending-focus"));
            else void loadMeeting(meetingId).then(() => select(meetingId));
          }}
        />
      )}
      <Toaster />
    </div>
  );
}

function EmptyWorkspace({
  loading,
  hasMeetings,
  onMenu,
  onNew,
  onSample,
}: {
  loading: boolean;
  hasMeetings: boolean;
  onMenu: () => void;
  onNew: () => void;
  onSample: () => void;
}) {
  if (loading) return <PaneSkeleton />;
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[68px] shrink-0 items-center gap-3 px-3 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={onMenu}
          className="pill h-10 w-10 shrink-0 p-0 tracking-normal"
          aria-label="Open meetings"
        >
          <MenuIcon size={20} />
        </button>
        <Link href="/" className="rounded-sm">
          <Wordmark size={24} />
        </Link>
      </header>
      {(
        <div className="scroll-thin flex min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-8 sm:px-6 lg:pt-14">
          {/* A letter left on the desk, with the receipt it talks about tucked under it and a sticky note on top. */}
          <div className="relative m-auto w-full max-w-[600px]">
            <div
              aria-hidden
              className="receipt animate-settle absolute -right-3 top-[60%] hidden w-[260px] rotate-[6deg] px-4 pb-4 pt-3 text-[11.5px] leading-[1.6] [animation-delay:260ms] sm:block lg:-right-[170px]"
            >
              <p className="text-center tracking-[0.22em] text-[var(--receipt-dim)]">TRANSCRIPT · ACME</p>
              <hr className="receipt-rule my-2" />
              <p className="flex justify-between text-[var(--receipt-dim)]">
                <span>
                  DANA (ACME) <span className="fn-mark !ml-1 !text-[9.5px]">1</span>
                </span>
                <span>00:15</span>
              </p>
              <p className="mt-1 text-[var(--receipt-ink)]">
                Right, we closed our Series B two weeks ago. <span className="hl">$32 million, led by Northstar.</span>
              </p>
            </div>

            <div className="paper paper-cream sheet-shadow animate-settle relative -rotate-[0.6deg] rounded-[3px] px-7 pb-10 pt-9 sm:px-12 sm:pb-12 sm:pt-11">
              <p className="smallcaps text-muted">{hasMeetings ? "Welcome to Footnote" : "No meetings yet"}</p>
              <h1 className="mt-3 font-serif text-[36px] font-medium leading-[1.06] tracking-[-0.025em] sm:text-[46px]">
                Notes with receipts start here.
              </h1>
              <ol className="mt-6 space-y-3 text-[17.5px] leading-snug text-ink-2">
                {[
                  "Start a meeting and type rough notes while you talk.",
                  "Press Enhance. Footnote writes them up from the transcript.",
                  "Every line it adds links to the moment it was said, and you can hear it.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="fn-mark !ml-0 mt-[0.3em] shrink-0 !cursor-default !align-baseline !text-[11px]">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onSample} className={cx(btn.base, btn.primary, btn.lg)}>
                  <PlayIcon size={14} /> Try a sample meeting
                </button>
                <button type="button" onClick={onNew} className={cx(btn.base, btn.secondary, btn.lg)}>
                  <PlusIcon size={16} /> New meeting
                </button>
              </div>
              <p className="mt-6 inline-flex items-center gap-1.5 text-[15px] italic text-muted">
                <MicIcon size={15} /> Works best in Chrome or Edge on a desktop.
              </p>
            </div>

            <div
              aria-hidden
              className="paper paper-butter animate-settle absolute -top-7 right-4 hidden w-[168px] rotate-[4deg] rounded-[1px] px-4 pb-4 pt-3 font-hand text-[21px] leading-[1.05] text-ink-2 [animation-delay:420ms] sm:block lg:-right-16"
            >
              new here? play the sample call first. sound on!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workspace;

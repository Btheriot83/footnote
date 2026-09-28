"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MenuIcon, MicIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { Toaster } from "@/components/Toaster";
import { btn, cx } from "@/components/ui";
import { db } from "@/lib/db";
import { startLive, stopLive } from "@/lib/client/live-controller";
import { preloadSample, startSample, stopSampleAudio } from "@/lib/client/sample-controller";
import { getSession, resetSession, useSession } from "@/lib/client/session";
import { useUserKey } from "@/lib/client/settings";
import { createMeeting, flushSaves, getMeeting, loadMeeting } from "@/lib/client/store";
import { getFlag, setFlag } from "@/lib/client/settings";
import { SAMPLE_TEMPLATE, SAMPLE_TITLE } from "@/lib/sample";
import { exampleMeetings } from "@/lib/sample/examples";
import type { Meeting } from "@/lib/types";
import { setPendingFocus } from "@/lib/client/pending-focus";
import { AskAllDialog } from "./AskAllDialog";
import { MeetingPane } from "./MeetingPane";
import { focusNotes } from "./Notepad";
import { NewMeetingDialog, type StartOptions } from "./NewMeetingDialog";
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
  const lastCapture = useRef<{ meetingId: string; mic: boolean; tab: boolean } | null>(null);
  const enhanceRef = useRef<(() => void) | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const booted = useRef(false);
  const isMobile = useIsMobile();
  const isDesktop = useMedia("(min-width: 1024px)");
  const userKey = useUserKey();
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
    if (pick) void loadMeeting(pick).then(() => select(pick));
    setReady(true);
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
      lastCapture.current = { meetingId: id, mic: opts.mic, tab: opts.tab };
      await startLive(id, { mic: opts.mic, tab: opts.tab });
      focusNotes();
    }
  }

  function retryCapture() {
    const last = lastCapture.current;
    if (last && getMeeting(last.meetingId)) void startLive(last.meetingId, { mic: last.mic, tab: last.tab });
    else if (activeId) setDialog({ kind: "start", meetingId: activeId });
  }

  const sidebar = (
    <Sidebar
      ref={searchRef}
      meetings={meetings as Meeting[] | undefined}
      activeId={activeId}
      query={query}
      onQuery={setQuery}
      onSelect={(id) => void loadMeeting(id).then(() => select(id))}
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
      hasKey={!!userKey}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-[300px] shrink-0 border-r border-rule lg:block xl:w-[356px]">{isDesktop && sidebar}</aside>

      {/* Drawer */}
      <div
        className={cx("fixed inset-0 z-40 lg:hidden", drawer ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!drawer}
      >
        <div
          className={cx("absolute inset-0 bg-ink/25 transition-opacity duration-200", drawer ? "opacity-100" : "opacity-0")}
          onClick={() => setDrawer(false)}
        />
        <div
          className={cx(
            "absolute inset-y-0 left-0 w-[86%] max-w-[340px] border-r border-rule shadow-lift transition-transform duration-250 ease-out",
            drawer ? "translate-x-0" : "-translate-x-full",
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
      <AskAllDialog
        open={dialog?.kind === "ask"}
        initialQuestion={dialog?.kind === "ask" ? dialog.question : undefined}
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
  return (
    <div className="flex h-full flex-col bg-sheet">
      <header className="flex h-[76px] shrink-0 items-center border-b border-rule px-3 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-paper-2"
          aria-label="Open meetings"
        >
          <MenuIcon />
        </button>
        <Link href="/" className="ml-2 font-serif text-[24px]">
          Footnote
        </Link>
      </header>
      {loading ? (
        <div className="flex flex-1 items-center justify-center" aria-busy>
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-faint" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="max-w-[520px] animate-fade-up text-center">
            <p className="font-serif text-[15px] italic text-muted">{hasMeetings ? "Welcome to Footnote" : "No meetings yet"}</p>
            <h1 className="mt-3 font-serif text-[40px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">
              Notes with receipts start here.
            </h1>
            <p className="mx-auto mt-4 max-w-[430px] text-[16.5px] leading-relaxed text-ink-2">
              Start a meeting and type rough notes while you talk. Afterwards, Footnote writes them up and links every line
              to the moment it was said.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={onSample} className={cx(btn.base, btn.primary, btn.lg)}>
                <PlayIcon size={16} /> Try a sample meeting
              </button>
              <button type="button" onClick={onNew} className={cx(btn.base, btn.secondary, btn.lg)}>
                <PlusIcon size={18} /> New meeting
              </button>
            </div>
            <p className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] text-muted">
              <MicIcon size={15} /> Works best in Chrome or Edge on a desktop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workspace;

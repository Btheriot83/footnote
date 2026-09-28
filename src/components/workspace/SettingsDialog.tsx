"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { btn, cx } from "@/components/ui";
import type { Status } from "@/lib/client/api";
import { refreshServerStatus } from "@/lib/client/server-status";
import { getUserKey, maskKey, setKeyStatus, setUserKey, useKeyStatus, useUserKey } from "@/lib/client/settings";
import { downloadBlob, makeBackup, restoreBackup } from "@/lib/client/backup";
import { toast } from "@/lib/client/toast";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useUserKey();
  const keyStatus = useKeyStatus();
  const rejected = !!saved && keyStatus === "bad";
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status | null | "loading">("loading");
  const [check, setCheck] = useState<{ state: "idle" | "checking" | "ok" | "bad"; message?: string }>({ state: "idle" });

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setReveal(false);
    setCheck({ state: "idle" });
    setStatus("loading");
    void refreshServerStatus().then(setStatus);
  }, [open, saved]);

  const trimmed = draft.trim();
  const valid = /^sk-[A-Za-z0-9_\-]{20,}$/.test(trimmed);
  const hint = !trimmed
    ? null
    : !trimmed.startsWith("sk-")
      ? "OpenAI keys start with “sk-”."
      : /\s/.test(trimmed)
        ? "The key has a space in it. Paste it again."
        : !valid
          ? "That key looks too short. Copy the whole thing."
          : null;

  async function testKey(key: string) {
    setCheck({ state: "checking" });
    try {
      const res = await fetch("/api/check-key", { method: "POST", headers: { "x-user-openai-key": key } });
      const data = (await res.json()) as { ok: boolean; message: string };
      setCheck({ state: data.ok ? "ok" : "bad", message: data.message });
      // Only a definite answer from OpenAI changes whether the key is used.
      if (res.ok && getUserKey() === key) setKeyStatus(data.ok ? "ok" : "bad");
    } catch {
      setCheck({ state: "bad", message: "Couldn't reach the server to check the key." });
    }
  }

  return (
    <Dialog
      stock="index"
      open={open}
      onClose={onClose}
      title="Settings"
      description="Footnote runs in your browser. Meetings are stored on this device only."
      footer={
        <button type="button" className={cx(btn.base, btn.primary, btn.md)} onClick={onClose}>
          Done
        </button>
      }
    >
      <section>
        <h3 className="smallcaps text-[10.5px] text-muted">Your OpenAI API key</h3>
        <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
          Kept in this browser&rsquo;s local storage and sent only with your own requests. The server uses it for that
          request and never stores or logs it. A 30-minute meeting costs roughly 10 cents.
        </p>
        {saved ? (
          <div className="receipt mt-4 flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className={cx("h-2 w-2 rounded-full", rejected ? "bg-accent" : "bg-ink")} aria-hidden />
            <code className="text-[13.5px]">{maskKey(saved)}</code>
            <span className="text-[11.5px] uppercase text-[#6a655b]">{rejected ? "rejected by OpenAI, not in use" : "in use"}</span>
            <button
              type="button"
              className={cx(btn.base, btn.ghost, btn.sm, "ml-auto")}
              disabled={check.state === "checking"}
              onClick={() => void testKey(saved)}
            >
              {check.state === "checking" ? "Checking…" : "Test key"}
            </button>
            <button
              type="button"
              className={cx(btn.base, btn.ghost, btn.sm)}
              onClick={() => {
                setUserKey("");
                toast("Key removed from this browser.");
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              const key = draft.trim();
              setUserKey(key);
              setDraft("");
              toast("Key saved in this browser.", { tone: "success" });
              void testKey(key);
            }}
          >
            <label className="sr-only" htmlFor="openai-key">
              OpenAI API key
            </label>
            <div className="relative flex-1">
              <input
                id="openai-key"
                type={reveal ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-..."
                className="paper paper-white h-11 w-full rounded-[3px] px-4 pr-16 font-mono text-[14px] placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink-2),var(--shadow-card)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="smallcaps absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] text-muted hover:text-ink"
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" className={cx(btn.base, btn.primary, btn.md)} disabled={!valid}>
              Save key
            </button>
          </form>
        )}
        {!saved && hint && (
          <p className="mt-2 flex items-center gap-2 text-[14.5px] text-ink-2" role="status">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {hint}
          </p>
        )}
        {rejected && check.state === "idle" && (
          <p className="mt-2 flex items-center gap-2 text-[14.5px] text-ink-2" role="status">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            OpenAI rejected this key, so Footnote stopped sending it. Remove it and paste a new one, or test it again.
          </p>
        )}
        {check.state === "ok" || check.state === "bad" ? (
          <p className="mt-2 flex items-center gap-2 text-[14.5px] text-ink-2" role="status">
            <span className={cx("h-1.5 w-1.5 rounded-full", check.state === "ok" ? "bg-ink" : "bg-accent")} aria-hidden />
            {check.message}
          </p>
        ) : null}
        <p className="mt-2 text-[14.5px] text-muted">
          Get one at{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-2"
          >
            platform.openai.com/api-keys
          </a>
          .
        </p>
      </section>

      <BackupSection />

      <section className="mt-6 border-t border-dashed border-rule-strong pt-5">
        <h3 className="smallcaps text-[10.5px] text-muted">How AI is paid for</h3>
        {status === "loading" ? (
          <p className="mt-2 text-[15.5px] italic text-muted">Checking…</p>
        ) : !status ? (
          <p className="mt-2 text-[15.5px] italic text-muted">Couldn&rsquo;t reach the server.</p>
        ) : saved && !rejected ? (
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
            Your own key, so there are no limits. You pay OpenAI directly for what you use.
          </p>
        ) : status.hosted ? (
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
            {rejected ? "Until the key is fixed, you're on the free allowance: " : "Without a key you get a free allowance: "}
            {status.limits.enhances} enhancements, {status.limits.asks} questions and {status.limits.transcribeMinutes}{" "}
            minutes of tab-audio transcription a day. Left today:{" "}
            <strong className="font-semibold text-ink">
              {status.remaining.enhances} enhancements, {status.remaining.asks} questions, {status.remaining.transcribeMinutes}{" "}
              minutes
            </strong>
            .
          </p>
        ) : (
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
            This demo server doesn&rsquo;t include an AI key. The sample call still shows Enhance and the one-click recipes
            as cached demos. For your own meetings, add a key above. Notes, history, search, export and your mic transcript
            all work without one.
          </p>
        )}
        <p className="mt-3 text-[14.5px] italic leading-relaxed text-muted">
          Footnote is free and open source with your own key. <span className="text-ink-2">Footnote Pro</span>, $59 once
          (coming soon), includes the AI instead: 1,000 enhancements and 20 hours of transcription a year, no key needed.
        </p>
      </section>
    </Dialog>
  );
}

/** Meetings live only in this browser: a way to carry them to another one, or keep a copy. */
// The dialog unmounts its contents when it closes, so each opening starts fresh.
function BackupSection() {
  const [audio, setAudio] = useState(false);
  const [busy, setBusy] = useState<null | "backup" | "restore">(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function backup() {
    setBusy("backup");
    try {
      const { blob, count, name } = await makeBackup(audio);
      downloadBlob(blob, name);
      setNote({ ok: true, text: `Saved ${count} meeting${count === 1 ? "" : "s"} to ${name}.` });
    } catch {
      setNote({ ok: false, text: "Couldn't make the backup. Try again without audio." });
    } finally {
      setBusy(null);
    }
  }

  async function restore(file: File) {
    setBusy("restore");
    try {
      const r = await restoreBackup(file);
      const parts = [r.added && `${r.added} added`, r.updated && `${r.updated} updated`, r.skipped && `${r.skipped} already here`].filter(Boolean);
      const text = parts.length ? `Restored: ${parts.join(", ")}.` : "Nothing to restore in that file.";
      setNote({ ok: true, text });
      toast(text, { tone: "success" });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message || "Couldn't read that backup." });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="mt-6 border-t border-dashed border-rule-strong pt-5">
      <h3 className="smallcaps text-[10.5px] text-muted">Your meetings</h3>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
        They live in this browser only. Back them up to a file to keep a copy, or to move them to another browser.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void backup()} disabled={!!busy} className={cx(btn.base, btn.secondary, btn.sm)}>
          {busy === "backup" ? "Backing up…" : "Back up (.json)"}
        </button>
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className={cx(btn.base, btn.secondary, btn.sm)}>
          {busy === "restore" ? "Restoring…" : "Restore from a backup"}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a Footnote backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
          }}
        />
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[14.5px] text-ink-2">
        <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
        Include the audio kept on this device (a much bigger file)
      </label>
      {note && (
        <p className="mt-2 flex items-center gap-2 text-[14.5px] text-ink-2" role="status">
          <span className={cx("h-1.5 w-1.5 rounded-full", note.ok ? "bg-ink" : "bg-accent")} aria-hidden />
          {note.text}
        </p>
      )}
    </section>
  );
}

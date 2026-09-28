"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { btn, cx } from "@/components/ui";
import type { Status } from "@/lib/client/api";
import { refreshServerStatus } from "@/lib/client/server-status";
import { getUserKey, maskKey, setKeyStatus, setUserKey, useKeyStatus, useUserKey } from "@/lib/client/settings";
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
        <h3 className="text-[15px] font-semibold">Your OpenAI API key</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          Kept in this browser&rsquo;s local storage and sent only with your own requests. The server uses it for that
          request and never stores or logs it. A 30-minute meeting costs roughly 10 cents.
        </p>
        {saved ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-paper px-3.5 py-2.5">
            <span className={cx("h-2 w-2 rounded-full", rejected ? "bg-accent" : "bg-ink")} aria-hidden />
            <code className="text-[14px]">{maskKey(saved)}</code>
            <span className="text-[13px] text-muted">{rejected ? "rejected by OpenAI, not in use" : "in use"}</span>
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
                className="h-11 w-full rounded-xl border border-rule bg-paper/60 px-3.5 pr-16 font-mono text-[14px] placeholder:text-faint focus:border-ink-2 focus:bg-sheet focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12.5px] text-muted hover:text-ink"
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
          <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2" role="status">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {hint}
          </p>
        )}
        {rejected && check.state === "idle" && (
          <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2" role="status">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            OpenAI rejected this key, so Footnote stopped sending it. Remove it and paste a new one, or test it again.
          </p>
        )}
        {check.state === "ok" || check.state === "bad" ? (
          <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2" role="status">
            <span className={cx("h-1.5 w-1.5 rounded-full", check.state === "ok" ? "bg-ink" : "bg-accent")} aria-hidden />
            {check.message}
          </p>
        ) : null}
        <p className="mt-2 text-[13px] text-muted">
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

      <section className="mt-6 border-t border-rule pt-5">
        <h3 className="text-[15px] font-semibold">How AI is paid for</h3>
        {status === "loading" ? (
          <p className="mt-1 text-[14px] text-muted">Checking…</p>
        ) : !status ? (
          <p className="mt-1 text-[14px] text-muted">Couldn&rsquo;t reach the server.</p>
        ) : saved && !rejected ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Your own key, so there are no limits. You pay OpenAI directly for what you use.
          </p>
        ) : status.hosted ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
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
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            This demo server doesn&rsquo;t include an AI key. The sample call still shows Enhance and the one-click recipes
            as cached demos. For your own meetings, add a key above. Notes, history, search, export and your mic transcript
            all work without one.
          </p>
        )}
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Footnote is free and open source with your own key. <span className="text-ink-2">Footnote Pro</span>, $59 once
          (coming soon), includes the AI instead: 1,000 enhancements and 20 hours of transcription a year, no key needed.
        </p>
      </section>
    </Dialog>
  );
}

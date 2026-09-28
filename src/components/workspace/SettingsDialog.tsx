"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { btn, cx } from "@/components/ui";
import { fetchStatus, type Status } from "@/lib/client/api";
import { maskKey, setUserKey, useUserKey } from "@/lib/client/settings";
import { toast } from "@/lib/client/toast";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useUserKey();
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status | null | "loading">("loading");

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setReveal(false);
    setStatus("loading");
    void fetchStatus().then(setStatus);
  }, [open, saved]);

  const valid = /^sk-[A-Za-z0-9_\-]{20,}$/.test(draft.trim());

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
            <span className="h-2 w-2 rounded-full bg-ink" aria-hidden />
            <code className="text-[14px]">{maskKey(saved)}</code>
            <span className="text-[13px] text-muted">in use</span>
            <button
              type="button"
              className={cx(btn.base, btn.ghost, btn.sm, "ml-auto")}
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
              setUserKey(draft.trim());
              setDraft("");
              toast("Key saved in this browser.", { tone: "success" });
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
        <h3 className="text-[15px] font-semibold">Free hosted allowance</h3>
        {status === "loading" ? (
          <p className="mt-1 text-[14px] text-muted">Checking…</p>
        ) : !status ? (
          <p className="mt-1 text-[14px] text-muted">Couldn&rsquo;t reach the server.</p>
        ) : saved ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            You&rsquo;re using your own key, so there are no limits.
          </p>
        ) : status.hosted ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Without a key you get {status.limits.enhances} enhancements and {status.limits.transcribeMinutes} minutes of
            tab-audio transcription a day. Left today:{" "}
            <strong className="font-semibold text-ink">
              {status.remaining.enhances} enhancements, {status.remaining.transcribeMinutes} minutes
            </strong>
            .
          </p>
        ) : (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            This server doesn&rsquo;t provide a hosted key, so AI features need your own key. Your mic transcript (via the
            browser) and your notes still work without one.
          </p>
        )}
      </section>
    </Dialog>
  );
}

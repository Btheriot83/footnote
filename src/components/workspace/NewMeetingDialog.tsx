"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { InfoIcon, MicIcon, TabAudioIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { captureSupport } from "@/lib/client/capture";
import { useServerStatus } from "@/lib/client/server-status";
import { getFlag, setFlag, useKeyStatus, useUserKey } from "@/lib/client/settings";
import { TEMPLATES } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";

export interface StartOptions {
  title: string;
  template: TemplateId;
  mic: boolean;
  tab: boolean;
  record: boolean;
  /** Keep the audio in this browser so footnotes can play the moment. */
  keepAudio: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** "new" creates a meeting; "start" starts recording an existing one. */
  mode: "new" | "start";
  initialTemplate?: TemplateId;
  onStart: (opts: StartOptions) => void;
  liveElsewhere?: boolean;
}

export function NewMeetingDialog({ open, onClose, mode, initialTemplate, onStart, liveElsewhere }: Props) {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TemplateId>(initialTemplate ?? "general");
  const [mic, setMic] = useState(true);
  const [tab, setTab] = useState(false);
  const [support, setSupport] = useState({ speech: true, mic: true, tab: true, recorder: true });
  const [showExplainer, setShowExplainer] = useState(false);
  const [keepAudio, setKeepAudio] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSupport(captureSupport());
    setShowExplainer(!getFlag("seenCaptureExplainer"));
    setKeepAudio(!getFlag("discardAudio"));
    setTitle("");
    setTemplate(initialTemplate ?? "general");
  }, [open, initialTemplate]);

  const tabAvailable = support.tab && support.recorder;
  const server = useServerStatus();
  const userKey = useUserKey();
  const keyStatus = useKeyStatus();
  // Tab audio (and the mic, without Web Speech) goes through OpenAI: say so before it fails.
  const noAi = !!server && !server.hosted && (!userKey || keyStatus === "bad");
  const needsAi = (tab && tabAvailable) || (mic && support.mic && !support.speech);

  function start(record: boolean) {
    setFlag("seenCaptureExplainer", true);
    setFlag("discardAudio", !keepAudio);
    onStart({ title, template, mic: record && mic, tab: record && tab && tabAvailable, record, keepAudio: record && keepAudio && support.recorder });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "new" ? "New meeting" : "Start recording"}
      description={
        mode === "new"
          ? "Pick a template, choose what Footnote should listen to, and start."
          : "Choose what Footnote should listen to."
      }
      className="max-w-[640px]"
      footer={
        <>
          {liveElsewhere && (
            <span className="mr-auto text-[14.5px] italic text-muted">This stops the recording in progress.</span>
          )}
          {mode === "new" && (
            <button type="button" className={cx(btn.base, btn.secondary, btn.md)} onClick={() => start(false)}>
              Just take notes
            </button>
          )}
          <button
            type="button"
            className={cx(btn.base, btn.primary, btn.md)}
            onClick={() => start(true)}
            disabled={!mic && !tab}
          >
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            Start recording
          </button>
        </>
      }
    >
      {mode === "new" && (
        <>
          <label className="block">
            <span className="smallcaps text-[10.5px] text-muted">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled meeting"
              className="paper paper-white mt-2 h-12 w-full rounded-[3px] px-4 font-serif text-[19px] placeholder:italic placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink-2),var(--shadow-card)] focus:outline-none"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="smallcaps text-[10.5px] text-muted">Template</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={cx(
                    "relative cursor-pointer rounded-[3px] border px-3.5 py-3 transition-[background-color,border-color,box-shadow,rotate] duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    template === t.id
                      ? "paper paper-white -rotate-[0.8deg] border-ink/70"
                      : "border-ink/10 bg-white/30 hover:border-ink/25 hover:bg-white/60",
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                    className="sr-only"
                  />
                  <span className="block font-serif text-[18px] font-medium leading-tight">{t.name}</span>
                  <span className="mt-1 block text-[14px] leading-snug text-muted">{t.blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className={mode === "new" ? "mt-5" : ""}>
        <legend className="smallcaps text-[10.5px] text-muted">Listen to</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SourceToggle
            checked={mic}
            onChange={setMic}
            disabled={!support.mic}
            icon={<MicIcon />}
            title="Your microphone"
            detail={
              !support.mic
                ? "Not available in this browser."
                : support.speech
                  ? "Labeled “You”. Transcribed free, in the browser."
                  : "Labeled “You”. Transcribed with OpenAI."
            }
          />
          <SourceToggle
            checked={tab && tabAvailable}
            onChange={setTab}
            disabled={!tabAvailable}
            icon={<TabAudioIcon />}
            title="Meeting tab audio"
            detail={
              tabAvailable
                ? "Labeled “Them”. Google Meet, Zoom or Teams in a browser tab."
                : "Needs Chrome or Edge on a desktop."
            }
          />
        </div>
        {noAi && needsAi && (
          <p className="mt-2 flex items-start gap-2 text-[14.5px] leading-snug text-ink-2" role="status">
            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {tab && tabAvailable ? "Tab audio" : "Your mic, in this browser,"} is transcribed by OpenAI, and this demo server
            has no key. Add your own in Settings first, or just take notes.
          </p>
        )}
      </fieldset>

      {support.recorder && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-sm px-1 text-[15.5px] leading-snug">
          <input
            type="checkbox"
            checked={keepAudio}
            onChange={(e) => setKeepAudio(e.target.checked)}
            className="mt-[3px] h-4 w-4 shrink-0 accent-[#1b1915]"
          />
          <span>
            <span className="font-medium text-ink">Keep the audio on this device</span>
            <span className="block text-[14px] text-muted">
              So clicking a footnote plays the exact moment. Stored in this browser only, never uploaded. Delete it any time.
            </span>
          </span>
        </label>
      )}

      {showExplainer ? (
        <div className="paper paper-sky mt-5 rotate-[0.3deg] rounded-[2px] px-5 py-4 text-[15.5px] leading-relaxed text-ink-2">
          <p className="flex items-center gap-2 font-medium text-ink">
            <InfoIcon size={16} /> How a browser hears your meeting
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-faint">
            <li>
              A web page can&rsquo;t hear the <strong>Zoom desktop app</strong>. Join from the web client (Meet, Zoom web,
              Teams web) in another tab.
            </li>
            <li>
              When Chrome asks what to share, pick that tab and switch on <strong>&ldquo;Share tab audio&rdquo;</strong>.
            </li>
            <li>Wear headphones so your mic only hears you, not the other side twice.</li>
            <li>Footnote never stores audio on a server. If you keep it, it stays in this browser, next to the notes.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setFlag("seenCaptureExplainer", true);
              setShowExplainer(false);
            }}
            className="smallcaps mt-2 text-[10.5px] text-ink underline underline-offset-4"
          >
            Got it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExplainer(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-[15px] italic text-muted hover:text-ink"
        >
          <InfoIcon size={15} /> What can a browser hear?
        </button>
      )}
    </Dialog>
  );
}

function SourceToggle({
  checked,
  onChange,
  disabled,
  icon,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-[3px] border px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
        checked ? "paper paper-white border-ink/70" : "border-ink/10 bg-white/30 hover:border-ink/25 hover:bg-white/60",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={cx("mt-0.5", checked ? "text-ink" : "text-muted")}>{icon}</span>
      <span className="flex-1">
        <span className="block text-[17px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-muted">{detail}</span>
      </span>
      <span
        aria-hidden
        className={cx(
          "mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
          checked ? "border-ink bg-ink text-paper" : "border-rule-strong bg-sheet",
        )}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </label>
  );
}

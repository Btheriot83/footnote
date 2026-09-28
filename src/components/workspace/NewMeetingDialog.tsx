"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { InfoIcon, MicIcon, TabAudioIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { captureSupport } from "@/lib/client/capture";
import { getFlag, setFlag } from "@/lib/client/settings";
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
            <span className="mr-auto text-[13px] text-muted">This stops the recording in progress.</span>
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
            <span className="text-[13px] font-medium text-muted">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled meeting"
              className="mt-1.5 h-11 w-full rounded-xl border border-rule bg-paper/60 px-3.5 font-serif text-[18px] placeholder:text-faint focus:border-ink-2 focus:bg-sheet focus:outline-none"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="text-[13px] font-medium text-muted">Template</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={cx(
                    "relative cursor-pointer rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    template === t.id ? "border-ink bg-sheet shadow-card" : "border-rule bg-paper/50 hover:border-rule-strong",
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
                  <span className="block font-serif text-[17px] leading-tight">{t.name}</span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-muted">{t.blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className={mode === "new" ? "mt-5" : ""}>
        <legend className="text-[13px] font-medium text-muted">Listen to</legend>
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
      </fieldset>

      {support.recorder && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl px-1 text-[14px] leading-snug">
          <input
            type="checkbox"
            checked={keepAudio}
            onChange={(e) => setKeepAudio(e.target.checked)}
            className="mt-[3px] h-4 w-4 shrink-0 accent-[#1b1915]"
          />
          <span>
            <span className="font-medium text-ink">Keep the audio on this device</span>
            <span className="block text-[12.5px] text-muted">
              So clicking a footnote plays the exact moment. Stored in this browser only, never uploaded. Delete it any time.
            </span>
          </span>
        </label>
      )}

      {showExplainer ? (
        <div className="mt-5 rounded-2xl border border-rule bg-paper px-4 py-3.5 text-[14px] leading-relaxed text-ink-2">
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
            className="mt-2 text-[13.5px] font-medium text-ink underline underline-offset-2"
          >
            Got it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExplainer(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"
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
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
        checked ? "border-ink bg-sheet shadow-card" : "border-rule bg-paper/50 hover:border-rule-strong",
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
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{detail}</span>
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

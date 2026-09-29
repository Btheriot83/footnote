"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { InfoIcon, MicIcon, SpeakerIcon, TabAudioIcon, UploadIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { captureSupport } from "@/lib/client/capture";
import { audioDuration, MAX_IMPORT_BYTES, MAX_IMPORT_MINUTES } from "@/lib/client/import-audio";
import { formatClock, formatDuration } from "@/lib/format";
import { parseTranscript, titleFromFile, type ParsedTranscript } from "@/lib/import";
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
  /** A transcript or a recording brought in from a file instead of recording live. */
  imported?:
    | { kind: "transcript"; fileName: string; parsed: ParsedTranscript }
    | { kind: "audio"; file: File; durationMs: number };
}

const AUDIO_EXT = /\.(mp3|m4a|mp4|aac|wav|webm|ogg|oga|opus|flac|mov)$/i;
const isAudio = (f: File) => /^(audio|video)\//.test(f.type) || AUDIO_EXT.test(f.name);

type Picked =
  | { kind: "transcript"; file: File; text: string; parsed: ParsedTranscript }
  | { kind: "audio"; file: File; durationMs: number };

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
  const [via, setVia] = useState<"record" | "import">("record");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [me, setMe] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  // Until you flip it yourself, the meeting tab follows what this browser can do.
  const [tabTouched, setTabTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVia("record");
    setPicked(null);
    setMe("");
    setFileError(null);
    setSupport(captureSupport());
    setShowExplainer(false);
    setShowTemplates(false);
    setTabTouched(false);
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
  // The other side of the call is the half that matters: on by default wherever a tab's
  // sound can actually be shared (Chrome and Edge on a desktop) and there's AI to hear it.
  const tabByDefault = tabAvailable && chromiumDesktop() && !noAi;
  useEffect(() => {
    if (open && !tabTouched) setTab(tabByDefault);
  }, [open, tabTouched, tabByDefault]);
  const needsAi = (tab && tabAvailable) || (mic && support.mic && !support.speech);
  const templateName = TEMPLATES.find((t) => t.id === template)?.name ?? "General";

  async function pick(file: File | undefined | null) {
    setFileError(null);
    setPicked(null);
    setMe("");
    if (!file) return;
    if (isAudio(file)) {
      if (file.size > MAX_IMPORT_BYTES) {
        setFileError("That recording is over 300 MB. Import the transcript file from Zoom, Meet or Teams instead.");
        return;
      }
      const durationMs = await audioDuration(file);
      if (durationMs > MAX_IMPORT_MINUTES * 60000) {
        setFileError(`Recordings up to ${MAX_IMPORT_MINUTES / 60} hours can be imported. Try the transcript file instead.`);
        return;
      }
      setPicked({ kind: "audio", file, durationMs });
    } else {
      if (file.size > 5 * 1024 * 1024) {
        setFileError("That file is too big to be a transcript.");
        return;
      }
      const text = await file.text();
      const parsed = parseTranscript(file.name, text);
      if (parsed.segments.length === 0) {
        setFileError("No transcript lines found in that file. Footnote reads .vtt, .srt and .txt transcripts.");
        return;
      }
      setPicked({ kind: "transcript", file, text, parsed });
    }
    if (!title.trim()) setTitle(titleFromFile(file.name));
  }

  function startImport() {
    if (!picked) return;
    const imported: StartOptions["imported"] =
      picked.kind === "audio"
        ? { kind: "audio", file: picked.file, durationMs: picked.durationMs }
        : { kind: "transcript", fileName: picked.file.name, parsed: parseTranscript(picked.file.name, picked.text, { me: me || null }) };
    onStart({ title, template, mic: false, tab: false, record: false, keepAudio: false, imported });
  }

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
          ? via === "import"
            ? "Bring in a meeting you already had. Speakers and times come with it, so the notes still get receipts."
            : undefined
          : "Choose what Footnote should listen to."
      }
      className="max-w-[700px]"
      footer={
        via === "import" ? (
          <>
            <button type="button" className={cx(btn.base, btn.secondary, btn.md)} onClick={() => setVia("record")}>
              Back
            </button>
            <button
              type="button"
              className={cx(btn.base, btn.primary, btn.md)}
              onClick={startImport}
              disabled={!picked || (picked.kind === "audio" && noAi)}
            >
              <UploadIcon size={15} />
              {picked?.kind === "audio" ? "Transcribe and import" : "Import"}
            </button>
          </>
        ) : (
        <>
          {mode === "new" && (
            <button
              type="button"
              className={cx(btn.base, btn.secondary, btn.md, "mr-auto max-sm:order-2 max-sm:mr-0 max-sm:flex-1")}
              onClick={() => setVia("import")}
              title="Import a recording, or a Zoom, Meet or Teams transcript"
            >
              <UploadIcon size={15} /> Import a file
            </button>
          )}
          {mode === "new" && (
            <button type="button" className={cx(btn.base, btn.ghost, btn.md, "max-sm:order-3 max-sm:flex-1")} onClick={() => start(false)}>
              Just take notes
            </button>
          )}
          <button
            type="button"
            className={cx(btn.base, btn.primary, btn.md, "max-sm:order-1 max-sm:h-12 max-sm:w-full")}
            onClick={() => start(true)}
            disabled={!mic && !tab}
          >
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            Start recording
          </button>
        </>
        )
      }
    >
      {mode === "new" && (
        <label className="block">
          <span className="sr-only">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled meeting"
            aria-label="Title"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && via === "record" && (mic || tab)) {
                e.preventDefault();
                start(true);
              }
            }}
            className="paper paper-white h-14 w-full rounded-[3px] px-4 font-serif text-[23px] tracking-[-0.01em] placeholder:italic placeholder:text-faint focus:shadow-[0_0_0_1.5px_var(--color-ink-2),var(--shadow-card)] focus:outline-none"
          />
        </label>
      )}

      {via === "import" ? (
        <ImportPanel
          picked={picked}
          error={fileError}
          me={me}
          onMe={setMe}
          dragging={dragging}
          onDragging={setDragging}
          onPick={(f) => void pick(f)}
          noAi={noAi}
        />
      ) : (
        <>
          {/* Everything else is a row of chips you can change in place. */}
          <div className={cx("flex flex-wrap gap-2", mode === "new" && "mt-4")} role="group" aria-label="Meeting settings">
            {mode === "new" && (
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                aria-expanded={showTemplates}
                aria-controls="template-grid"
                className={chip(true)}
              >
                <span className="text-muted">Template</span> {templateName}
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden className={cx("text-muted transition-transform duration-300", showTemplates && "rotate-180")}>
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <Chip
              checked={mic && support.mic}
              onChange={setMic}
              disabled={!support.mic}
              icon={<MicIcon size={16} />}
              label="Mic"
              aria={`Your microphone. ${!support.mic ? "Not available in this browser." : support.speech ? "Labeled You, transcribed free in the browser." : "Labeled You, transcribed with OpenAI."}`}
            />
            <Chip
              checked={tab && tabAvailable}
              onChange={(v) => {
                setTabTouched(true);
                setTab(v);
              }}
              disabled={!tabAvailable}
              icon={<TabAudioIcon size={16} />}
              label="Meeting tab"
              aria={`Meeting tab audio: the other side of the call. ${tabAvailable ? "Labeled Them. Google Meet, Zoom or Teams in a browser tab." : "Needs Chrome or Edge on a desktop."}`}
            />
            {support.recorder && (
              <Chip
                checked={keepAudio}
                onChange={setKeepAudio}
                icon={<SpeakerIcon size={15} />}
                label="Keep audio"
                aria="Keep the audio on this device, so clicking a footnote plays the exact moment. Stored in this browser only, never uploaded."
              />
            )}
          </div>

          {mode === "new" && showTemplates && (
            <fieldset id="template-grid" className="animate-fade-up mt-3">
              <legend className="sr-only">Template</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <label
                    key={t.id}
                    className={cx(
                      "relative cursor-pointer rounded-[3px] border px-3.5 py-3 transition-[background-color,border-color,box-shadow,rotate] duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                      template === t.id
                        ? "paper paper-white -rotate-[0.8deg] border-ink/70"
                        : "border-ink/10 bg-wash/50 hover:border-ink/25 hover:bg-wash",
                    )}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t.id}
                      checked={template === t.id}
                      onChange={() => {
                        setTemplate(t.id);
                        setShowTemplates(false);
                      }}
                      className="sr-only"
                    />
                    <span className="block font-serif text-[18px] font-medium leading-tight">{t.name}</span>
                    <span className="mt-1 block text-[14px] leading-snug text-muted">{t.blurb}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* One line on what happens next, in plain words. */}
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {tab && tabAvailable ? (
              <>
                Chrome will ask what to share: pick the tab with your call and switch on{" "}
                <strong className="font-medium text-ink">Share tab audio</strong>.
              </>
            ) : mic && support.mic ? (
              <>Footnote hears your side through the mic. {tabAvailable ? "Add the meeting tab to hear the other side too." : "The other side needs Chrome or Edge on a desktop."}</>
            ) : (
              <>Pick something to listen to, or just take notes.</>
            )}{" "}
            {!showExplainer && (
              <button
                type="button"
                onClick={() => setShowExplainer(true)}
                className="whitespace-nowrap italic text-muted underline decoration-current/30 underline-offset-4 hover:text-ink"
              >
                What can a browser hear?
              </button>
            )}
          </p>
          {liveElsewhere && <p className="mt-2 text-[14.5px] italic text-muted">Starting this stops the recording in progress.</p>}
          {noAi && needsAi && (
            <p className="mt-2 flex items-start gap-2 text-[14.5px] leading-snug text-ink-2" role="status">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              {tab && tabAvailable ? "Tab audio" : "Your mic, in this browser,"} is transcribed by OpenAI, and this demo server
              has no key. Add your own in Settings first, or just take notes.
            </p>
          )}

          {showExplainer && (
            <div className="paper paper-sky animate-fade-up mt-4 rotate-[0.3deg] rounded-[2px] px-5 py-4 text-[15.5px] leading-relaxed text-ink-2">
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
          )}
        </>
      )}
    </Dialog>
  );
}

/** Chrome and Edge on a desktop: the browsers that can share a tab's sound. */
function chromiumDesktop() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\/|Edg\//.test(ua) && !/Mobile|Android|CriOS|EdgiOS/.test(ua);
}

const chip = (on: boolean) =>
  cx(
    "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 font-serif text-[15.5px] transition-[background-color,border-color,color,box-shadow] duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
    on ? "paper paper-white border-ink/60 text-ink" : "border-ink/15 bg-wash/40 text-muted hover:border-ink/30 hover:bg-wash",
  );

function Chip({
  checked,
  onChange,
  disabled,
  icon,
  label,
  aria,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  aria: string;
}) {
  return (
    <label className={cx(chip(checked), "cursor-pointer select-none", disabled && "cursor-not-allowed opacity-55")} title={aria}>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={aria}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={checked ? "text-ink" : "text-faint"}>{icon}</span>
      <span className={cx(!checked && "line-through decoration-faint/70")}>{label}</span>
      <span
        aria-hidden
        className={cx(
          "flex h-[16px] w-[16px] items-center justify-center rounded-full transition-colors",
          checked ? "bg-ink text-paper" : "border border-rule-strong",
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </label>
  );
}

function ImportPanel({
  picked,
  error,
  me,
  onMe,
  dragging,
  onDragging,
  onPick,
  noAi,
}: {
  picked: Picked | null;
  error: string | null;
  me: string;
  onMe: (v: string) => void;
  dragging: boolean;
  onDragging: (v: boolean) => void;
  onPick: (f: File | undefined) => void;
  noAi: boolean;
}) {
  const preview = picked?.kind === "transcript" ? parseTranscript(picked.file.name, picked.text, { me: me || null }) : null;
  return (
    <div className="mt-5">
      <p className="smallcaps text-[10.5px] text-muted">Import</p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          onDragging(true);
        }}
        onDragLeave={() => onDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragging(false);
          onPick(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-[3px] border-[1.5px] border-dashed px-5 py-7 text-center transition-[background-color,border-color,scale] duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
          dragging ? "scale-[1.01] border-accent bg-accent-softer/60" : "border-rule-strong hover:border-ink/40 hover:bg-wash",
        )}
      >
        <UploadIcon size={22} className="text-muted" />
        <span className="font-serif text-[18px] text-ink">
          {picked ? picked.file.name : "Drop a file here, or choose one"}
        </span>
        <span className="text-[14px] leading-snug text-muted">
          Transcripts: .vtt (Zoom, Teams), .srt, .txt (Meet, Otter). Recordings: .mp3, .m4a, .wav, .webm.
        </span>
        <input
          type="file"
          className="sr-only"
          aria-label="Choose a recording or transcript file"
          accept=".vtt,.srt,.txt,text/plain,text/vtt,audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg,.flac"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-[14.5px] leading-snug text-ink-2" role="alert">
          <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          {error}
        </p>
      )}

      {preview && (
        <div className="mt-4">
          <p className="text-[15px] text-ink-2">
            <strong className="font-semibold text-ink">{preview.segments.length} lines</strong>
            {preview.durationMs > 0 && <> · {formatDuration(preview.durationMs)}</>}
            {preview.speakers.length > 0 && (
              <> · {preview.speakers.length} speaker{preview.speakers.length === 1 ? "" : "s"}</>
            )}
            {preview.estimated && <span className="italic text-muted"> · no times in the file, so they&rsquo;re estimated</span>}
          </p>
          {preview.speakers.length > 1 && (
            <label className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-ink-2">
              Which one is you?
              <select
                value={me}
                onChange={(e) => onMe(e.target.value)}
                className="paper paper-white h-9 rounded-[3px] px-2.5 font-serif text-[15.5px] text-ink focus:outline-none"
              >
                <option value="">None of them</option>
                {preview.speakers.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ol className="receipt mt-4 space-y-2 px-4 py-3" aria-label="First lines">
            {preview.segments.slice(0, 3).map((sg) => (
              <li key={sg.id} className="text-[12.5px] leading-[1.55]">
                <span className="flex justify-between text-[11px] uppercase text-[var(--receipt-dim)]">
                  <span>{sg.label || (sg.speaker === "you" ? "You" : "Them")}</span>
                  <span>{formatClock(sg.t)}</span>
                </span>
                <span className="line-clamp-2 text-[var(--receipt-ink)]">{sg.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {picked?.kind === "audio" && (
        <div className="mt-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            <strong className="font-semibold text-ink">{formatDuration(picked.durationMs) || "A recording"}</strong> to
            transcribe. It&rsquo;s sent to OpenAI in short pieces (well under a cent a minute with your key) and the file
            itself stays on this device, so every footnote can play its moment.
          </p>
          {noAi && (
            <p className="mt-2 flex items-start gap-2" role="status">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              This demo server has no AI key, so recordings need your own. Add it in Settings, or import a transcript file
              instead: those work without a key.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

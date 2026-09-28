"use client";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { CheckIcon, CopyIcon, DownloadIcon, LinkIcon, SlackIcon } from "@/components/icons";
import { btn, cx } from "@/components/ui";
import { slugify, toMarkdown, toSlack } from "@/lib/export";
import { buildSharePayload, shareUrl } from "@/lib/share";
import { toast } from "@/lib/client/toast";
import type { Meeting } from "@/lib/types";

export async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, { tone: "success" });
    return true;
  } catch {
    toast("Couldn't access the clipboard. Try again, or use Download.", { tone: "error" });
    return false;
  }
}

export function downloadMarkdown(m: Meeting) {
  const blob = new Blob([toMarkdown(m)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(m.title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Downloaded Markdown.", { tone: "success" });
}

export function ShareDialog({ open, onClose, meeting }: { open: boolean; onClose: () => void; meeting: Meeting }) {
  const [full, setFull] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    if (!open || typeof window === "undefined") return "";
    const payload = buildSharePayload(meeting, { fullTranscript: full || !meeting.enhanced, includeNotes: includeNotes || !meeting.enhanced });
    return shareUrl(window.location.origin, payload);
  }, [open, meeting, full, includeNotes]);

  const kb = Math.max(1, Math.round(url.length / 1024));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share"
      description="The note lives inside the link itself, compressed. Nothing is uploaded, and anyone with the link can read it."
    >
      <div className="flex gap-2">
        <label htmlFor="share-url" className="sr-only">
          Share link
        </label>
        <input
          id="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 truncate rounded-xl border border-rule bg-paper/60 px-3.5 text-[14px] text-ink-2 focus:outline-none"
        />
        <button
          type="button"
          className={cx(btn.base, btn.primary, btn.md, "shrink-0")}
          onClick={async () => {
            if (await copyText(url, "Link copied.")) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }
          }}
        >
          {copied ? <CheckIcon size={17} /> : <LinkIcon size={17} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        Read-only · {kb} KB link ·{" "}
        <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          Preview
        </a>
      </p>

      {meeting.enhanced ? (
        <div className="mt-4 space-y-2">
          <Check checked={full} onChange={setFull} label="Include the full transcript" hint="Otherwise only the quoted lines are included." />
          <Check checked={includeNotes} onChange={setIncludeNotes} label="Include my rough notes" />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-paper px-3.5 py-2.5 text-[13.5px] text-muted">
          Not enhanced yet, so the link contains your notes and the transcript. Enhance first to share notes with receipts.
        </p>
      )}

      <div className="mt-6 border-t border-rule pt-5">
        <h3 className="text-[13px] font-medium text-muted">Export</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className={cx(btn.base, btn.secondary, btn.md)}
            onClick={() => copyText(toMarkdown(meeting), "Markdown copied, with footnotes.")}
          >
            <CopyIcon size={17} /> Copy Markdown
          </button>
          <button
            type="button"
            className={cx(btn.base, btn.secondary, btn.md)}
            onClick={() => copyText(toSlack(meeting), "Copied for Slack.")}
          >
            <SlackIcon size={17} /> Copy for Slack
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, btn.md)} onClick={() => downloadMarkdown(meeting)}>
            <DownloadIcon size={17} /> Download .md
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#1b1915]"
      />
      <span>
        {label}
        {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

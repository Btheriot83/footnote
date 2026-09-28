"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onUserInput?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

const FOCUS_EVENT = "footnote:focus-notes";

/** Moves the caret into the notepad (after dialogs close and restore focus). */
export function focusNotes() {
  if (typeof window === "undefined") return;
  setTimeout(() => window.dispatchEvent(new Event(FOCUS_EVENT)), 60);
}

/**
 * The notepad starts lines with "- " for you. People type their own marker out of habit,
 * so "- " + "- budget" should stay "- budget", not become "- - budget".
 */
export function mergeTypedMarker(value: string, caret: number): { value: string; caret: number } {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const m = value.slice(lineStart, caret).match(/^(\s*)[-*•] ([-*•]|\d+\.) /);
  if (!m) return { value, caret };
  const drop = 2; // the auto-inserted "- "
  return {
    value: value.slice(0, lineStart) + m[1] + value.slice(lineStart + m[1].length + drop),
    caret: caret - drop,
  };
}

/** A plain, fast notepad. Markdown-ish: "- " bullets continue on Enter. */
export function Notepad({ value, onChange, onUserInput, placeholder, autoFocus, readOnly }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Where the caret belongs after an edit we made for the user. Restored right after React
  // writes the new value, before the next keystroke can land (a rAF is too late for fast typists).
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) {
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(el.scrollHeight, 260) + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    const onFocus = () => {
      const el = ref.current;
      if (!el || el.offsetParent === null) return;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
    };
    window.addEventListener(FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_EVENT, onFocus);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    if (selectionStart !== selectionEnd) return;
    const before = value.slice(0, selectionStart);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = before.slice(lineStart);
    const m = line.match(/^(\s*)([-*•]|\d+\.)\s+/);
    if (!m) return;
    e.preventDefault();
    onUserInput?.();
    if (line.trim() === m[0].trim()) {
      // Empty bullet: end the list.
      const next = value.slice(0, lineStart) + value.slice(selectionStart);
      caret.current = lineStart;
      onChange(next);
      return;
    }
    const marker = /\d+\./.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2];
    const insert = `\n${m[1]}${marker} `;
    const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
    caret.current = selectionStart + insert.length;
    onChange(next);
  }

  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      onChange={(e) => {
        onUserInput?.();
        const el = e.currentTarget;
        const fixed = mergeTypedMarker(el.value, el.selectionStart);
        if (fixed.value !== el.value) caret.current = fixed.caret;
        onChange(fixed.value);
      }}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if (!e.currentTarget.value) onChange("- ");
      }}
      spellCheck
      aria-label="Your notes"
      placeholder={placeholder}
      className="block w-full resize-none bg-transparent font-serif text-[19px] leading-[1.7] text-ink placeholder:text-faint focus:outline-none"
    />
  );
}

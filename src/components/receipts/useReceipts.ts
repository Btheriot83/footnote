"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { citingBullets } from "@/lib/citations";
import type { EnhancedNotes } from "@/lib/types";

export interface Receipts {
  /** Segments currently highlighted in the transcript. */
  activeSegments: Set<string>;
  /** The segment the transcript should scroll to (changes on intent). */
  focusSegment: { id: string; nonce: number } | null;
  /** Bullets highlighted in the notes (e.g. because a cited line was clicked). */
  highlightedBullets: Set<string>;
  /** Transcript line whose "cited in" popover is open. */
  openLine: string | null;
  pinned: string | null;
  flashBullet: { key: string; nonce: number } | null;
  hoverCites(ids: string[] | null, opts?: { scroll?: boolean }): void;
  clickCite(id: string): void;
  toggleLine(id: string): void;
  selectBullet(key: string): void;
  clear(): void;
}

export function useReceipts(notes: EnhancedNotes | null | undefined): Receipts {
  const [hover, setHover] = useState<string[] | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [focusSegment, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [flashBullet, setFlash] = useState<{ key: string; nonce: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonce = useRef(0);

  const focus = useCallback((id: string) => {
    nonce.current += 1;
    setFocus({ id, nonce: nonce.current });
  }, []);

  const hoverCites = useCallback(
    (ids: string[] | null, opts?: { scroll?: boolean }) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (!ids || ids.length === 0) {
        setHover(null);
        return;
      }
      setHover(ids);
      if (opts?.scroll !== false) {
        // Small intent delay so sweeping the mouse across bullets doesn't yank the transcript.
        hoverTimer.current = setTimeout(() => focus(ids[0]), 140);
      }
    },
    [focus],
  );

  const clickCite = useCallback(
    (id: string) => {
      setPinned((p) => (p === id ? null : id));
      setOpenLine(null);
      focus(id);
    },
    [focus],
  );

  const toggleLine = useCallback((id: string) => {
    setOpenLine((o) => (o === id ? null : id));
    setPinned(null);
  }, []);

  const selectBullet = useCallback((key: string) => {
    nonce.current += 1;
    setFlash({ key, nonce: nonce.current });
  }, []);

  const clear = useCallback(() => {
    setHover(null);
    setPinned(null);
    setOpenLine(null);
  }, []);

  // Reset when the underlying notes change identity (new meeting / re-enhance).
  useEffect(() => {
    clear();
  }, [notes, clear]);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const activeSegments = useMemo(() => {
    const s = new Set<string>();
    (hover ?? []).forEach((id) => s.add(id));
    if (pinned) s.add(pinned);
    if (openLine) s.add(openLine);
    return s;
  }, [hover, pinned, openLine]);

  const highlightedBullets = useMemo(() => {
    const s = new Set<string>();
    if (openLine) citingBullets(notes, openLine).forEach((b) => s.add(b.key));
    return s;
  }, [notes, openLine]);

  return {
    activeSegments,
    focusSegment,
    highlightedBullets,
    openLine,
    pinned,
    flashBullet,
    hoverCites,
    clickCite,
    toggleLine,
    selectBullet,
    clear,
  };
}

"use client";
import { useSyncExternalStore } from "react";
import { db } from "../db";
import { uid } from "../format";
import type { Meeting, TemplateId } from "../types";

/**
 * In-memory cache in front of IndexedDB. Components and the capture engine
 * update meetings through here; writes are debounced to Dexie.
 */
const cache = new Map<string, Meeting>();
const listeners = new Map<string, Set<() => void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const loading = new Map<string, Promise<Meeting | undefined>>();

function emit(id: string) {
  listeners.get(id)?.forEach((l) => l());
}

function scheduleSave(id: string, delay = 350) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      const m = cache.get(id);
      if (m) void db.meetings.put(m);
    }, delay),
  );
}

export function flushSaves() {
  for (const [id, t] of timers) {
    clearTimeout(t);
    timers.delete(id);
    const m = cache.get(id);
    if (m) void db.meetings.put(m);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSaves);
  window.addEventListener("beforeunload", flushSaves);
}

export async function loadMeeting(id: string): Promise<Meeting | undefined> {
  const hit = cache.get(id);
  if (hit) return hit;
  let p = loading.get(id);
  if (!p) {
    p = db.meetings.get(id).then((m) => {
      if (m && !cache.has(id)) cache.set(id, m);
      loading.delete(id);
      emit(id);
      return cache.get(id);
    });
    loading.set(id, p);
  }
  return p;
}

export function getMeeting(id: string | null | undefined): Meeting | undefined {
  return id ? cache.get(id) : undefined;
}

export function updateMeeting(id: string, fn: (m: Meeting) => Meeting, opts?: { immediate?: boolean }) {
  const current = cache.get(id);
  if (!current) return;
  const next = { ...fn(current), updatedAt: Date.now() };
  cache.set(id, next);
  emit(id);
  scheduleSave(id, opts?.immediate ? 0 : 350);
}

export function patchMeetingState(id: string, patch: Partial<Meeting>, opts?: { immediate?: boolean }) {
  updateMeeting(id, (m) => ({ ...m, ...patch }), opts);
}

export async function createMeeting(init: {
  title?: string;
  template: TemplateId;
  isSample?: boolean;
  id?: string;
}): Promise<Meeting> {
  const now = Date.now();
  const m: Meeting = {
    id: init.id ?? uid("m_"),
    title: init.title?.trim() || "",
    template: init.template,
    createdAt: now,
    updatedAt: now,
    durationMs: 0,
    status: "draft",
    notes: "",
    segments: [],
    enhanced: null,
    isSample: init.isSample,
  };
  cache.set(m.id, m);
  await db.meetings.put(m);
  emit(m.id);
  return m;
}

export async function deleteMeeting(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  cache.delete(id);
  await db.meetings.delete(id);
  emit(id);
}

export function useMeeting(id: string | null): Meeting | undefined {
  return useSyncExternalStore(
    (cb) => {
      if (!id) return () => {};
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      set.add(cb);
      if (!cache.has(id)) void loadMeeting(id);
      return () => set!.delete(cb);
    },
    () => (id ? cache.get(id) : undefined),
    () => undefined,
  );
}

/** Next free segment id ("s1", "s2", ...) for a meeting. */
export function nextSegmentId(m: Meeting): string {
  let max = 0;
  for (const s of m.segments) {
    const n = parseInt(s.id.replace(/^\D+/, ""), 10);
    if (n > max) max = n;
  }
  return `s${max + 1}`;
}

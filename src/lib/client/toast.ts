"use client";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  /** Toasts that report on the same thing share a key; a new one replaces the last. */
  key?: string;
  message: string;
  tone: "neutral" | "error" | "success";
  action?: { label: string; onClick: () => void };
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(
  message: string,
  opts?: { tone?: Toast["tone"]; action?: Toast["action"]; duration?: number; key?: string },
) {
  const id = nextId++;
  // Replace an identical visible toast (or an older one about the same thing) instead of stacking.
  toasts = [
    ...toasts.filter((t) => t.message !== message && (!opts?.key || t.key !== opts.key)),
    { id, key: opts?.key, message, tone: opts?.tone ?? "neutral", action: opts?.action },
  ].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), opts?.duration ?? (opts?.tone === "error" ? 7000 : 3200));
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => [] as Toast[],
  );
}

/** Takes down any toast with this key (its news is out of date). */
export function dismissToastKey(key: string) {
  if (!toasts.some((t) => t.key === key)) return;
  toasts = toasts.filter((t) => t.key !== key);
  emit();
}

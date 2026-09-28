"use client";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "neutral" | "error" | "success";
  action?: { label: string; onClick: () => void };
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"]; duration?: number }) {
  const id = nextId++;
  // Replace an identical visible toast instead of stacking duplicates.
  toasts = [...toasts.filter((t) => t.message !== message), { id, message, tone: opts?.tone ?? "neutral", action: opts?.action }].slice(-3);
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

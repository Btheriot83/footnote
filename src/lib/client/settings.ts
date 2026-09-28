"use client";
import { useSyncExternalStore } from "react";

const KEY_STORAGE = "footnote.openaiKey";
const listeners = new Set<() => void>();

export function getUserKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setUserKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useUserKey(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === KEY_STORAGE && cb();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    getUserKey,
    () => "",
  );
}

export function maskKey(key: string): string {
  if (!key) return "";
  return key.slice(0, 6) + "…" + key.slice(-4);
}

export function getFlag(name: string): boolean {
  try {
    return localStorage.getItem(`footnote.${name}`) === "1";
  } catch {
    return false;
  }
}

export function setFlag(name: string, value: boolean) {
  try {
    if (value) localStorage.setItem(`footnote.${name}`, "1");
    else localStorage.removeItem(`footnote.${name}`);
  } catch {
    /* ignore */
  }
}

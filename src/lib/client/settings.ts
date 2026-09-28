"use client";
import { useSyncExternalStore } from "react";

const KEY_STORAGE = "footnote.openaiKey";
const STATUS_STORAGE = "footnote.openaiKeyStatus";
const listeners = new Set<() => void>();

/** "bad" once OpenAI has rejected the saved key: it stays saved, but isn't sent until fixed. */
export type KeyStatus = "unknown" | "ok" | "bad";

export function getKeyStatus(): KeyStatus {
  if (typeof window === "undefined") return "unknown";
  try {
    const v = localStorage.getItem(STATUS_STORAGE);
    return v === "ok" || v === "bad" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

export function setKeyStatus(status: KeyStatus) {
  try {
    if (status === "unknown") localStorage.removeItem(STATUS_STORAGE);
    else localStorage.setItem(STATUS_STORAGE, status);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** The key to send with requests: the saved one, unless OpenAI rejected it. */
export function getActiveKey(): string {
  return getKeyStatus() === "bad" ? "" : getUserKey();
}

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
    localStorage.removeItem(STATUS_STORAGE);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => (e.key === KEY_STORAGE || e.key === STATUS_STORAGE) && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useUserKey(): string {
  return useSyncExternalStore(subscribe, getUserKey, () => "");
}

export function useKeyStatus(): KeyStatus {
  return useSyncExternalStore(subscribe, getKeyStatus, () => "unknown" as KeyStatus);
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

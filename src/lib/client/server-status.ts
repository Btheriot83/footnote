"use client";
import { useEffect, useSyncExternalStore } from "react";
import { fetchStatus, type Status } from "./api";

/**
 * What the server offers (a hosted key or not, today's allowance). Fetched once per
 * page and refreshed when Settings opens, so copy never promises what the server can't do.
 */
let status: Status | null = null;
let inflight: Promise<Status | null> | null = null;
const listeners = new Set<() => void>();

export function refreshServerStatus(): Promise<Status | null> {
  inflight ??= fetchStatus().then((s) => {
    inflight = null;
    if (s) {
      status = s;
      listeners.forEach((l) => l());
    }
    return s;
  });
  return inflight;
}

export function getServerStatus(): Status | null {
  return status;
}

export function useServerStatus(): Status | null {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => null,
  );
  useEffect(() => {
    if (!status) void refreshServerStatus();
  }, []);
  return s;
}

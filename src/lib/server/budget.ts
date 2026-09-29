import "server-only";
import { randomUUID } from "node:crypto";

/**
 * HARD global spending stop for the hosted OpenAI key.
 *
 * One JSON document in Vercel Blob holds what the hosted key has spent. Every hosted
 * call reserves its worst-case cost first (refused if it would cross the cap), then
 * settles to the real cost from token usage. Writes are conditional on the blob's
 * ETag (compare-and-swap with retries), so concurrent requests can't both slip under
 * the cap. If the blob can't be read or written, hosted calls are refused (fails closed).
 *
 * User-key calls never touch this.
 */

export type BudgetKind = "enhance" | "ask" | "transcribe";

export interface Reservation {
  cents: number;
  kind: BudgetKind;
  at: number;
}

export interface BudgetDoc {
  v: 1;
  spentCents: number;
  reservations: Record<string, Reservation>;
  /** Last few charges, for the admin view. No user data. */
  log: { kind: BudgetKind; cents: number; at: number }[];
}

export interface BudgetStore {
  /** null when the document doesn't exist yet. Throws when the store can't be read. */
  read(): Promise<{ doc: BudgetDoc; etag: string } | null>;
  /** etag null = create only if absent. Throws BudgetConflict when the etag no longer matches. */
  write(doc: BudgetDoc, etag: string | null): Promise<void>;
}

export class BudgetConflict extends Error {}

const LOG_SIZE = 40;
const MAX_ATTEMPTS = 8;
/** A reservation this old belongs to a call that died without settling: count it as spent. */
const STALE_MS = 10 * 60 * 1000;

export function capCents(): number {
  const n = Number(process.env.FOOTNOTE_HOSTED_BUDGET_CENTS);
  return Number.isFinite(n) && n >= 0 ? n : 900;
}

/** Conservative price table (USD per 1M tokens), deliberately above list prices. */
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5.5": { input: 15, output: 60 },
};
const UNKNOWN_PRICE = { input: 15, output: 60 };
/** Per audio minute, deliberately above list price. */
export const TRANSCRIBE_CENTS_PER_MIN = 1;

export const ESTIMATE_CENTS = { enhance: 15, ask: 6, transcribePerMinute: 2 };

export function tokenCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? UNKNOWN_PRICE;
  const usd = (Math.max(0, inputTokens) * p.input + Math.max(0, outputTokens) * p.output) / 1_000_000;
  return round(usd * 100);
}

/**
 * Worst case for a chat call: every prompt char a token (tokens are ~4 chars, so this
 * over-counts) and the full output budget used. Never below the flat estimate.
 */
export function chatReserveCents(kind: "enhance" | "ask", model: string, promptChars: number, maxOutputTokens: number) {
  return Math.max(ESTIMATE_CENTS[kind], Math.ceil(tokenCostCents(model, promptChars / 2, maxOutputTokens)));
}

/** Minutes to bill: the larger of the reported duration and what the byte size could hold. */
export function audioMinutes(durationSec: number, bytes: number): number {
  // ~32 kbps (4000 B/s) is at the low end of browser MediaRecorder output.
  return Math.max(durationSec, bytes / 4000) / 60;
}

export function transcribeReserveCents(minutes: number) {
  return ESTIMATE_CENTS.transcribePerMinute * Math.max(1, Math.ceil(minutes));
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}

function empty(): BudgetDoc {
  return { v: 1, spentCents: 0, reservations: {}, log: [] };
}

function normalize(raw: unknown): BudgetDoc {
  const d = raw as Partial<BudgetDoc> | null;
  if (!d || typeof d !== "object" || !Number.isFinite(d.spentCents)) throw new Error("budget doc corrupt");
  return {
    v: 1,
    spentCents: Number(d.spentCents),
    reservations: d.reservations && typeof d.reservations === "object" ? { ...d.reservations } : {},
    log: Array.isArray(d.log) ? d.log.slice(-LOG_SIZE) : [],
  };
}

/** Moves reservations whose call never settled into spent (conservative). */
function expireStale(doc: BudgetDoc, now: number) {
  for (const [id, r] of Object.entries(doc.reservations)) {
    if (now - r.at > STALE_MS) {
      doc.spentCents = round(doc.spentCents + r.cents);
      doc.log.push({ kind: r.kind, cents: r.cents, at: now });
      delete doc.reservations[id];
    }
  }
}

export function reservedCents(doc: BudgetDoc): number {
  return round(Object.values(doc.reservations).reduce((s, r) => s + r.cents, 0));
}

/** Read-modify-write with compare-and-swap. Returns fn's result; throws if the store fails. */
async function mutate<T>(store: BudgetStore, fn: (doc: BudgetDoc) => T): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await store.read();
    const doc = current ? normalize(current.doc) : empty();
    expireStale(doc, Date.now());
    const result = fn(doc);
    doc.log = doc.log.slice(-LOG_SIZE);
    try {
      await store.write(doc, current?.etag ?? null);
      return result;
    } catch (err) {
      if (!(err instanceof BudgetConflict)) throw err;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
    }
  }
  throw new Error("budget contention");
}

export type ReserveResult = { ok: true; id: string } | { ok: false; reason: "exhausted" | "unavailable" };

/** Call BEFORE any hosted OpenAI call. Refuses if it would cross the cap, or if the store fails. */
export async function reserve(kind: BudgetKind, estCents: number, store: BudgetStore = defaultStore()): Promise<ReserveResult> {
  const id = randomUUID();
  const cap = capCents();
  try {
    const ok = await mutate(store, (doc) => {
      if (doc.spentCents + reservedCents(doc) + estCents > cap) return false;
      doc.reservations[id] = { cents: estCents, kind, at: Date.now() };
      return true;
    });
    return ok ? { ok: true, id } : { ok: false, reason: "exhausted" };
  } catch (err) {
    console.error(`[footnote] budget reserve failed closed: ${(err as Error)?.message ?? err}`);
    return { ok: false, reason: "unavailable" };
  }
}

/** Replaces the reservation with the real cost. If this fails, the reservation stays and later expires into spent. */
export async function settle(id: string, actualCents: number, store: BudgetStore = defaultStore()): Promise<void> {
  try {
    await mutate(store, (doc) => {
      const r = doc.reservations[id];
      delete doc.reservations[id];
      const cents = round(Math.max(0, actualCents));
      doc.spentCents = round(doc.spentCents + cents);
      doc.log.push({ kind: r?.kind ?? "enhance", cents, at: Date.now() });
    });
  } catch (err) {
    console.error(`[footnote] budget settle failed (reservation will expire into spent): ${(err as Error)?.message ?? err}`);
  }
}

/** For calls OpenAI rejected before doing any work: drop the reservation. */
export async function release(id: string, store: BudgetStore = defaultStore()): Promise<void> {
  try {
    await mutate(store, (doc) => {
      delete doc.reservations[id];
    });
  } catch (err) {
    console.error(`[footnote] budget release failed (reservation will expire into spent): ${(err as Error)?.message ?? err}`);
  }
}

export interface BudgetSnapshot {
  capCents: number;
  spentCents: number;
  reservedCents: number;
  remainingCents: number;
  log: BudgetDoc["log"];
}

/** Current state, or null when the store can't be read (callers treat that as exhausted). */
export async function snapshot(store: BudgetStore = defaultStore()): Promise<BudgetSnapshot | null> {
  try {
    const current = await store.read();
    const doc = current ? normalize(current.doc) : empty();
    const reserved = reservedCents(doc);
    const cap = capCents();
    return {
      capCents: cap,
      spentCents: doc.spentCents,
      reservedCents: reserved,
      remainingCents: round(Math.max(0, cap - doc.spentCents - reserved)),
      log: doc.log,
    };
  } catch (err) {
    console.error(`[footnote] budget read failed: ${(err as Error)?.message ?? err}`);
    return null;
  }
}

/** Whether the hosted key can take at least the cheapest call. Cached briefly; fails closed. */
let cachedAvailable: { at: number; value: boolean } | null = null;
export async function hostedBudgetAvailable(): Promise<boolean> {
  if (cachedAvailable && Date.now() - cachedAvailable.at < 15_000) return cachedAvailable.value;
  const s = await snapshot();
  const value = !!s && s.remainingCents >= ESTIMATE_CENTS.transcribePerMinute;
  cachedAvailable = { at: Date.now(), value };
  return value;
}

export function budgetExhaustedResponse() {
  return Response.json(
    {
      // Same shape as the no-key path, so the sample falls back to its cached results.
      error: "no_key",
      message:
        "The free demo allowance for this site is used up. Add your own OpenAI key in Settings to keep using AI features; it stays in your browser.",
    },
    { status: 503 },
  );
}

// ---- Vercel Blob store ----

/** Production has its own counter; preview and local runs share the same store but never touch it. */
const PATHNAME =
  process.env.VERCEL_ENV === "production" ? "footnote-budget/budget.json" : `footnote-budget/budget-${process.env.VERCEL_ENV || "local"}.json`;

let storeOverride: BudgetStore | null = null;
/** Tests only. */
export function __setStoreForTests(s: BudgetStore | null) {
  storeOverride = s;
  cachedAvailable = null;
}

function defaultStore(): BudgetStore {
  return storeOverride ?? blobStore;
}

const blobStore: BudgetStore = {
  async read() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("no blob token");
    const { get } = await import("@vercel/blob");
    const res = await get(PATHNAME, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(5000) });
    if (!res) return null;
    if (res.statusCode !== 200) throw new Error(`unexpected blob status ${res.statusCode}`);
    const text = await new Response(res.stream).text();
    return { doc: normalize(JSON.parse(text)), etag: res.blob.etag };
  },
  async write(doc, etag) {
    const { put, BlobPreconditionFailedError } = await import("@vercel/blob");
    try {
      await put(PATHNAME, JSON.stringify(doc), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
        abortSignal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) throw new BudgetConflict("etag mismatch");
      // Creating when it already exists: another request won the race.
      if (!etag && /already exists/i.test(String((err as Error)?.message))) throw new BudgetConflict("exists");
      throw err;
    }
  },
};

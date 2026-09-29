import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  __setStoreForTests,
  audioMinutes,
  BudgetConflict,
  type BudgetDoc,
  type BudgetStore,
  chatReserveCents,
  hostedBudgetAvailable,
  release,
  reserve,
  settle,
  snapshot,
  tokenCostCents,
  transcribeReserveCents,
} from "@/lib/server/budget";

/** In-memory blob with ETag compare-and-swap and an async gap between read and write. */
function memoryStore(initial?: Partial<BudgetDoc>) {
  let doc: BudgetDoc | null = initial ? { v: 1, spentCents: 0, reservations: {}, log: [], ...initial } : null;
  let version = 0;
  let conflicts = 0;
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  const store: BudgetStore = {
    async read() {
      await tick();
      return doc ? { doc: structuredClone(doc), etag: String(version) } : null;
    },
    async write(next, etag) {
      await tick();
      const current = doc ? String(version) : null;
      if (etag !== current) {
        conflicts++;
        throw new BudgetConflict("mismatch");
      }
      doc = structuredClone(next);
      version++;
    },
  };
  return { store, get doc() { return doc; }, get conflicts() { return conflicts; } };
}

beforeEach(() => {
  process.env.FOOTNOTE_HOSTED_BUDGET_CENTS = "100";
});
afterEach(() => {
  __setStoreForTests(null);
  delete process.env.FOOTNOTE_HOSTED_BUDGET_CENTS;
});

describe("price math", () => {
  it("prices gpt-5.5 and unknown models at $15 in / $60 out per 1M", () => {
    expect(tokenCostCents("gpt-5.5", 1_000_000, 0)).toBe(1500);
    expect(tokenCostCents("gpt-5.5", 0, 1_000_000)).toBe(6000);
    expect(tokenCostCents("some-new-model", 10_000, 1_000)).toBeCloseTo(15 + 6, 6);
  });
  it("reserves at least the flat estimate, more for big prompts", () => {
    expect(chatReserveCents("ask", "gpt-5.5", 100, 100)).toBe(6);
    expect(chatReserveCents("enhance", "gpt-5.5", 100, 100)).toBe(15);
    // 40k chars counted as 20k tokens (15¢ each per 1k... = 30¢) + 3000 out (18¢)
    expect(chatReserveCents("enhance", "gpt-5.5", 40_000, 3000)).toBe(48);
  });
  it("bills audio by the larger of duration and byte size", () => {
    expect(audioMinutes(9, 1000)).toBeCloseTo(9 / 60);
    expect(audioMinutes(1, 4 * 1024 * 1024)).toBeGreaterThan(17);
    expect(transcribeReserveCents(0.15)).toBe(2);
    expect(transcribeReserveCents(2.5)).toBe(6);
  });
});

describe("reserve / settle / cap", () => {
  it("creates the document on first use and settles to actual cost", async () => {
    const m = memoryStore();
    const r = await reserve("enhance", 15, m.store);
    expect(r.ok).toBe(true);
    expect(m.doc!.spentCents).toBe(0);
    expect(Object.keys(m.doc!.reservations)).toHaveLength(1);
    await settle((r as { id: string }).id, 3.25, m.store);
    expect(m.doc!.spentCents).toBe(3.25);
    expect(m.doc!.reservations).toEqual({});
    expect(m.doc!.log.at(-1)).toMatchObject({ kind: "enhance", cents: 3.25 });
  });

  it("refuses once spent + reserved + estimate would cross the cap", async () => {
    const m = memoryStore({ spentCents: 80 });
    const a = await reserve("enhance", 15, m.store);
    expect(a.ok).toBe(true);
    const b = await reserve("ask", 6, m.store); // 80 + 15 + 6 = 101 > 100
    expect(b).toEqual({ ok: false, reason: "exhausted" });
    await release((a as { id: string }).id, m.store);
    expect((await reserve("ask", 6, m.store)).ok).toBe(true);
  });

  it("never lets concurrent reserves overshoot the cap", async () => {
    const m = memoryStore();
    const results = await Promise.all(Array.from({ length: 12 }, () => reserve("enhance", 15, m.store)));
    const ok = results.filter((r) => r.ok).length;
    const exhausted = results.filter((r) => !r.ok && r.reason === "exhausted").length;
    // 100 / 15 → at most 6 fit. Some may fail on contention (still refused, never over).
    expect(ok).toBeLessThanOrEqual(6);
    expect(ok + exhausted + results.filter((r) => !r.ok && r.reason === "unavailable").length).toBe(12);
    const reserved = Object.values(m.doc!.reservations).reduce((s, r) => s + r.cents, 0);
    expect(reserved).toBe(ok * 15);
    expect(reserved).toBeLessThanOrEqual(100);
    expect(m.conflicts).toBeGreaterThan(0);
  });

  it("fails closed when the store can't be read or written", async () => {
    const broken: BudgetStore = {
      read: async () => {
        throw new Error("blob down");
      },
      write: async () => {},
    };
    expect(await reserve("ask", 6, broken)).toEqual({ ok: false, reason: "unavailable" });
    const readOnly: BudgetStore = {
      read: async () => null,
      write: async () => {
        throw new Error("403");
      },
    };
    expect(await reserve("ask", 6, readOnly)).toEqual({ ok: false, reason: "unavailable" });
    expect(await snapshot(broken)).toBeNull();
    __setStoreForTests(broken);
    expect(await hostedBudgetAvailable()).toBe(false);
  });

  it("fails closed on a corrupt document", async () => {
    const corrupt: BudgetStore = {
      read: async () => ({ doc: { nope: true } as unknown as BudgetDoc, etag: "1" }),
      write: async () => {},
    };
    expect((await reserve("ask", 6, corrupt)).ok).toBe(false);
  });

  it("turns stale unsettled reservations into spend", async () => {
    const m = memoryStore({
      spentCents: 10,
      reservations: { old: { cents: 15, kind: "enhance", at: Date.now() - 11 * 60 * 1000 } },
    });
    await reserve("ask", 6, m.store);
    expect(m.doc!.spentCents).toBe(25);
    expect(m.doc!.reservations.old).toBeUndefined();
  });

  it("reports availability from the cap", async () => {
    const m = memoryStore({ spentCents: 99 });
    __setStoreForTests(m.store);
    expect(await hostedBudgetAvailable()).toBe(false);
    const s = await snapshot(m.store);
    expect(s).toMatchObject({ capCents: 100, spentCents: 99, remainingCents: 1 });
  });

  it("defaults the cap to 900 cents", async () => {
    delete process.env.FOOTNOTE_HOSTED_BUDGET_CENTS;
    const m = memoryStore({ spentCents: 890 });
    expect((await reserve("ask", 6, m.store)).ok).toBe(true);
    expect((await reserve("ask", 6, m.store)).ok).toBe(false);
  });
});

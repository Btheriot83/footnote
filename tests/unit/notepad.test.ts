import { describe, expect, it } from "vitest";
import { mergeTypedMarker } from "@/components/workspace/Notepad";

describe("mergeTypedMarker", () => {
  it("keeps one bullet when the user types their own marker", () => {
    expect(mergeTypedMarker("- - ", 4)).toEqual({ value: "- ", caret: 2 });
    expect(mergeTypedMarker("- budget is 50k\n- - ", 20)).toEqual({ value: "- budget is 50k\n- ", caret: 18 });
    expect(mergeTypedMarker("- 1. ", 5)).toEqual({ value: "1. ", caret: 3 });
  });
  it("leaves ordinary text alone", () => {
    expect(mergeTypedMarker("- budget - 50k ", 15)).toEqual({ value: "- budget - 50k ", caret: 15 });
    expect(mergeTypedMarker("- ", 2)).toEqual({ value: "- ", caret: 2 });
  });
});

import { isGenericTitle } from "@/lib/templates";

describe("isGenericTitle", () => {
  it("rejects titles that only restate the template", () => {
    expect(isGenericTitle("General Meeting Notes", "general")).toBe(true);
    expect(isGenericTitle("Sales call notes", "sales")).toBe(true);
    expect(isGenericTitle("1:1 Meeting", "one-on-one")).toBe(true);
  });
  it("keeps titles that say something", () => {
    expect(isGenericTitle("Acme renewal", "sales")).toBe(false);
    expect(isGenericTitle("Q3 budget planning", "general")).toBe(false);
  });
});

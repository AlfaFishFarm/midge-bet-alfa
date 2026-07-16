import { describe, it, expect } from "vitest";
import { checkFishBalance, FISH_BALANCE_TOLERANCE } from "@/lib/business-rules";

describe("checkFishBalance", () => {
  it("passes when exactly balanced", () => {
    const result = checkFishBalance({ incoming: 1000, outgoing: 900, mortality: 100 });
    expect(result.difference).toBe(0);
    expect(result.withinTolerance).toBe(true);
  });

  it("fails at exactly +100 (spec uses strict < not <=)", () => {
    const result = checkFishBalance({ incoming: 1100, outgoing: 900, mortality: 100 });
    expect(result.difference).toBe(100);
    expect(result.withinTolerance).toBe(false);
  });

  it("passes just inside tolerance (+99)", () => {
    const result = checkFishBalance({ incoming: 1099, outgoing: 900, mortality: 100 });
    expect(result.difference).toBe(99);
    expect(result.withinTolerance).toBe(true);
  });

  it("fails just outside tolerance (+101)", () => {
    const result = checkFishBalance({ incoming: 1101, outgoing: 900, mortality: 100 });
    expect(result.difference).toBe(101);
    expect(result.withinTolerance).toBe(false);
  });

  it("fails on the negative side beyond tolerance", () => {
    const result = checkFishBalance({ incoming: 700, outgoing: 900, mortality: 100 });
    expect(result.difference).toBe(-300);
    expect(result.withinTolerance).toBe(false);
  });

  it("tolerance constant matches the spec (100 fish)", () => {
    expect(FISH_BALANCE_TOLERANCE).toBe(100);
  });
});

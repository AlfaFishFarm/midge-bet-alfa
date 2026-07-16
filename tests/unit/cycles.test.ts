import { describe, it, expect } from "vitest";
import { isVirtualPondType, formatCycleLabel } from "@/lib/cycles";

describe("isVirtualPondType", () => {
  it("returns true for virtual intake pond", () => {
    expect(isVirtualPondType("בריכה וירטואלית לקליטה")).toBe(true);
  });

  it("returns true for virtual dispatch pond", () => {
    expect(isVirtualPondType("בריכה וירטואלית למשלוח")).toBe(true);
  });

  it("returns false for a regular pond", () => {
    expect(isVirtualPondType("בריכה רגילה")).toBe(false);
  });

  it("returns false for a large pond", () => {
    expect(isVirtualPondType("בריכה גדולה")).toBe(false);
  });

  it("returns false for a pit type", () => {
    expect(isVirtualPondType("בור")).toBe(false);
  });
});

describe("formatCycleLabel", () => {
  const date = new Date("2024-01-15T00:00:00.000Z");

  it("includes pond code when provided", () => {
    const label = formatCycleLabel("B-01", date);
    expect(label).toContain("B-01");
  });

  it("includes formatted date", () => {
    const label = formatCycleLabel("B-01", date);
    // toLocaleDateString("he-IL") formats differently per locale but includes the day
    expect(label).toMatch(/1[45]/); // either 14 or 15 depending on timezone
  });

  it("omits pond code prefix when code is null", () => {
    const label = formatCycleLabel(null, date);
    expect(label).not.toContain("null");
    expect(label).not.toContain(" ");
    // Just the date, no leading code
    expect(label.trim().length).toBeGreaterThan(0);
  });
});

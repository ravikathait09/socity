import { describe, it, expect } from "vitest";
import { currentPeriod } from "../src/lib/period.js";

describe("currentPeriod", () => {
  it("returns YYYY-MM", () => {
    expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});

import { describe, it, expect } from "vitest";
import {
  emi,
  loanSummary,
  dueDateForPeriod,
  computePenalty,
  billStatus,
  gstOn,
  arrearsInterest,
  previousPeriod,
  towerShares,
} from "../src/lib/finance.js";

describe("emi", () => {
  it("splits evenly at 0% interest", () => {
    expect(emi(1200, 0, 12)).toBe(100);
  });
  it("is higher than principal/tenure when interest applies", () => {
    expect(emi(1200, 12, 12)).toBeGreaterThan(100);
  });
});

describe("loanSummary", () => {
  it("computes outstanding from repaid", () => {
    const s = loanSummary({ principal: 1200, annualRate: 0, tenureMonths: 12, repaid: 300 });
    expect(s.totalPayable).toBe(1200);
    expect(s.outstanding).toBe(900);
  });
});

describe("dueDateForPeriod", () => {
  it("adds grace days after month end (UTC)", () => {
    expect(dueDateForPeriod("2026-05", 15).toISOString().slice(0, 10)).toBe("2026-06-15");
    expect(dueDateForPeriod("2026-05", 5).toISOString().slice(0, 10)).toBe("2026-06-05");
  });
});

describe("computePenalty", () => {
  it("applies a percentage above the minimum", () => {
    expect(computePenalty(10000, { pct: 2, min: 100 })).toBe(200);
  });
  it("falls back to the minimum for small dues", () => {
    expect(computePenalty(1000, { pct: 2, min: 100 })).toBe(100);
  });
  it("is zero when nothing is outstanding", () => {
    expect(computePenalty(0)).toBe(0);
  });
});

describe("billStatus", () => {
  const future = new Date("2030-01-01");
  const past = new Date("2020-01-01");
  it("paid when fully settled", () => {
    expect(billStatus({ total: 100, paid: 100 })).toBe("paid");
  });
  it("partial when some paid and not overdue", () => {
    expect(billStatus({ total: 100, paid: 40, dueDate: future })).toBe("partial");
  });
  it("overdue when past due and unpaid", () => {
    expect(billStatus({ total: 100, paid: 0, dueDate: past })).toBe("overdue");
  });
  it("pending when nothing paid and no due date passed", () => {
    expect(billStatus({ total: 100, paid: 0 })).toBe("pending");
  });
});

describe("gstOn", () => {
  it("computes the percentage", () => {
    expect(gstOn(10000, 18)).toBe(1800);
  });
  it("is zero for non-positive amounts", () => {
    expect(gstOn(0, 18)).toBe(0);
    expect(gstOn(-50, 18)).toBe(0);
  });
});

describe("arrearsInterest", () => {
  it("charges 1/12 of the annual rate per month", () => {
    // 12000 at 21% p.a. → 12000 * (21/12)/100 = 210
    expect(arrearsInterest(12000, 21)).toBe(210);
  });
  it("is zero when nothing is outstanding", () => {
    expect(arrearsInterest(0, 21)).toBe(0);
  });
});

describe("previousPeriod", () => {
  it("rolls back one month", () => {
    expect(previousPeriod("2026-05")).toBe("2026-04");
  });
  it("rolls back across a year boundary", () => {
    expect(previousPeriod("2026-01")).toBe("2025-12");
  });
});

describe("towerShares", () => {
  it("computes each tower's proportional share by flat count", () => {
    const units = [
      ...Array(40).fill({ blockCode: "A" }),
      ...Array(60).fill({ blockCode: "B" }),
    ];
    const shares = towerShares(units);
    const a = shares.find((s) => s.block === "A");
    const b = shares.find((s) => s.block === "B");
    expect(a.sharePct).toBe(40);
    expect(b.sharePct).toBe(60);
    expect(a.flats).toBe(40);
  });
});

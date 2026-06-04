// Loan math + bill dues/penalty helpers for Phase 2.

export function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Standard reducing-balance EMI.
//   P * r * (1+r)^n / ((1+r)^n - 1)   where r = monthly rate, n = tenure months
export function emi(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  const r = (annualRate || 0) / 12 / 100;
  if (r === 0) return round(principal / tenureMonths);
  const f = Math.pow(1 + r, tenureMonths);
  return round((principal * r * f) / (f - 1));
}

// Derive a loan's live figures from its stored fields + repayments.
export function loanSummary(loan) {
  const monthly = emi(loan.principal, loan.annualRate, loan.tenureMonths);
  const totalPayable = round(monthly * loan.tenureMonths);
  const outstanding = round(Math.max(0, totalPayable - (loan.repaid || 0)));
  return {
    emi: monthly,
    totalPayable,
    totalInterest: round(totalPayable - loan.principal),
    repaid: round(loan.repaid || 0),
    outstanding,
  };
}

// Due date for a billing period "YYYY-MM" = `graceDays` after the month end.
export function dueDateForPeriod(period, graceDays = 15) {
  const [y, m] = period.split("-").map(Number);
  // day 0 of the next month = last day of this month
  const end = new Date(Date.UTC(y, m, 0));
  end.setUTCDate(end.getUTCDate() + graceDays);
  return end;
}

// Late penalty for an overdue bill. Flat fee OR percentage of outstanding,
// whichever the society configures (here: 2% of outstanding, min ₹100).
export function computePenalty(outstanding, { pct = 2, min = 100 } = {}) {
  if (outstanding <= 0) return 0;
  return round(Math.max(min, (outstanding * pct) / 100));
}

// GST on a taxable amount at the given rate (%). Returns 0 when not applicable.
export function gstOn(amount, rate = 18) {
  if (!amount || amount <= 0) return 0;
  return round((amount * rate) / 100);
}

// Monthly interest on arrears (a prior unpaid balance carried into this period).
// annualPct is the bye-law rate (typically 21% p.a.); charged 1/12 per month.
export function arrearsInterest(prevOutstanding, annualPct = 21) {
  if (!prevOutstanding || prevOutstanding <= 0) return 0;
  return round((prevOutstanding * (annualPct / 12)) / 100);
}

// The previous billing period for "YYYY-MM".
export function previousPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m is 1-based; m-2 = previous month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Tower-share table: each tower's flat count and proportional % of all-tower
// expenses = towerFlats / totalFlats. Pure (testable) — units carry blockCode.
export function towerShares(units) {
  const total = units.length || 1;
  const byTower = new Map();
  for (const u of units) {
    const code = u.blockCode || "—";
    byTower.set(code, (byTower.get(code) || 0) + 1);
  }
  return [...byTower.entries()]
    .map(([block, flats]) => ({ block, flats, sharePct: round((flats / total) * 100) }))
    .sort((a, b) => a.block.localeCompare(b.block));
}

// Re-derive a bill's status from its numbers (+ today, for overdue).
export function billStatus(bill, now = new Date()) {
  const total = round(bill.total || 0);
  const paid = round(bill.paid || 0);
  if (paid >= total && total > 0) return "paid";
  if (paid > 0 && paid < total) {
    return bill.dueDate && now > new Date(bill.dueDate) ? "overdue" : "partial";
  }
  // nothing paid
  if (bill.dueDate && now > new Date(bill.dueDate)) return "overdue";
  return "pending";
}

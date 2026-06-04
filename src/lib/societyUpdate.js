// Build a validated Society update object from a request body. Shared by the
// per-society Settings screen (admin.settings) and platform tenant management
// (platform.onboard) so the normalization rules live in one place.
// NOTE: the `active` (suspend) flag is intentionally NOT handled here — only the
// platform route may toggle it.
export function buildSocietyUpdate(b) {
  const update = {};
  for (const k of ["name", "city", "address", "registrationNo", "ward", "blockMode", "blockGroups", "currency"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  if (b.fyStartMonth !== undefined) {
    const m = Number(b.fyStartMonth);
    if (m >= 1 && m <= 12) update.fyStartMonth = m;
  }
  if (b.settings) {
    const s = b.settings;
    const num = (v, d) => (v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v));
    update.settings = {
      penaltyPct: num(s.penaltyPct, 2),
      penaltyMin: num(s.penaltyMin, 100),
      graceDays: num(s.graceDays, 15),
      defaultElectricityRate: num(s.defaultElectricityRate, 9),
      defaultSplitRule: ["equal", "area", "block"].includes(s.defaultSplitRule) ? s.defaultSplitRule : "equal",
      serviceChargePerFlat: num(s.serviceChargePerFlat, 0),
      sinkingFundRatePerSqft: num(s.sinkingFundRatePerSqft, 0),
      repairFundRatePerSqft: num(s.repairFundRatePerSqft, 0),
      waterChargePerInlet: num(s.waterChargePerInlet, 0),
      arrearsInterestPct: num(s.arrearsInterestPct, 21),
      gstApplicable: !!s.gstApplicable,
      gstRate: num(s.gstRate, 18),
      gstThresholdPerFlat: num(s.gstThresholdPerFlat, 7500),
      approvalLevels: Math.min(3, Math.max(1, num(s.approvalLevels, 2))),
      reimbursementLimits: s.reimbursementLimits && typeof s.reimbursementLimits === "object" ? s.reimbursementLimits : {},
    };
  }
  return update;
}

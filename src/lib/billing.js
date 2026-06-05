import Unit from "@/models/Unit";
import Expense from "@/models/Expense";
import Bill from "@/models/Bill";
import Society from "@/models/Society";
import {
  dueDateForPeriod,
  billStatus,
  round,
  gstOn,
  arrearsInterest,
  previousPeriod,
} from "@/lib/finance";

// Core billing engine.
// For a given society + period, generate one bill per unit with these heads:
//   commonCharge  = pro-rated share of approved common expenses
//   serviceCharge = monthly maintenance charge (flat fee, per-sqft, or override)
//   sinkingFund   = carpet area * sinking-fund rate (MOFA, per sq.ft)
//   repairFund    = carpet area * repair-fund rate (MOFA, per sq.ft)
//   waterCharge   = water inlets * per-inlet rate (MOFA)
//   gst           = gstRate% on the taxable maintenance subtotal, when applicable
//   interest      = arrears interest on the prior period's unpaid balance
//
// Expense allocation (Module 3):
//   splitRule "equal" -> evenly across ALL society flats (≡ all-tower common,
//     since towerShare÷towerFlats collapses to ₹/total-flats)
//   "area"            -> by carpet area
//   "block"           -> only the named tower(s): blockCode or blockCodes[]
//
// scopeBlocks (optional): a tower-scoped user only writes their towers' bills,
// but every expense share is still computed over ALL units so amounts stay right.
// opts.force: when true, recompute UNPAID existing bills (e.g. to pick up a
// newly-approved expense). Bills with any payment are ALWAYS left untouched, and
// without force existing bills are never changed — so editing MOFA settings can
// never alter previously generated bills.
export async function generateBills(societyId, period, scopeBlocks = null, opts = {}) {
  const force = !!opts.force;
  const society = await Society.findById(societyId).lean();
  const cfg = society?.settings || {};
  const graceDays = cfg.graceDays ?? 15;

  const units = await Unit.find({ societyId }).lean();
  if (units.length === 0) {
    return { created: 0, message: "No units to bill." };
  }
  const scoped = Array.isArray(scopeBlocks) && scopeBlocks.length > 0;
  const billable = scoped ? units.filter((u) => scopeBlocks.includes(u.blockCode)) : units;

  const expenses = await Expense.find({
    societyId,
    period,
    status: "approved",
  }).lean();

  const totalArea =
    units.reduce((s, u) => s + (u.areaSqft || 0), 0) || units.length;

  // Pre-compute each expense's per-unit contribution.
  // commonByUnit: unitId -> { amount, items[] }
  const commonByUnit = new Map();
  const addCommon = (unitId, label, amount) => {
    const key = String(unitId);
    const e = commonByUnit.get(key) || { amount: 0, items: [] };
    e.amount += amount;
    e.items.push({ label, amount: round(amount) });
    commonByUnit.set(key, e);
  };

  for (const exp of expenses) {
    if (exp.splitRule === "block") {
      // one or several named towers bear this cost, split equally among their flats
      const codes = exp.blockCodes?.length ? exp.blockCodes : [exp.blockCode].filter(Boolean);
      const blockUnits = units.filter((u) => codes.includes(u.blockCode));
      if (blockUnits.length === 0) continue;
      const share = exp.amount / blockUnits.length;
      const tag = codes.join("+");
      for (const u of blockUnits)
        addCommon(u._id, `${exp.category || "Common"} (${tag})`, share);
    } else if (exp.splitRule === "area") {
      for (const u of units) {
        const share = exp.amount * ((u.areaSqft || 1) / totalArea);
        addCommon(u._id, `${exp.category || "Common"} (by area)`, share);
      }
    } else {
      // equal — all-tower common
      const share = exp.amount / units.length;
      for (const u of units)
        addCommon(u._id, `${exp.category || "Common"}`, share);
    }
  }

  // Prior-period bills (for arrears interest on carried-forward dues).
  const prev = previousPeriod(period);
  const prevBills = await Bill.find({ societyId, period: prev }).lean();
  const prevByUnit = new Map(prevBills.map((b) => [String(b.unitId), b]));

  let created = 0;
  let kept = 0; // existing bills left untouched
  let locked = 0; // settled bills never recomputed
  for (const u of billable) {
    // Freeze existing bills so changing settings can't alter past billing.
    const existing = await Bill.findOne({ societyId, unitId: u._id, period }).lean();
    if (existing) {
      if ((existing.paid || 0) > 0) { locked++; continue; } // settled → always frozen
      if (!force) { kept++; continue; } // unpaid but not forcing → leave as-is
    }

    const common = commonByUnit.get(String(u._id)) || { amount: 0, items: [] };
    const commonCharge = round(common.amount);

    // MOFA bye-law heads.
    // Monthly maintenance / service charge: per-unit override > per-sqft > flat fee.
    let serviceCharge;
    if (u.monthlyMaintenance != null && u.monthlyMaintenance > 0) {
      serviceCharge = round(u.monthlyMaintenance);
    } else if (cfg.maintenanceBasis === "sqft") {
      serviceCharge = round((u.areaSqft || 0) * (cfg.serviceChargePerSqft || 0));
    } else {
      serviceCharge = round(cfg.serviceChargePerFlat || 0);
    }
    const sinkingFund = round((u.areaSqft || 0) * (cfg.sinkingFundRatePerSqft || 0));
    const repairFund = round((u.areaSqft || 0) * (cfg.repairFundRatePerSqft || 0));
    const waterCharge = round((u.waterInlets || 1) * (cfg.waterChargePerInlet || 0));

    // Arrears interest on the prior period's unpaid balance.
    const prevBill = prevByUnit.get(String(u._id));
    const prevOutstanding = prevBill ? round((prevBill.total || 0) - (prevBill.paid || 0)) : 0;
    const interest = arrearsInterest(prevOutstanding, cfg.arrearsInterestPct ?? 21);

    // GST applies on the taxable maintenance subtotal when configured AND the
    // member's monthly maintenance crosses the per-flat threshold (₹7,500).
    const taxable = round(commonCharge + serviceCharge + waterCharge);
    const gst =
      cfg.gstApplicable && taxable > (cfg.gstThresholdPerFlat ?? 7500)
        ? gstOn(taxable, cfg.gstRate ?? 18)
        : 0;

    const lineItems = [];
    lineItems.push(...common.items);
    if (serviceCharge > 0) lineItems.push({ label: "Maintenance charge", amount: serviceCharge });
    if (sinkingFund > 0) lineItems.push({ label: "Sinking fund", amount: sinkingFund });
    if (repairFund > 0) lineItems.push({ label: "Repair fund", amount: repairFund });
    if (waterCharge > 0) lineItems.push({ label: "Water charges", amount: waterCharge });
    if (gst > 0) lineItems.push({ label: `GST @ ${cfg.gstRate ?? 18}%`, amount: gst });
    if (interest > 0) lineItems.push({ label: "Interest on arrears", amount: interest });

    const charges = round(
      commonCharge + serviceCharge + sinkingFund + repairFund + waterCharge + gst + interest
    );

    // Preserve any penalty already on the (unpaid) existing bill for this period.
    const penalty = existing?.penalty || 0;
    const paid = existing?.paid || 0;
    const dueDate = existing?.dueDate || dueDateForPeriod(period, graceDays);
    const grandTotal = round(charges + penalty);

    const bill = {
      societyId,
      unitId: u._id,
      unitNumber: u.number,
      blockCode: u.blockCode,
      period,
      powerUnits: 0,
      powerCharge: 0,
      commonCharge,
      serviceCharge,
      sinkingFund,
      repairFund,
      waterCharge,
      gst,
      interest,
      penalty,
      total: grandTotal,
      paid,
      dueDate,
      lineItems,
    };
    bill.status = billStatus(bill);

    await Bill.findOneAndUpdate({ societyId, unitId: u._id, period }, bill, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    created++;
  }

  return { created, kept, locked, expenses: expenses.length, units: billable.length };
}

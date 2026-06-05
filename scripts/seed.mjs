// Seed a demo tenant with roles, blocks, units, users, expenses and readings.
// Run with:  npm run seed   (loads .env.local automatically)
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Society from "../src/models/Society.js";
import Role from "../src/models/Role.js";
import User from "../src/models/User.js";
import Block from "../src/models/Block.js";
import Unit from "../src/models/Unit.js";
import Expense from "../src/models/Expense.js";
import Bill from "../src/models/Bill.js";
import Payment from "../src/models/Payment.js";
import LegalEntity from "../src/models/LegalEntity.js";
import Loan from "../src/models/Loan.js";
import Notice from "../src/models/Notice.js";
import Minutes from "../src/models/Minutes.js";
import DocumentModel from "../src/models/Document.js";
import AuditLog from "../src/models/AuditLog.js";
import Vendor from "../src/models/Vendor.js";
import MaintenanceRequest from "../src/models/MaintenanceRequest.js";
import ExpenseCategory from "../src/models/ExpenseCategory.js";
import WorkRequest from "../src/models/WorkRequest.js";
import Reimbursement from "../src/models/Reimbursement.js";
import Contract from "../src/models/Contract.js";
import Notification from "../src/models/Notification.js";
import { defaultRolePermissions } from "../src/lib/rbac.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/socity";
const PERIOD = "2026-05";
const PREV_PERIOD = "2026-04"; // already past due (today is 2026-05-31) → demo overdue/penalties

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to", MONGODB_URI);

  // Wipe demo data (idempotent reseed).
  const existing = await Society.findOne({ slug: "greenwood" });
  if (existing) {
    const sid = existing._id;
    await Promise.all([
      Role.deleteMany({ societyId: sid }),
      User.deleteMany({ societyId: sid }),
      Block.deleteMany({ societyId: sid }),
      Unit.deleteMany({ societyId: sid }),
      Expense.deleteMany({ societyId: sid }),
      Bill.deleteMany({ societyId: sid }),
      Payment.deleteMany({ societyId: sid }),
      LegalEntity.deleteMany({ societyId: sid }),
      Loan.deleteMany({ societyId: sid }),
      Notice.deleteMany({ societyId: sid }),
      Minutes.deleteMany({ societyId: sid }),
      DocumentModel.deleteMany({ societyId: sid }),
      AuditLog.deleteMany({ societyId: sid }),
      Vendor.deleteMany({ societyId: sid }),
      MaintenanceRequest.deleteMany({ societyId: sid }),
      ExpenseCategory.deleteMany({ societyId: sid }),
      WorkRequest.deleteMany({ societyId: sid }),
      Reimbursement.deleteMany({ societyId: sid }),
      Contract.deleteMany({ societyId: sid }),
      Notification.deleteMany({ societyId: sid }),
      Society.deleteOne({ _id: sid }),
    ]);
    await User.deleteMany({ email: "super@socity.test" });
    await Role.deleteMany({ platform: true });
    console.log("Cleared previous demo data.");
  }

  // 1) Society (tenant)
  const society = await Society.create({
    name: "Greenwood Residency",
    slug: "greenwood",
    city: "Pune",
    registrationNo: "PNA/HSG/(TC)/12345/2008",
    ward: "Aundh-Baner",
    fyStartMonth: 4,
    blockMode: "grouped",
    blockGroups: [
      { name: "A+B", blockCodes: ["A", "B"] },
      { name: "C+D", blockCodes: ["C", "D"] },
      { name: "E", blockCodes: ["E"] },
    ],
    settings: {
      penaltyPct: 2,
      penaltyMin: 100,
      graceDays: 15,
      defaultElectricityRate: 9,
      defaultSplitRule: "equal",
      serviceChargePerFlat: 500,
      sinkingFundRatePerSqft: 0.25,
      repairFundRatePerSqft: 0.75,
      waterChargePerInlet: 150,
      arrearsInterestPct: 21,
      gstApplicable: false,
      gstRate: 18,
      gstThresholdPerFlat: 7500,
      approvalLevels: 2,
      reimbursementLimits: { "Maintenance mgr": 10000, Accountant: 5000, Committee: 25000 },
    },
  });

  // 2) Roles — defaults transcribed from the permission matrix
  const defs = defaultRolePermissions();
  const roleByName = {};
  for (const [name, def] of Object.entries(defs)) {
    const platform = !!def.platform;
    const role = await Role.create({
      societyId: platform ? null : society._id,
      name,
      description: def.description,
      permissions: def.permissions,
      system: true,
      platform,
    });
    roleByName[name] = role;
  }
  console.log("Seeded roles:", Object.keys(roleByName).join(", "));

  // 3) Blocks  (A+B grouped, C+D grouped, E standalone)
  const blockDefs = [
    { code: "A", mode: "grouped", groupName: "A+B" },
    { code: "B", mode: "grouped", groupName: "A+B" },
    { code: "C", mode: "grouped", groupName: "C+D" },
    { code: "D", mode: "grouped", groupName: "C+D" },
    { code: "E", mode: "standalone", groupName: "E" },
  ];
  const blockByCode = {};
  for (const b of blockDefs) {
    blockByCode[b.code] = await Block.create({ societyId: society._id, ...b });
  }

  // 4) Units — 4 per block (20 total). Areas vary for area-based splits.
  const units = [];
  for (const code of ["A", "B", "C", "D", "E"]) {
    for (let i = 1; i <= 4; i++) {
      const number = `${code}-10${i}`;
      const u = await Unit.create({
        societyId: society._id,
        blockId: blockByCode[code]._id,
        blockCode: code,
        number,
        floor: i,
        areaSqft: 900 + i * 50,
        bhk: i <= 2 ? "2BHK" : "3BHK",
        waterInlets: i <= 2 ? 2 : 3,
        ownerName: `Owner ${number}`,
        ownerPhone: `90000000${code.charCodeAt(0)}${i}`,
        occupancy: i === 4 ? "tenant" : "owner",
        tenantName: i === 4 ? `Tenant ${number}` : undefined,
        meterNo: `MTR-${code}${i}`,
      });
      units.push(u);
    }
  }
  console.log("Seeded", units.length, "units across 5 blocks.");

  // 5) Users
  const passwordHash = await bcrypt.hash("password", 10);
  const a101 = units.find((u) => u.number === "A-101");
  const users = [
    { name: "Platform Admin", email: "super@socity.test", societyId: null, roles: ["Super admin"] },
    { name: "Asha Admin", email: "admin@greenwood.test", roles: ["Society admin"] },
    { name: "Tara Treasurer", email: "treasurer@greenwood.test", roles: ["Treasurer"] },
    { name: "Anil Accountant", email: "accountant@greenwood.test", roles: ["Accountant"] },
    { name: "Manish Maintenance", email: "maint@greenwood.test", roles: ["Maintenance mgr"] },
    { name: "Owner A-101", email: "owner@greenwood.test", roles: ["Owner"], unitId: a101._id },
    // tower-scoped manager: full operational roles, but only over Tower A
    { name: "Ravi (Tower A Mgr)", email: "towerA@greenwood.test", roles: ["Committee", "Treasurer", "Maintenance mgr"], scopeBlocks: ["A"] },
    // single-tower administrator: manages Tower A's units, expenses & users only
    { name: "Tina (Tower A Admin)", email: "towerA-admin@greenwood.test", roles: ["Tower Admin"], scopeBlocks: ["A"] },
  ];
  for (const u of users) {
    await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      societyId: u.societyId === null ? null : society._id,
      roleIds: u.roles.map((r) => roleByName[r]._id),
      unitId: u.unitId,
      scopeBlocks: u.scopeBlocks || [],
    });
  }
  console.log("Seeded users (password: 'password').");

  // 6) Expenses for both periods
  for (const period of [PREV_PERIOD, PERIOD]) {
    await Expense.create([
      { societyId: society._id, period, category: "Lift maintenance", amount: 24000, splitRule: "equal", status: "approved" },
      { societyId: society._id, period, category: "Security", amount: 60000, splitRule: "area", status: "approved" },
      { societyId: society._id, period, category: "Block A+B garden", amount: 8000, splitRule: "block", blockCode: "A", status: "pending" },
    ]);
  }

  console.log("Seeded expenses for", PREV_PERIOD, "and", PERIOD);

  // 8) Legal entities (block groups) + a sample loan
  const abEntity = await LegalEntity.create({
    societyId: society._id,
    name: "Greenwood A+B Block Association",
    kind: "block-group",
    blockCodes: ["A", "B"],
    description: "Combined legal entity for blocks A and B",
  });
  await LegalEntity.create({
    societyId: society._id,
    name: "Greenwood C+D Block Association",
    kind: "block-group",
    blockCodes: ["C", "D"],
  });
  await Loan.create({
    societyId: society._id,
    legalEntityId: abEntity._id,
    purpose: "Lift replacement (A+B)",
    lender: "HDFC Bank",
    principal: 1200000,
    annualRate: 11,
    tenureMonths: 36,
    startDate: new Date(Date.UTC(2026, 0, 1)),
    repaid: 120000,
  });
  console.log("Seeded 2 legal entities + 1 loan.");

  // 9) Notice board, meeting minutes, documents (Phase 3)
  const admin = await User.findOne({ email: "admin@greenwood.test" }).lean();
  await Notice.create([
    {
      societyId: society._id,
      title: "Water tank cleaning — 5 June",
      body: "Supply will be off 10am–2pm across all blocks. Please store water.",
      category: "urgent",
      pinned: true,
      postedById: admin._id,
      postedByName: admin.name,
    },
    {
      societyId: society._id,
      title: "Maintenance dues for May",
      body: "Bills for May are generated. Kindly clear dues before the 15th to avoid late fees.",
      category: "circular",
      postedById: admin._id,
      postedByName: admin.name,
    },
  ]);
  await Minutes.create({
    societyId: society._id,
    title: "Committee meeting — April 2026",
    meetingDate: new Date(Date.UTC(2026, 3, 12)),
    attendees: ["Asha Admin", "Tara Treasurer", "Cary Committee"],
    body: "1. Approved lift replacement loan for A+B.\n2. Security expense split by area.\n3. Garden upkeep for A+B pending vote.",
    postedById: admin._id,
    postedByName: admin.name,
  });
  await DocumentModel.create([
    { societyId: society._id, name: "Society bylaws.pdf", category: "bylaws", url: "https://example.com/bylaws.pdf", uploadedById: admin._id, uploadedByName: admin.name },
    { societyId: society._id, name: "AGM 2025 minutes.pdf", category: "agm", url: "https://example.com/agm-2025.pdf", uploadedById: admin._id, uploadedByName: admin.name },
  ]);
  console.log("Seeded notices, minutes & documents.");

  // 10) Vendors (full profiles) + a couple of maintenance requests
  const maintMgr = await User.findOne({ email: "maint@greenwood.test" }).lean();
  const [plumber, , lift] = await Vendor.create([
    { societyId: society._id, code: "VEN-001", name: "AquaFix Plumbing", trade: "plumbing", serviceCategory: "Plumbing", contactPerson: "Ramesh", phone: "9876500001", email: "aqua@fix.test", gstNumber: "27AAACA1111A1Z5", pan: "AAACA1111A", vendorType: "proprietorship", inChargeUserId: maintMgr?._id, inChargeName: maintMgr?.name, ratingSum: 9, ratingCount: 2, rating: 4.5, paidThisFY: 28000 },
    { societyId: society._id, code: "VEN-002", name: "Spark Electricals", trade: "electrical", serviceCategory: "Electrical", contactPerson: "Suresh", phone: "9876500002", vendorType: "individual", inChargeUserId: maintMgr?._id, inChargeName: maintMgr?.name, ratingSum: 8, ratingCount: 2, rating: 4 },
    { societyId: society._id, code: "VEN-003", name: "Otis Lifts", trade: "lift", serviceCategory: "Lift Maintenance", contactPerson: "Service desk", phone: "9876500003", gstNumber: "27AAACO2222B1Z1", pan: "AAACO2222B", vendorType: "pvt-ltd", inChargeUserId: maintMgr?._id, inChargeName: maintMgr?.name, ratingSum: 5, ratingCount: 1, rating: 5, paidThisFY: 48000 },
  ]);
  const owner = await User.findOne({ email: "owner@greenwood.test" }).lean();
  await MaintenanceRequest.create([
    {
      societyId: society._id,
      code: "WO-0001",
      title: "Leaking tap in kitchen",
      description: "Continuous drip from the kitchen sink tap.",
      category: "plumbing",
      priority: "medium",
      raisedById: owner?._id,
      raisedByName: owner?.name,
      unitId: owner?.unitId,
      unitNumber: "A-101",
      blockCode: "A",
      status: "assigned",
      assignedVendorId: plumber._id,
      assignedToName: plumber.name,
      assignedAt: new Date(Date.UTC(2026, 4, 20)),
    },
    {
      societyId: society._id,
      code: "WO-0002",
      title: "Corridor light not working (B block)",
      category: "electrical",
      priority: "high",
      raisedById: owner?._id,
      raisedByName: owner?.name,
      blockCode: "B",
      status: "open",
    },
  ]);
  console.log("Seeded 3 vendors + 2 maintenance requests.");

  // 11) Dynamic expense categories (Module 11)
  await ExpenseCategory.create([
    { societyId: society._id, name: "Lift Maintenance", code: "LIFT_MAINT", allocationType: "specific", budgetHead: "Repairs", approvalLevel: 2, sortOrder: 1 },
    { societyId: society._id, name: "Security", code: "SECURITY", allocationType: "all", budgetHead: "Services", approvalLevel: 2, sortOrder: 2 },
    { societyId: society._id, name: "Housekeeping Supplies", code: "HK_SUPPLY", allocationType: "all", budgetHead: "Services", approvalLevel: 1, sortOrder: 3, spendLimitPerMonth: 15000 },
    { societyId: society._id, name: "Festival Expenses", code: "FESTIVAL", allocationType: "all", budgetHead: "Events", approvalLevel: 2, sortOrder: 4 },
    { societyId: society._id, name: "Electricity", code: "ELECTRICITY", allocationType: "both", budgetHead: "Utilities", approvalLevel: 1, sortOrder: 5 },
  ]);

  // 12) Vendor contracts / AMC (Module 12)
  await Contract.create([
    { societyId: society._id, contractNo: "CTR-0001", vendorId: lift._id, vendorName: lift.name, serviceDescription: "Lift AMC — all towers", contractType: "annual-amc", startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2026, 11, 31)), value: 96000, paymentTerms: "quarterly", blockCodes: ["A", "B", "C", "D", "E"], slaTerms: "Lift fault resolved within 4 hours", inChargeUserId: maintMgr?._id, inChargeName: maintMgr?.name },
    { societyId: society._id, contractNo: "CTR-0002", vendorId: plumber._id, vendorName: plumber.name, serviceDescription: "Plumbing retainer", contractType: "monthly", startDate: new Date(Date.UTC(2026, 3, 1)), endDate: new Date(Date.UTC(2026, 5, 20)), value: 5000, paymentTerms: "monthly", inChargeUserId: maintMgr?._id, inChargeName: maintMgr?.name, renewalStatus: "up-for-renewal" },
  ]);

  // 13) Approval workflow requests (Module 4)
  await WorkRequest.create([
    { societyId: society._id, code: "REQ-0001", type: "material", title: "Replace lobby CCTV camera", estimatedCost: 12000, vendorName: "Spark Electricals", raisedById: maintMgr?._id, raisedByName: maintMgr?.name, levels: 2, status: "pending_l1", history: [{ actorId: maintMgr?._id, actorName: maintMgr?.name, action: "raised" }] },
    { societyId: society._id, code: "REQ-0002", type: "event", title: "Ganesh Utsav decoration budget", estimatedCost: 40000, raisedById: maintMgr?._id, raisedByName: maintMgr?.name, levels: 2, status: "pending_l2", financeRemark: "Within annual events budget", history: [{ actorId: maintMgr?._id, actorName: maintMgr?.name, action: "raised" }, { actorName: "Tara Treasurer", action: "l1_approved", note: "Within annual events budget" }] },
  ]);

  // 14) Reimbursement claims (Module 10)
  await Reimbursement.create([
    { societyId: society._id, code: "RMB-0001", requestedById: maintMgr?._id, requestedByName: maintMgr?.name, requesterRole: "Maintenance mgr", dateOfExpense: new Date(Date.UTC(2026, 4, 18)), category: "Plumbing supplies", description: "Bought PVC fittings for B-block leak", amount: 1800, vendorPayee: "Local hardware", paymentModeUsed: "upi", requesterBankUpi: "manish@upi", status: "submitted", receipt: { name: "receipt.txt", mimeType: "text/plain", size: 12, contentBase64: Buffer.from("demo receipt").toString("base64") } },
    { societyId: society._id, code: "RMB-0002", requestedById: maintMgr?._id, requestedByName: maintMgr?.name, requesterRole: "Maintenance mgr", dateOfExpense: new Date(Date.UTC(2026, 4, 10)), category: "Festival Expenses", description: "Advance for sound system", amount: 12000, overLimit: true, paymentModeUsed: "cash", status: "finance_approved", financeRemark: "OK, escalating (over ₹10k limit)", receipt: { name: "receipt.txt", mimeType: "text/plain", size: 12, contentBase64: Buffer.from("demo receipt").toString("base64") } },
  ]);
  console.log("Seeded expense categories, contracts, work requests & reimbursements.");

  console.log("\nDone. Sign in at /login with any *@greenwood.test (password: password).");
  console.log("Tip: generate bills for", PREV_PERIOD, "then 'Apply late fees' to demo penalties.");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

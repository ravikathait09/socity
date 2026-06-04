// Central RBAC catalog for the Society Management SaaS.
// Permissions are feature strings ("module.action"). Each society gets its own
// roles, but these defaults are seeded from the agreed permission matrix.
//
// Access levels per (role, permission):
//   FULL ("✓") -> the permission string itself is granted ("units.view")
//   VIEW ("V") -> the "view:"-prefixed variant is granted ("view:units.view")
//   NONE ("–") -> nothing granted

export const LEVEL = { FULL: "full", VIEW: "view", NONE: "none" };

// Permission catalog grouped by module — used to render the admin matrix.
export const PERMISSIONS = [
  {
    module: "Units & residents",
    key: "units",
    items: [
      { id: "units.view", label: "View unit directory" },
      { id: "units.edit", label: "Add / edit unit" },
      { id: "units.assign", label: "Assign owner / tenant" },
      { id: "units.view_own", label: "View own unit details" },
      { id: "units.block_config", label: "Block / group config" },
    ],
  },
  {
    module: "Power & expenses",
    key: "finance",
    items: [
      { id: "power.meter_readings", label: "Enter meter readings" },
      { id: "expenses.add", label: "Add common expense" },
      { id: "expenses.approve", label: "Approve expense" },
      { id: "expenses.split_rule", label: "Set expense split rule" },
      { id: "expenses.ledger", label: "View expense ledger" },
      { id: "expenses.submit", label: "Submit / upload a bill" },
    ],
  },
  {
    module: "Billing & payments",
    key: "finance",
    items: [
      { id: "billing.generate", label: "Generate monthly bills" },
      { id: "payments.record", label: "Record payment receipt" },
      { id: "billing.penalty", label: "Apply penalty / waiver" },
      { id: "billing.view_own", label: "View own bill" },
      { id: "payments.pay_online", label: "Pay online" },
    ],
  },
  {
    module: "Maintenance",
    key: "maintenance",
    items: [
      { id: "maintenance.raise", label: "Raise complaint / request" },
      { id: "maintenance.assign", label: "Assign & close work order" },
      { id: "maintenance.vendors", label: "Manage vendors" },
      { id: "maintenance.view_all", label: "View all requests" },
    ],
  },
  {
    module: "Reports & analytics",
    key: "reports",
    items: [
      { id: "reports.dashboard", label: "Society dashboard" },
      { id: "reports.block", label: "Block-wise report" },
      { id: "reports.export", label: "Export PDF / Excel" },
      { id: "reports.audit", label: "Audit log access" },
    ],
  },
  {
    module: "Administration",
    key: "admin",
    items: [
      { id: "admin.roles", label: "Manage roles & users" },
      { id: "admin.notice", label: "Post notice / circular" },
      { id: "admin.minutes", label: "Meeting minutes" },
      { id: "admin.documents", label: "Upload documents" },
      { id: "admin.settings", label: "Society settings" },
      { id: "platform.onboard", label: "Onboard new society" },
    ],
  },
  {
    module: "Legal entity & finance",
    key: "finance",
    items: [
      { id: "finance.legal", label: "Manage legal entity & loans" },
    ],
  },
  // ---- New modules (appended; keep order in sync with role level suffixes) ----
  {
    module: "Expense categories",
    key: "finance",
    items: [
      { id: "expenses.categories", label: "Manage expense category master" },
    ],
  },
  {
    module: "Approval workflow",
    key: "workflow",
    items: [
      { id: "requests.raise", label: "Raise work / purchase request" },
      { id: "requests.approve_l1", label: "Approve request — Level 1 (Finance)" },
      { id: "requests.approve_l2", label: "Approve request — Level 2 (Chairman)" },
      { id: "requests.view_all", label: "View all requests" },
    ],
  },
  {
    module: "Reimbursements",
    key: "workflow",
    items: [
      { id: "reimburse.raise", label: "Raise reimbursement claim" },
      { id: "reimburse.review", label: "Finance review reimbursement" },
      { id: "reimburse.approve", label: "Chairman approve reimbursement" },
      { id: "reimburse.pay", label: "Process reimbursement payout" },
      { id: "reimburse.view_all", label: "View all reimbursements" },
    ],
  },
  {
    module: "Vendor contracts",
    key: "maintenance",
    items: [
      { id: "vendors.contracts", label: "Manage vendor contracts / AMC" },
      { id: "vendors.rate", label: "Rate vendor performance" },
    ],
  },
  {
    module: "User management",
    key: "admin",
    items: [
      // Manage users (create/edit/deactivate). A tower-scoped holder is confined
      // to their own tower(s); a society-wide holder manages everyone.
      { id: "admin.users", label: "Manage users (tower-scoped if block-bound)" },
    ],
  },
];

// Flat list of every base permission id.
export const ALL_PERMISSION_IDS = PERMISSIONS.flatMap((m) =>
  m.items.map((i) => i.id)
);

// Default roles and their access level per permission, transcribed from the
// permission matrix. F = full, V = view-only, blank = no access.
// Order of permission ids matches ALL_PERMISSION_IDS.
const F = LEVEL.FULL;
const V = LEVEL.VIEW;
const _ = LEVEL.NONE;

// columns:                  uView uEdit uAsgn uOwn  uBlk | meter eAdd eApr eSplit eLdg eSubmit | bGen pRec pen bOwn payOnl | mRaise mAsgn mVend mView | rDash rBlock rExp rAudit | aRoles aNotice aMin aDoc aSet pOnboard | legal || expCat | reqRaise reqL1 reqL2 reqView | rbRaise rbReview rbApprove rbPay rbView | vContract vRate || aUsers
export const DEFAULT_ROLES = {
  "Super admin": {
    system: true,
    platform: true,
    description: "Platform-wide. Onboards societies, full access everywhere.",
    levels: [F,F,F,F,F, F,F,F,F,F,F, F,F,F,F,_, F,F,F,F, F,F,F,F, F,F,F,F,F,F, F, F, F,F,F,F, F,F,F,F,F, F,F, F],
  },
  "Society admin": {
    system: true,
    description: "Full access within the society. Manages roles, users & settings.",
    levels: [F,F,F,F,F, F,F,F,F,F,F, F,F,F,F,_, F,F,F,F, F,F,F,F, F,F,F,F,F,_, F, F, F,F,F,F, F,F,F,F,F, F,F, F],
  },
  Committee: {
    system: true,
    description: "Chairman/committee. Final approvals, notices, meeting minutes.",
    levels: [F,_,_,F,_, _,F,F,_,F,F, _,_,_,F,_, F,_,_,F, F,F,_,_, _,F,F,F,_,_, F, F, F,_,F,F, F,_,F,_,F, _,_, _],
  },
  "Tower Admin": {
    system: true,
    description: "Single-tower administrator. Manages their tower's units, expenses, complaints, notices and users (set the tower via the user's scope).",
    levels: [F,F,F,F,_, F,F,_,_,F,F, _,_,_,F,_, F,F,_,F, F,F,F,_, _,F,_,_,_,_, _, _, F,_,_,F, F,_,_,_,_, _,_, F],
  },
  Treasurer: {
    system: true,
    description: "Finance, billing, reports. Level-1 approver, processes payouts.",
    levels: [V,_,_,F,_, F,F,F,F,F,F, F,F,F,F,_, _,_,_,_, F,F,F,_, _,_,_,F,_,_, F, F, F,F,_,F, F,F,_,F,F, _,_, _],
  },
  Accountant: {
    system: true,
    description: "Enters meter readings, payments and vouchers.",
    levels: [V,_,_,_,_, F,F,_,_,V,F, _,F,_,_,_, _,_,_,_, _,V,_,_, _,_,_,_,_,_, V, _, F,_,_,V, F,_,_,_,V, _,_, _],
  },
  "Maintenance mgr": {
    system: true,
    description: "Work orders, vendors and contracts.",
    levels: [V,_,_,_,_, _,_,_,_,_,_, _,_,_,_,_, F,F,F,F, _,_,_,_, _,_,_,F,_,_, _, _, F,_,_,F, F,_,_,_,_, F,F, _],
  },
  Owner: {
    system: true,
    description: "Resident owner. Views own unit, own bill, pays online.",
    levels: [V,_,_,F,_, _,_,_,_,_,_, _,_,_,F,F, F,_,_,V, _,_,_,_, _,_,_,_,_,_, _, _, _,_,_,_, _,_,_,_,_, _,_, _],
  },
  Tenant: {
    system: true,
    description: "Resident tenant. Views own bill, pays online.",
    levels: [_,_,_,F,_, _,_,_,_,_,_, _,_,_,F,F, F,_,_,V, _,_,_,_, _,_,_,_,_,_, _, _, _,_,_,_, _,_,_,_,_, _,_, _],
  },
};

// View-only is encoded with a "view:" PREFIX rather than a ".view" suffix, so it
// can never collide with feature ids that already end in ".view" (e.g. units.view).
export const VIEW_PREFIX = "view:";

// Expand a role's level array into the concrete permission strings it grants.
// FULL grants "x.y"; VIEW grants "view:x.y".
export function expandLevels(levels) {
  const granted = [];
  ALL_PERMISSION_IDS.forEach((id, i) => {
    const lvl = levels[i];
    if (lvl === LEVEL.FULL) granted.push(id);
    else if (lvl === LEVEL.VIEW) granted.push(VIEW_PREFIX + id);
  });
  return granted;
}

// Build the default role -> permissions[] map for seeding.
export function defaultRolePermissions() {
  const out = {};
  for (const [name, def] of Object.entries(DEFAULT_ROLES)) {
    out[name] = {
      ...def,
      permissions: expandLevels(def.levels),
    };
  }
  return out;
}

// Does a user reach a feature? Routes pass a plain feature id (e.g. "units.view",
// "billing.generate"). Access is granted if the user holds it at FULL ("id") or
// VIEW ("view:id") level — both ✓ and V let you open the feature; finer breadth
// (own-unit vs all) is enforced in route code. Pass {full:true} to require FULL.
export function hasPermission(granted, feature, opts = {}) {
  if (!granted || granted.length === 0) return false;
  const set = granted instanceof Set ? granted : new Set(granted);
  if (set.has(feature)) return true;
  if (opts.full) return false;
  return set.has(VIEW_PREFIX + feature);
}

export function hasAny(granted, requiredList) {
  return requiredList.some((r) => hasPermission(granted, r));
}

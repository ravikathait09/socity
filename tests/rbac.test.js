import { describe, it, expect } from "vitest";
import {
  hasPermission,
  expandLevels,
  defaultRolePermissions,
  ALL_PERMISSION_IDS,
  DEFAULT_ROLES,
  VIEW_PREFIX,
} from "../src/lib/rbac.js";

describe("hasPermission", () => {
  it("matches a full grant exactly", () => {
    expect(hasPermission(["units.edit"], "units.edit")).toBe(true);
  });

  it("treats a view-only grant as feature access (view: prefix)", () => {
    expect(hasPermission([`${VIEW_PREFIX}units.view`], "units.view")).toBe(true);
  });

  it("does NOT collide on feature ids that end in .view", () => {
    // units.view is itself a feature; a view-only grant is "view:units.view"
    expect(hasPermission([`${VIEW_PREFIX}units.view`], "units.view")).toBe(true);
    expect(hasPermission(["units.view"], "units.view")).toBe(true);
  });

  it("opts.full requires a full grant (view-only is rejected)", () => {
    expect(hasPermission([`${VIEW_PREFIX}units.view`], "units.view", { full: true })).toBe(false);
    expect(hasPermission(["units.view"], "units.view", { full: true })).toBe(true);
  });

  it("denies missing permissions and empty sets", () => {
    expect(hasPermission(["units.view"], "units.edit")).toBe(false);
    expect(hasPermission([], "units.view")).toBe(false);
    expect(hasPermission(null, "units.view")).toBe(false);
  });
});

describe("expandLevels", () => {
  it("maps FULL -> id and VIEW -> view:id, skips NONE", () => {
    const levels = ALL_PERMISSION_IDS.map(() => "none");
    levels[0] = "full"; // units.view
    levels[1] = "view"; // units.edit
    const out = expandLevels(levels);
    expect(out).toContain(ALL_PERMISSION_IDS[0]);
    expect(out).toContain(`${VIEW_PREFIX}${ALL_PERMISSION_IDS[1]}`);
    expect(out).toHaveLength(2);
  });
});

describe("default role matrix", () => {
  it("every role's levels array aligns with the permission catalog", () => {
    for (const [, def] of Object.entries(DEFAULT_ROLES)) {
      expect(def.levels).toHaveLength(ALL_PERMISSION_IDS.length);
    }
  });

  it("seeds expected permissions per role", () => {
    const rp = defaultRolePermissions();
    expect(rp["Owner"].permissions).toContain("billing.view_own");
    expect(rp["Owner"].permissions).not.toContain("expenses.approve");
    expect(rp["Accountant"].permissions).toContain("expenses.submit");
    expect(rp["Committee"].permissions).toContain("maintenance.raise");
    expect(rp["Super admin"].permissions).toContain("platform.onboard");
    expect(rp["Society admin"].permissions).not.toContain("platform.onboard");
  });
});

import { NextResponse } from "next/server";
import { connectDB } from "./db";
import { getSession, clearSessionCookie } from "./auth";
import { hasPermission } from "./rbac";
import User from "@/models/User";

// Resolve the session for a route handler. Returns null if unauthenticated.
// Also enforces "instant" permission changes: the JWT carries a permVersion
// snapshot; if the user's current permVersion differs (role/permission change)
// or the account was disabled/removed, we clear the cookie and force re-login.
export async function requireSession() {
  await connectDB();
  const session = await getSession();
  if (!session) return null;
  if (session.uid) {
    const u = await User.findById(session.uid).select("permVersion active").lean();
    if (!u || !u.active || (u.permVersion || 1) !== (session.permVersion || 1)) {
      await clearSessionCookie();
      return null;
    }
  }
  return session;
}

// Guard a route handler. Usage:
//   const guard = await authorize("units.edit");
//   if (guard.error) return guard.error;
//   const { session } = guard;
export async function authorize(permission) {
  const session = await requireSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (permission && !hasPermission(session.permissions, permission)) {
    return {
      error: NextResponse.json(
        { error: `Forbidden — missing permission "${permission}"` },
        { status: 403 }
      ),
    };
  }
  return { session };
}

// Tenant scope filter — every tenant query MUST include this so data never
// crosses societies. Super admins (platform) may pass an explicit societyId.
export function tenantFilter(session, extra = {}) {
  return { societyId: session.societyId, ...extra };
}

// True when the user is restricted to specific towers/blocks (a tower manager).
// Empty scope = society owner/admin who sees everything.
export function isBlockScoped(session) {
  return Array.isArray(session.scopeBlocks) && session.scopeBlocks.length > 0;
}

// Tenant filter that also restricts block-bound collections to the user's towers.
// Use for resources carrying a `blockCode` (Unit, Bill, MeterReading,
// MaintenanceRequest, Payment). Owners/admins (no scope) are unaffected.
export function blockScopedFilter(session, extra = {}) {
  const f = { societyId: session.societyId, ...extra };
  if (isBlockScoped(session)) f.blockCode = { $in: session.scopeBlocks };
  return f;
}

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

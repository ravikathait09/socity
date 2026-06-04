import { requireSession, authorize, tenantFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission } from "@/lib/notify";
import Vendor from "@/models/Vendor";
import User from "@/models/User";

const PROFILE_FIELDS = [
  "name", "trade", "serviceCategory", "subTags", "contactPerson", "phone",
  "email", "address", "gstNumber", "pan", "bankAccount", "ifsc", "vendorType", "active",
];

// Update vendor profile / assign in-charge (maintenance.vendors).
export async function PATCH(req, { params }) {
  const guard = await authorize("maintenance.vendors");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const vendor = await Vendor.findOne(tenantFilter(session, { _id: id }));
  if (!vendor) return bad("Vendor not found", 404);

  for (const k of PROFILE_FIELDS) if (b[k] !== undefined) vendor[k] = b[k];
  if (b.inChargeUserId !== undefined) {
    if (b.inChargeUserId) {
      const u = await User.findOne(tenantFilter(session, { _id: b.inChargeUserId })).select("name").lean();
      if (!u) return bad("In-charge user not found", 404);
      vendor.inChargeUserId = u._id;
      vendor.inChargeName = u.name;
    } else {
      vendor.inChargeUserId = undefined;
      vendor.inChargeName = undefined;
    }
  }
  if (b.inChargePhone !== undefined) vendor.inChargePhone = b.inChargePhone;

  await vendor.save();
  return ok({ vendor });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("maintenance.vendors");
  if (guard.error) return guard.error;
  const { id } = await params;
  const vendor = await Vendor.findOneAndDelete(tenantFilter(guard.session, { _id: id }));
  if (!vendor) return bad("Vendor not found", 404);
  await audit(guard.session, "vendor.delete", `Removed vendor ${vendor.name}`, {
    entity: "Vendor",
    entityId: id,
  });
  return ok({ ok: true });
}

// Rate a vendor or blacklist it. Body: { rating: 1-5, comment } OR { blacklist: bool, reason }
// Rating needs vendors.rate; blacklisting is a committee/admin action (maintenance.vendors).
export async function POST(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const vendor = await Vendor.findOne(tenantFilter(session, { _id: id }));
  if (!vendor) return bad("Vendor not found", 404);

  if (b.rating !== undefined) {
    if (!hasPermission(session.permissions, "vendors.rate")) return bad("Forbidden", 403);
    const rating = Number(b.rating);
    if (!(rating >= 1 && rating <= 5)) return bad("rating must be 1–5");
    vendor.ratingSum += rating;
    vendor.ratingCount += 1;
    vendor.rating = Math.round((vendor.ratingSum / vendor.ratingCount) * 10) / 10;
    await vendor.save();
    await audit(session, "vendor.rate", `Rated ${vendor.name} ${rating}★ (avg ${vendor.rating})`, {
      entity: "Vendor",
      entityId: vendor._id,
    });
    // sustained poor performance → alert the chairman/committee
    if (vendor.rating < 2.5 && vendor.ratingCount >= 3)
      await notifyByPermission(session.societyId, "requests.approve_l2", {
        title: `Vendor ${vendor.name} rated below 2.5★`,
        body: `Average ${vendor.rating}★ over ${vendor.ratingCount} ratings — review recommended.`,
        kind: "vendor",
        link: "/vendors",
        entityId: vendor._id,
      });
    return ok({ vendor });
  }

  if (b.blacklist !== undefined) {
    if (!hasPermission(session.permissions, "maintenance.vendors")) return bad("Forbidden", 403);
    vendor.blacklisted = !!b.blacklist;
    vendor.blacklistReason = b.blacklist ? b.reason : undefined;
    if (b.blacklist) vendor.active = false;
    await vendor.save();
    await audit(session, "vendor.blacklist", `${b.blacklist ? "Blacklisted" : "Un-blacklisted"} ${vendor.name}${b.reason ? ` — ${b.reason}` : ""}`, {
      entity: "Vendor",
      entityId: vendor._id,
    });
    return ok({ vendor });
  }

  return bad("Provide rating or blacklist");
}

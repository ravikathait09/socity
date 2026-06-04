import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Vendor from "@/models/Vendor";
import User from "@/models/User";

const PROFILE_FIELDS = [
  "name", "trade", "serviceCategory", "subTags", "contactPerson", "phone",
  "email", "address", "gstNumber", "pan", "bankAccount", "ifsc", "vendorType",
];

// List vendors. ?mine=1 -> only vendors this user is in-charge of (My Vendors).
// Filters: ?category= &status=active|blacklisted &q=
export async function GET(req) {
  const guard = await authorize("maintenance.vendors");
  if (guard.error) return guard.error;
  const { session } = guard;
  const url = new URL(req.url);
  const filter = tenantFilter(session);
  if (url.searchParams.get("mine")) filter.inChargeUserId = session.uid;
  if (url.searchParams.get("category")) filter.serviceCategory = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  if (status === "active") filter.active = true;
  if (status === "blacklisted") filter.blacklisted = true;
  const q = url.searchParams.get("q");
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { contactPerson: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { subTags: new RegExp(q, "i") },
    ];
  }
  const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();
  return ok({ vendors });
}

export async function POST(req) {
  const guard = await authorize("maintenance.vendors");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("name is required");

  // resolve optional in-charge
  let inChargeName, inChargePhone;
  if (b.inChargeUserId) {
    const u = await User.findOne(tenantFilter(session, { _id: b.inChargeUserId })).select("name").lean();
    if (!u) return bad("In-charge user not found", 404);
    inChargeName = u.name;
  }

  const count = await Vendor.countDocuments(tenantFilter(session));
  const code = b.code || `VEN-${String(count + 1).padStart(3, "0")}`;

  try {
    const doc = { societyId: session.societyId, code, inChargeUserId: b.inChargeUserId || undefined, inChargeName, inChargePhone };
    for (const k of PROFILE_FIELDS) if (b[k] !== undefined) doc[k] = b[k];
    doc.trade = b.trade || "general";
    const vendor = await Vendor.create(doc);
    await audit(session, "vendor.create", `Added vendor ${vendor.name} (${vendor.serviceCategory || vendor.trade})`, {
      entity: "Vendor",
      entityId: vendor._id,
    });
    return ok({ vendor }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A vendor with that name exists" : e.message);
  }
}

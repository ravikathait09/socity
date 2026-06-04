import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Contract from "@/models/Contract";
import Vendor from "@/models/Vendor";
import User from "@/models/User";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

export async function GET(req) {
  const guard = await authorize("vendors.contracts");
  if (guard.error) return guard.error;
  const vendorId = new URL(req.url).searchParams.get("vendorId");
  const filter = tenantFilter(guard.session, vendorId ? { vendorId } : {});
  const contracts = await Contract.find(filter)
    .select("-document.contentBase64")
    .sort({ endDate: 1 })
    .lean();
  return ok({ contracts });
}

export async function POST(req) {
  const guard = await authorize("vendors.contracts");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.vendorId) return bad("vendorId is required");

  const vendor = await Vendor.findOne(tenantFilter(session, { _id: b.vendorId })).lean();
  if (!vendor) return bad("Vendor not found", 404);

  // mandatory society person in-charge
  let inChargeName;
  if (b.inChargeUserId) {
    const u = await User.findOne(tenantFilter(session, { _id: b.inChargeUserId })).select("name").lean();
    if (!u) return bad("In-charge user not found", 404);
    inChargeName = u.name;
  }

  let document;
  if (b.document?.contentBase64) {
    const size = Math.floor((b.document.contentBase64.length * 3) / 4);
    if (size > MAX_INLINE_BYTES) return bad("Document too large (max 1.5 MB)", 413);
    document = { name: b.document.name || "contract", mimeType: b.document.mimeType, size, contentBase64: b.document.contentBase64 };
  }

  const count = await Contract.countDocuments(tenantFilter(session));
  const contractNo = b.contractNo || `CTR-${String(count + 1).padStart(4, "0")}`;

  try {
    const contract = await Contract.create({
      societyId: session.societyId,
      contractNo,
      vendorId: vendor._id,
      vendorName: vendor.name,
      serviceDescription: b.serviceDescription,
      contractType: ["one-time", "monthly", "annual-amc", "per-visit"].includes(b.contractType) ? b.contractType : "annual-amc",
      startDate: b.startDate ? new Date(b.startDate) : undefined,
      endDate: b.endDate ? new Date(b.endDate) : undefined,
      value: Number(b.value) || 0,
      paymentTerms: ["monthly", "quarterly", "on-completion", "advance-balance"].includes(b.paymentTerms) ? b.paymentTerms : "monthly",
      blockCodes: Array.isArray(b.blockCodes) ? b.blockCodes : [],
      slaTerms: b.slaTerms,
      inChargeUserId: b.inChargeUserId || undefined,
      inChargeName,
      document,
    });
    await audit(session, "contract.create", `Added contract ${contractNo} for ${vendor.name}`, {
      entity: "Contract",
      entityId: contract._id,
    });
    const { document: _d, ...lite } = contract.toObject();
    return ok({ contract: { ...lite, hasDocument: !!document } }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A contract with that number exists" : e.message);
  }
}

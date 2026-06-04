import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Contract from "@/models/Contract";
import User from "@/models/User";

export async function PATCH(req, { params }) {
  const guard = await authorize("vendors.contracts");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const contract = await Contract.findOne(tenantFilter(session, { _id: id }));
  if (!contract) return bad("Contract not found", 404);

  for (const k of ["serviceDescription", "contractType", "value", "paymentTerms", "blockCodes", "slaTerms", "renewalStatus"]) {
    if (b[k] !== undefined) contract[k] = b[k];
  }
  if (b.startDate !== undefined) contract.startDate = b.startDate ? new Date(b.startDate) : undefined;
  if (b.endDate !== undefined) contract.endDate = b.endDate ? new Date(b.endDate) : undefined;
  if (b.inChargeUserId !== undefined) {
    if (b.inChargeUserId) {
      const u = await User.findOne(tenantFilter(session, { _id: b.inChargeUserId })).select("name").lean();
      if (!u) return bad("In-charge user not found", 404);
      contract.inChargeUserId = u._id;
      contract.inChargeName = u.name;
    } else {
      contract.inChargeUserId = undefined;
      contract.inChargeName = undefined;
    }
  }

  await contract.save();
  await audit(session, "contract.update", `Updated contract ${contract.contractNo}`, {
    entity: "Contract",
    entityId: contract._id,
  });
  const { document, ...lite } = contract.toObject();
  return ok({ contract: { ...lite, hasDocument: !!document?.contentBase64 } });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("vendors.contracts");
  if (guard.error) return guard.error;
  const { id } = await params;
  const contract = await Contract.findOneAndDelete(tenantFilter(guard.session, { _id: id }));
  if (!contract) return bad("Contract not found", 404);
  await audit(guard.session, "contract.delete", `Removed contract ${contract.contractNo}`, {
    entity: "Contract",
    entityId: id,
  });
  return ok({ ok: true });
}

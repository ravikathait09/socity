import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import LegalEntity from "@/models/LegalEntity";

export async function GET() {
  const guard = await authorize("finance.legal");
  if (guard.error) return guard.error;
  const entities = await LegalEntity.find(tenantFilter(guard.session))
    .sort({ name: 1 })
    .lean();
  return ok({ entities });
}

export async function POST(req) {
  const guard = await authorize("finance.legal");
  if (guard.error) return guard.error;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("name is required");
  try {
    const entity = await LegalEntity.create({
      societyId: guard.session.societyId,
      name: b.name,
      kind: b.kind || "block-group",
      blockCodes: Array.isArray(b.blockCodes)
        ? b.blockCodes
        : String(b.blockCodes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      pan: b.pan,
      bankAccount: b.bankAccount,
      description: b.description,
    });
    return ok({ entity }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "An entity with that name exists" : e.message);
  }
}

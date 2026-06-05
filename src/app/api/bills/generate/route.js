import { authorize, bad, ok } from "@/lib/api";
import { generateBills } from "@/lib/billing";
import { audit } from "@/lib/audit";

export async function POST(req) {
  const guard = await authorize("billing.generate");
  if (guard.error) return guard.error;
  const { period, force } = await req.json().catch(() => ({}));
  if (!period) return bad("period is required (e.g. 2026-05)");
  const scope = guard.session.scopeBlocks?.length ? guard.session.scopeBlocks : null;
  const result = await generateBills(guard.session.societyId, period, scope, { force: !!force });
  await audit(guard.session, "bill.generate", `Generated ${result.created} bills for ${period} (kept ${result.kept || 0}, locked ${result.locked || 0}${force ? ", forced" : ""})`, {
    entity: "Bill",
    meta: { period, force: !!force, ...result },
  });
  return ok({ result });
}

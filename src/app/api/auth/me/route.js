import { getSession } from "@/lib/auth";
import { ok, bad } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return bad("Unauthenticated", 401);
  return ok({ session });
}

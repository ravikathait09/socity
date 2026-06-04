import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ok, bad } from "@/lib/api";
import { generateCode, setOtp } from "@/lib/otpStore";

// Request a one-time login code by email (Module: Email/mobile OTP login).
// In production the code is delivered by email/SMS; in dev it is returned in the
// response (and logged) so the flow is testable without a mail provider.
export async function POST(req) {
  await connectDB();
  const { email } = await req.json().catch(() => ({}));
  if (!email) return bad("Email required");
  const key = email.toLowerCase();

  const user = await User.findOne({ email: key, active: true }).select("_id email name").lean();
  // Always respond ok (don't reveal whether the account exists).
  if (user) {
    const code = generateCode();
    setOtp(key, code);
    console.log(`[otp] login code for ${key}: ${code}`);
    // TODO: send via email/SMS gateway in production.
    if (process.env.NODE_ENV !== "production") return ok({ sent: true, devCode: code });
  }
  return ok({ sent: true });
}

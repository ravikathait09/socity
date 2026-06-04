import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ok, bad } from "@/lib/api";
import { verifyOtp } from "@/lib/otpStore";
import { issueSession } from "@/lib/session";

// Verify a login OTP and start a session.
export async function POST(req) {
  await connectDB();
  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code) return bad("Email and code required");
  const key = email.toLowerCase();

  const res = verifyOtp(key, code);
  if (res.error) return bad(res.error, 401);

  const user = await User.findOne({ email: key, active: true });
  if (!user) return bad("Account not found", 404);

  const profile = await issueSession(user);
  if (profile.suspended)
    return bad("This society is suspended. Please contact the platform administrator.", 403);
  return ok({ user: profile });
}

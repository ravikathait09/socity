import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { issueSession } from "@/lib/session";
import { ok, bad } from "@/lib/api";

// In-memory failed-login lockout: 5 failures per email per 15 min.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map(); // email -> { count, resetAt }

function lockState(email) {
  const now = Date.now();
  const f = fails.get(email);
  if (!f || now > f.resetAt) return { locked: false, count: 0 };
  return { locked: f.count >= MAX_FAILS, count: f.count };
}
function recordFail(email) {
  const now = Date.now();
  const f = fails.get(email);
  if (!f || now > f.resetAt) fails.set(email, { count: 1, resetAt: now + LOCK_MS });
  else f.count++;
}

export async function POST(req) {
  await connectDB();
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return bad("Email and password required");
  const key = email.toLowerCase();

  if (lockState(key).locked)
    return bad("Too many failed attempts — try again in a few minutes.", 429);

  const user = await User.findOne({ email: key, active: true });
  if (!user) {
    recordFail(key);
    return bad("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFail(key);
    return bad("Invalid credentials", 401);
  }
  fails.delete(key); // successful login clears the counter

  const profile = await issueSession(user);
  if (profile.suspended)
    return bad("This society is suspended. Please contact the platform administrator.", 403);
  return ok({ user: profile });
}

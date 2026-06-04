import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// In production a strong JWT_SECRET is mandatory — never fall back to a default.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-change-me"
);

const isProd = process.env.NODE_ENV === "production";
export const COOKIE_NAME = "socity_token";

// Sign a session token. The payload embeds societyId + permissions so tenant
// isolation and authorization can be checked without a DB round-trip.
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// Read the current session inside a Server Component / route handler.
export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(token) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd, // only sent over HTTPS in production
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

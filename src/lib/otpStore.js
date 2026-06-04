// In-memory OTP store (mirrors the login lockout map). For multi-instance
// production, back this with Redis or a TTL collection. OTPs expire in 5 min and
// allow up to 5 verify attempts.
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const store = new Map(); // email -> { code, expiresAt, attempts }

// 6-digit numeric code.
export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function setOtp(email, code) {
  store.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
}

// Returns { ok } or { error }.
export function verifyOtp(email, code) {
  const rec = store.get(email);
  if (!rec || Date.now() > rec.expiresAt) {
    store.delete(email);
    return { error: "Code expired — request a new one." };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    store.delete(email);
    return { error: "Too many attempts — request a new code." };
  }
  rec.attempts++;
  if (String(code) !== rec.code) return { error: "Invalid code." };
  store.delete(email);
  return { ok: true };
}

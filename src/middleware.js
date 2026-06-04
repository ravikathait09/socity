import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit } from "@/lib/rateLimit";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-only-change-me"
);

const PUBLIC = [
  "/login",
  "/api/auth/login",
  "/vendor-upload", // no-login vendor bill upload page
  "/api/public", // public (token-scoped) endpoints
];

// Throttle unauthenticated, abuse-prone endpoints by client IP.
function throttle(req, pathname) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let rule = null;
  if (pathname === "/api/auth/login") rule = { limit: 10, windowMs: 60_000 };
  else if (pathname.startsWith("/api/public")) rule = { limit: 20, windowMs: 60_000 };
  if (!rule) return null;
  const { ok, retryAfter } = rateLimit(`${pathname}:${ip}`, rule.limit, rule.windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests — slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

// Edge middleware: verifies the JWT (no DB) and gates the app + API.
// Tenant isolation itself is enforced in route handlers via tenantFilter().
export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // rate-limit public/abuse-prone endpoints before anything else
  const limited = throttle(req, pathname);
  if (limited) return limited;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("socity_token")?.value;
  let session = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      session = payload;
    } catch {
      session = null;
    }
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Page-level home routing per user type (API routes enforce their own perms).
  const isApi = pathname.startsWith("/api/");
  if (!isApi) {
    const isPlatformUser = !session.societyId;
    const onPlatform = pathname === "/platform" || pathname.startsWith("/platform/");
    if (isPlatformUser && !onPlatform) {
      // Super admins only see the tenant-management area — land on its dashboard.
      const url = req.nextUrl.clone();
      url.pathname = "/platform/dashboard";
      return NextResponse.redirect(url);
    }
    if (!isPlatformUser && onPlatform) {
      // Society users have no platform area — send them to their dashboard.
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // run on everything except next internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO = [
  ["admin@greenwood.test", "Society admin"],
  ["treasurer@greenwood.test", "Treasurer"],
  ["accountant@greenwood.test", "Accountant"],
  ["owner@greenwood.test", "Owner (A-101)"],
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("password"); // "password" | "otp"
  const [email, setEmail] = useState("admin@greenwood.test");
  const [password, setPassword] = useState("password");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function done(res, data) {
    setLoading(false);
    if (!res.ok) return setError(data.error || "Login failed");
    // "/" routes to the right home: society users → dashboard, platform → /platform.
    router.push("/");
    router.refresh();
  }

  async function submitPassword(e) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    done(res, await res.json());
  }

  async function requestOtp(e) {
    e.preventDefault();
    setLoading(true); setError(""); setDevCode("");
    const res = await fetch("/api/auth/request-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setError(d.error || "Failed");
    setOtpSent(true);
    if (d.devCode) { setDevCode(d.devCode); setOtp(d.devCode); }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otp }),
    });
    done(res, await res.json());
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">S</div>
          <h1 className="text-xl font-semibold">Socity</h1>
          <p className="text-sm text-slate-500">Society Management · multi-tenant SaaS</p>
        </div>

        <div className="mb-3 flex rounded-lg bg-slate-100 p-1 text-sm">
          <button className={`flex-1 rounded-md py-1 ${mode === "password" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`} onClick={() => { setMode("password"); setError(""); }}>Password</button>
          <button className={`flex-1 rounded-md py-1 ${mode === "otp" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`} onClick={() => { setMode("otp"); setError(""); }}>Email OTP</button>
        </div>

        {mode === "password" ? (
          <form onSubmit={submitPassword} className="card p-6">
            <label className="label">Email</label>
            <input className="input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="label">Password</label>
            <input type="password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
          </form>
        ) : (
          <form onSubmit={otpSent ? verifyOtp : requestOtp} className="card p-6">
            <label className="label">Email</label>
            <input className="input mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
            {otpSent && (
              <>
                <label className="label">One-time code</label>
                <input className="input mb-2" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" />
                {devCode && <p className="mb-2 text-xs text-slate-400">Dev code: <code>{devCode}</code></p>}
              </>
            )}
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Please wait…" : otpSent ? "Verify & sign in" : "Send code"}
            </button>
            {otpSent && <button type="button" className="btn-ghost mt-2 w-full text-xs" onClick={() => setOtpSent(false)}>Use a different email</button>}
          </form>
        )}

        <div className="mt-4 card p-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts (password: <code>password</code>)</p>
          <div className="space-y-1">
            {DEMO.map(([e, label]) => (
              <button key={e} onClick={() => setEmail(e)} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-50">
                <span className="font-mono text-slate-700">{e}</span>
                <span className="text-slate-400">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

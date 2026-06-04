// Billing period helpers. A period is "YYYY-MM".

// Current month as "YYYY-MM" (client + server safe).
export function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

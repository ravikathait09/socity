import { NextResponse } from "next/server";

// Escape a single CSV cell (RFC-4180).
function cell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// rows: array of objects; columns: [{ key, label }]
export function toCSV(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => cell(typeof c.value === "function" ? c.value(r) : r[c.key])).join(","))
    .join("\n");
  return header + "\n" + body + "\n";
}

// Build a downloadable CSV response (opens in Excel / Sheets).
export function csvResponse(csv, filename) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

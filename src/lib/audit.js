import AuditLog from "@/models/AuditLog";

// Record a mutating action. Best-effort: never throws into the caller, so a
// logging failure can't break the underlying operation.
export async function audit(session, action, summary, { entity, entityId, meta } = {}) {
  try {
    await AuditLog.create({
      societyId: session.societyId,
      actorId: session.uid,
      actorName: session.name,
      action,
      summary,
      entity,
      entityId: entityId != null ? String(entityId) : undefined,
      meta,
    });
  } catch (e) {
    console.error("audit log failed:", e.message);
  }
}

import Notification from "@/models/Notification";
import User from "@/models/User";
import Role from "@/models/Role";
import { hasPermission } from "@/lib/rbac";

// Notification fan-out. In-app notifications are persisted as Notification docs;
// email is mirrored best-effort (logged here — wire an SMTP/provider in prod).
// Like the audit helper, this never throws into the caller.

async function sendEmail(user, title, body) {
  // Stub: integrate SES/SendGrid/SMTP here. We log so the intent is observable.
  if (user?.email) {
    console.log(`[email] → ${user.email}: ${title}${body ? ` — ${body}` : ""}`);
  }
}

// Notify an explicit set of users (by id). payload: {title, body, kind, link, entityId}
export async function notifyUsers(societyId, userIds, payload = {}) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return;
    const users = await User.find({ _id: { $in: ids }, active: true }).select("email name").lean();
    const docs = users.map((u) => ({
      societyId,
      userId: u._id,
      title: payload.title,
      body: payload.body,
      kind: payload.kind,
      link: payload.link,
      entityId: payload.entityId != null ? String(payload.entityId) : undefined,
    }));
    if (docs.length) await Notification.insertMany(docs);
    await Promise.all(users.map((u) => sendEmail(u, payload.title, payload.body)));
  } catch (e) {
    console.error("notify failed:", e.message);
  }
}

// Notify every active user in the society whose roles grant `permission`.
// Use to alert approvers (e.g. notify Level-1 reviewers when a request is raised).
export async function notifyByPermission(societyId, permission, payload = {}) {
  try {
    const roles = await Role.find({
      $or: [{ societyId }, { platform: true }],
    }).select("permissions").lean();
    const okRoleIds = roles
      .filter((r) => hasPermission(r.permissions, permission))
      .map((r) => String(r._id));
    if (okRoleIds.length === 0) return;
    const users = await User.find({
      societyId,
      active: true,
      roleIds: { $in: okRoleIds },
    }).select("_id").lean();
    await notifyUsers(societyId, users.map((u) => u._id), payload);
  } catch (e) {
    console.error("notifyByPermission failed:", e.message);
  }
}

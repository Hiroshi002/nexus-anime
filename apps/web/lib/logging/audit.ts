import "server-only";

import { logger } from "./logger";

export type AuditEvent =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.register"
  | "auth.password_reset.request"
  | "auth.password_reset.complete"
  | "auth.oauth.link"
  | "auth.session.expired"
  | "user.profile.update"
  | "user.role.change"
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "billing.subscription.create"
  | "billing.subscription.cancel"
  | "billing.subscription.update"
  | "billing.payment.success"
  | "billing.payment.failure"
  | "admin.title.create"
  | "admin.title.update"
  | "admin.title.delete"
  | "admin.episode.publish"
  | "admin.shelf.update";

export interface AuditContext {
  actorId: string;
  actorRole: string;
  target?: string;
  outcome: "success" | "failure";
  requestId: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export function audit(event: AuditEvent, ctx: AuditContext): void {
  logger.info(`AUDIT: ${event}`, { type: "audit", event, ...ctx });
}

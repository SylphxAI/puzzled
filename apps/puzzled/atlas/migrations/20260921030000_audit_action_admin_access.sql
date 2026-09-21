-- TD-06: admin access attempts are recorded in audit_logs (previously Redis-only,
-- 30d TTL) so /admin/audit-logs can surface secret/session probes.
-- Additive and idempotent; the value is used only by new writes.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'admin_access';

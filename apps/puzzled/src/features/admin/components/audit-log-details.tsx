"use client";

import { useAuditLogDetails } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type AuditLogDetailsProps = {
	logId: string;
	onRefresh: () => void;
};

/**
 * Audit Log Details
 *
 * Expanded view for an audit log entry.
 * Shows metadata, IP address, user agent, and timestamps.
 *
 * Note: User info (actor/user) is displayed in the parent table.
 * This component focuses on technical details.
 */
export function AuditLogDetails({ logId }: AuditLogDetailsProps) {
	const t = useTranslations("admin.auditLogs");
	const locale = useLocale();
	const { data: log, isLoading } = useAuditLogDetails(logId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
			</div>
		);
	}

	if (!log) {
		return (
			<div className="p-8 text-center text-[var(--admin-text-muted)]">
				{t("details.notFound")}
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div>
				<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
					{t("details.title")}
				</h3>
				<p className="text-sm text-[var(--admin-text-secondary)]">
					{t("details.subtitle")}
				</p>
			</div>

			{/* Resource Info */}
			<div className="space-y-2">
				<h4 className="admin-data-label">{t("details.resource")}</h4>
				<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<div className="admin-data-label">
								{t("details.resourceType")}
							</div>
							<div className="admin-data-value">{log.resourceType}</div>
						</div>
						{log.resourceId && (
							<div>
								<div className="admin-data-label">
									{t("details.resourceId")}
								</div>
								<div className="admin-data-mono">{log.resourceId}</div>
							</div>
						)}
						{log.userId && (
							<div>
								<div className="admin-data-label">User ID</div>
								<div className="admin-data-mono text-xs">{log.userId}</div>
							</div>
						)}
						{log.actorId && (
							<div>
								<div className="admin-data-label">Actor ID</div>
								<div className="admin-data-mono text-xs">{log.actorId}</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Technical Details */}
			<div className="space-y-2">
				<h4 className="admin-data-label">{t("details.technical")}</h4>
				<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
					<div className="space-y-3">
						{log.ipAddress && (
							<div>
								<div className="admin-data-label">{t("details.ipAddress")}</div>
								<div className="admin-data-mono">{log.ipAddress}</div>
							</div>
						)}
						{log.userAgent && (
							<div>
								<div className="admin-data-label">{t("details.userAgent")}</div>
								<div className="admin-data-value text-xs break-all">
									{log.userAgent}
								</div>
							</div>
						)}
						<div>
							<div className="admin-data-label">{t("details.timestamp")}</div>
							<div className="admin-data-value">
								{new Date(log.createdAt).toLocaleString(locale)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Metadata */}
			{log.metadata && Object.keys(log.metadata).length > 0 && (
				<div className="space-y-2">
					<h4 className="admin-data-label">{t("details.metadata")}</h4>
					<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
						<pre className="overflow-x-auto text-xs text-[var(--admin-text-secondary)]">
							{JSON.stringify(log.metadata, null, 2)}
						</pre>
					</div>
				</div>
			)}
		</div>
	);
}

"use client";

import { RefreshCw, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export type AuditLogFiltersType = {
	action?: string;
	resourceType?: string;
	startDate?: string;
	endDate?: string;
	search?: string;
};

type AuditLogFiltersProps = {
	filters: AuditLogFiltersType;
	onFiltersChange: (filters: AuditLogFiltersType) => void;
	onRefresh: () => void;
};

// Actions that match the AuditAction type in schema
const ACTION_TYPES = [
	"create",
	"update",
	"delete",
	"game_complete",
	"streak_update",
	"achievement_unlock",
	"admin_action",
] as const;

// Resource types for app-specific audit logs
const RESOURCE_TYPES = [
	"game",
	"session",
	"feature_flag",
	"announcement",
	"dlq",
	"app_setting",
] as const;

export function AuditLogFilters({
	filters,
	onFiltersChange,
	onRefresh,
}: AuditLogFiltersProps) {
	const t = useTranslations("admin.auditLogs");
	const [localFilters, setLocalFilters] =
		useState<AuditLogFiltersType>(filters);

	const handleFilterChange = (
		key: keyof AuditLogFiltersType,
		value: string,
	) => {
		const newFilters = {
			...localFilters,
			[key]: value || undefined,
		};
		setLocalFilters(newFilters);
		onFiltersChange(newFilters);
	};

	const handleClearFilters = () => {
		const emptyFilters = {};
		setLocalFilters(emptyFilters);
		onFiltersChange(emptyFilters);
	};

	const hasActiveFilters =
		Object.values(localFilters).filter((v) => v !== undefined && v !== "")
			.length > 0;

	return (
		<div className="admin-filter-card space-y-4">
			{/* Search */}
			<div className="admin-search">
				<Search className="admin-search-icon h-4 w-4" aria-hidden="true" />
				<input
					type="search"
					placeholder={t("filters.searchPlaceholder")}
					aria-label={t("filters.searchPlaceholder")}
					value={localFilters.search || ""}
					onChange={(e) => handleFilterChange("search", e.target.value)}
					className="admin-input pl-10"
				/>
			</div>

			{/* Filter Row */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{/* Action Type */}
				<div>
					<label htmlFor="audit-filter-action" className="admin-label">
						{t("filters.action")}
					</label>
					<select
						id="audit-filter-action"
						value={localFilters.action || ""}
						onChange={(e) => handleFilterChange("action", e.target.value)}
						className="admin-select"
					>
						<option value="">{t("filters.allActions")}</option>
						{ACTION_TYPES.map((action) => (
							<option key={action} value={action}>
								{t(`actions.${action}`)}
							</option>
						))}
					</select>
				</div>

				{/* Resource Type */}
				<div>
					<label htmlFor="audit-filter-resource" className="admin-label">
						{t("filters.resourceType")}
					</label>
					<select
						id="audit-filter-resource"
						value={localFilters.resourceType || ""}
						onChange={(e) => handleFilterChange("resourceType", e.target.value)}
						className="admin-select"
					>
						<option value="">{t("filters.allResources")}</option>
						{RESOURCE_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
				</div>

				{/* Start Date */}
				<div>
					<label htmlFor="audit-filter-start" className="admin-label">
						{t("filters.startDate")}
					</label>
					<input
						id="audit-filter-start"
						type="date"
						value={localFilters.startDate || ""}
						onChange={(e) => handleFilterChange("startDate", e.target.value)}
						className="admin-input w-full"
					/>
				</div>

				{/* End Date */}
				<div>
					<label htmlFor="audit-filter-end" className="admin-label">
						{t("filters.endDate")}
					</label>
					<input
						id="audit-filter-end"
						type="date"
						value={localFilters.endDate || ""}
						onChange={(e) => handleFilterChange("endDate", e.target.value)}
						className="admin-input w-full"
					/>
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between border-t border-[var(--admin-border)] pt-4">
				<div>
					{hasActiveFilters && (
						<button
							type="button"
							className="admin-btn admin-btn-ghost"
							onClick={handleClearFilters}
						>
							<X className="h-4 w-4" aria-hidden="true" />
							{t("filters.clearFilters")}
						</button>
					)}
				</div>
				<button
					type="button"
					className="admin-btn admin-btn-ghost"
					onClick={onRefresh}
				>
					<RefreshCw className="h-4 w-4" aria-hidden="true" />
					{t("filters.refresh")}
				</button>
			</div>
		</div>
	);
}

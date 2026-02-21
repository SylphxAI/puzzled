"use client";

import { SettingsPageHeader } from "@/shared/components/layout";
import { SecuritySettings } from "@sylphx/sdk/react";
import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Security Settings Client Component
 *
 * Uses the SDK's SecuritySettings component for:
 * - Two-factor authentication setup
 * - Active sessions management
 * - Login history
 */
export function SecuritySettingsContent() {
	const t = useTranslations("settings");

	return (
		<div className="space-y-6">
			<SettingsPageHeader
				icon={Shield}
				gradientClasses="from-emerald-500/20 to-teal-500/20"
				iconColorClass="text-emerald-500"
				title={t("security.title")}
				description={t("security.description")}
			/>

			<div className="rounded-2xl border bg-card overflow-hidden p-6">
				<SecuritySettings />
			</div>
		</div>
	);
}

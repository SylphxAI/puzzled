"use client";

import { SettingsPageHeader } from "@/shared/components/layout";
import { UserProfile } from "@sylphx/sdk/react";
import { UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Profile Settings Client Component
 *
 * Uses the SDK's UserProfile component for profile management.
 * Includes avatar upload, name editing, and profile updates.
 */
export function ProfileSettingsContent() {
	const t = useTranslations("settings");

	return (
		<div className="space-y-6">
			<SettingsPageHeader
				icon={UserCircle}
				gradientClasses="from-rose-500/20 to-pink-500/20"
				iconColorClass="text-rose-500"
				title={t("profile.title")}
				description={t("profile.description")}
			/>

			<div className="rounded-2xl border bg-card overflow-hidden">
				<UserProfile sections={["profile"]} showCard={false} header={null} />
			</div>
		</div>
	);
}

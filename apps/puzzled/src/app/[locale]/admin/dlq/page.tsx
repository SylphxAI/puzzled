export const dynamic = "force-dynamic";

import { DLQDashboard } from "@/features/admin/components/dlq-dashboard";
import { PAGINATION } from "@/lib/config/validation";
import { getAllDLQItems, getDLQStats } from "@/lib/dlq";
import { getTranslations } from "next-intl/server";

export default async function AdminDLQPage() {
	const t = await getTranslations("admin.dlq");
	const [stats, items] = await Promise.all([
		getDLQStats(),
		getAllDLQItems({ limit: PAGINATION.ADMIN_DEFAULT_LIMIT }),
	]);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t("title")}</h1>
				<p className="admin-page-subtitle">{t("subtitle")}</p>
			</div>

			{/* DLQ Dashboard */}
			<DLQDashboard initialStats={stats} initialItems={items} />
		</div>
	);
}

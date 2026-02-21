/**
 * Experiments Admin Page
 *
 * Shows local A/B experiment definitions.
 * Experiments are managed via Sylphx Platform SDK's feature flags.
 */

import { EXPERIMENTS } from "@/features/analytics/lib/ab-testing";
import { FlaskConical, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ExperimentsPage() {
	const t = await getTranslations("admin.experiments");

	const experimentEntries = Object.entries(EXPERIMENTS);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t("title")}</h1>
					<p className="admin-page-subtitle">{t("subtitle")}</p>
				</div>
			</div>

			{/* Empty State */}
			{experimentEntries.length === 0 && (
				<div className="admin-card">
					<div className="flex flex-col items-center justify-center p-12 text-center">
						<div className="mb-4 rounded-full bg-purple-500/10 p-4">
							<FlaskConical className="h-8 w-8 text-purple-400" />
						</div>
						<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							{t("emptyState.title")}
						</h3>
						<p className="mt-2 max-w-md text-sm text-[var(--admin-text-secondary)]">
							{t("emptyState.description")}
						</p>
					</div>
				</div>
			)}

			{/* Experiments List */}
			{experimentEntries.length > 0 && (
				<div className="space-y-6">
					{experimentEntries.map(([key, experiment], index) => (
						<div
							key={key}
							className="admin-card admin-animate-in"
							style={{ animationDelay: `${index * 0.05}s` }}
						>
							<div className="p-6">
								{/* Experiment Header */}
								<div className="mb-6 flex items-start justify-between">
									<div className="flex items-start gap-3">
										<div className="mt-1 rounded-lg bg-purple-500/10 p-2">
											<FlaskConical className="h-5 w-5 text-purple-400" />
										</div>
										<div>
											<h3 className="font-semibold text-[var(--admin-text-primary)]">
												{experiment.key}
											</h3>
											<p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
												{experiment.description}
											</p>
											<div className="mt-2 flex items-center gap-4 text-sm text-[var(--admin-text-muted)]">
												<span className="inline-flex items-center gap-1">
													<span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
													Active
												</span>
												<span>{experiment.variants.length} variants</span>
											</div>
										</div>
									</div>
								</div>

								{/* Variants Table */}
								<div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
									<table className="admin-table">
										<thead>
											<tr>
												<th>{t("variant")}</th>
												<th className="text-right">Status</th>
											</tr>
										</thead>
										<tbody>
											{experiment.variants.map((variant) => (
												<tr key={variant}>
													<td>
														<div className="flex items-center gap-2">
															<code className="admin-code">{variant}</code>
															{variant === "control" && (
																<span className="admin-badge admin-badge-muted">
																	Control
																</span>
															)}
														</div>
													</td>
													<td className="text-right text-sm text-[var(--admin-text-secondary)]">
														Configured
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Help Text */}
			<div className="admin-section">
				<div className="admin-section-content">
					<h3 className="mb-2 font-semibold text-[var(--admin-text-primary)]">
						{t("howToUse.title")}
					</h3>
					<div className="space-y-2 text-sm text-[var(--admin-text-secondary)]">
						<p>{t("howToUse.step1")}</p>
						<p>{t("howToUse.step2")}</p>
						<p>{t("howToUse.step3")}</p>
					</div>
					<div className="mt-4 flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
						<Settings className="h-4 w-4" />
						<span>
							Manage experiments via{" "}
							<code className="admin-code">
								features/analytics/lib/ab-testing.ts
							</code>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

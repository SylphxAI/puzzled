"use client";

import { cn } from "@/lib/utils";
import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	BarChart3,
	Bell,
	CreditCard,
	FileText,
	FlaskConical,
	Gamepad2,
	LayoutDashboard,
	Settings,
	Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItemKey =
	| "dashboard"
	| "analytics"
	| "plansAndPricing"
	| "users"
	| "games"
	| "announcements"
	| "system"
	| "dlq"
	| "auditLogs"
	| "experiments"
	| "settings";

// NOTE: Feature flags now managed via Platform Console (Sylphx Platform)
const navItems: Array<{
	href: string;
	labelKey: NavItemKey;
	icon: typeof LayoutDashboard;
}> = [
	{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboard },
	{ href: "/admin/analytics", labelKey: "analytics", icon: BarChart3 },
	{ href: "/admin/plans", labelKey: "plansAndPricing", icon: CreditCard },
	{ href: "/admin/users", labelKey: "users", icon: Users },
	{ href: "/admin/games", labelKey: "games", icon: Gamepad2 },
	{ href: "/admin/announcements", labelKey: "announcements", icon: Bell },
	{ href: "/admin/system", labelKey: "system", icon: Activity },
	{ href: "/admin/dlq", labelKey: "dlq", icon: AlertTriangle },
	{ href: "/admin/audit-logs", labelKey: "auditLogs", icon: FileText },
	{ href: "/admin/experiments", labelKey: "experiments", icon: FlaskConical },
	{ href: "/admin/settings", labelKey: "settings", icon: Settings },
];

export function AdminSidebar() {
	const t = useTranslations("admin.sidebar");
	const tCommon = useTranslations("common");
	const pathname = usePathname();
	// Remove locale prefix for matching
	const path = pathname.replace(/^\/[a-z]{2}(-[A-Za-z]+)?/, "");

	return (
		<aside className="admin-sidebar sticky top-0 flex h-screen w-64 flex-col">
			{/* Header */}
			<div className="admin-sidebar-header flex h-16 items-center gap-3 px-5">
				<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-accent)] text-sm font-bold text-white">
					P
				</div>
				<div>
					<div className="font-semibold text-[var(--admin-text-primary)]">
						{tCommon("appName")}
					</div>
					<div className="text-xs text-[var(--admin-text-muted)]">
						{t("console")}
					</div>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 p-3" aria-label={t("navigation")}>
				{navItems.map((item) => {
					const isActive =
						path === item.href ||
						(item.href !== "/admin" && path.startsWith(item.href));
					return (
						<Link
							key={item.href}
							href={item.href}
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"admin-sidebar-nav-item relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
								isActive && "admin-sidebar-nav-item-active",
							)}
							style={
								isActive
									? {
											background: "var(--admin-accent-subtle)",
											color: "var(--admin-accent)",
										}
									: undefined
							}
						>
							<item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
							{t(item.labelKey)}
							{isActive && (
								<span
									className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r"
									style={{ background: "var(--admin-accent)" }}
								/>
							)}
						</Link>
					);
				})}
			</nav>

			{/* Footer */}
			<div className="border-t border-[var(--admin-border)] p-3">
				<Link
					href="/"
					className="admin-sidebar-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
				>
					<ArrowLeft className="h-[18px] w-[18px]" />
					{t("backToApp")}
				</Link>
			</div>
		</aside>
	);
}

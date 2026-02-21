"use client";

import { Link, usePathname } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { BarChart3, Home, Trophy, User } from "lucide-react";
import { useTranslations } from "next-intl";

const navItems = [
	{ href: "/", icon: Home, labelKey: "nav.home" },
	{ href: "/stats", icon: BarChart3, labelKey: "nav.stats" },
	{ href: "/leaderboard", icon: Trophy, labelKey: "nav.leaderboard" },
	{ href: "/profile", icon: User, labelKey: "nav.profile" },
] as const;

export function BottomNav() {
	const t = useTranslations();
	const pathname = usePathname();

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-bottom-nav border-t bg-background/95 pb-safe backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 md:hidden"
			aria-label={t("nav.main")}
		>
			<div className="mx-auto grid h-16 max-w-md grid-cols-4">
				{navItems.map(({ href, icon: Icon, labelKey }) => {
					const isActive =
						pathname === href || (href !== "/" && pathname.startsWith(href));

					return (
						<Link
							key={href}
							href={href}
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"relative flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all",
								isActive
									? "text-primary"
									: "text-muted-foreground hover:text-foreground active:text-foreground active:scale-95",
							)}
						>
							<Icon
								className={cn(
									"h-5 w-5 transition-transform",
									isActive && "text-primary scale-110",
								)}
								strokeWidth={isActive ? 2.5 : 2}
								aria-hidden="true"
							/>
							<span>{t(labelKey)}</span>
							{/* Active indicator dot */}
							{isActive && (
								<span
									className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
									aria-hidden="true"
								/>
							)}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}

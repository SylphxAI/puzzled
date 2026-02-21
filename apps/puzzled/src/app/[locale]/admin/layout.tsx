// Force dynamic rendering - admin pages should never be statically generated
export const dynamic = "force-dynamic";

import {
	AdminCommandPalette,
	AdminError,
	requireAdmin,
} from "@/features/admin";
import { AdminThemeToggle } from "@/features/admin/components/admin-theme-toggle";
import { AdminSidebar } from "@/features/admin/components/sidebar";
import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import "@/features/admin/admin.css";

// Prevent admin pages from being indexed
export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

type Props = {
	children: React.ReactNode;
};

/**
 * Admin access error page - shows why access was denied
 */
function AdminAccessDenied({ message }: { message: string }) {
	return (
		<div className="admin-theme flex min-h-screen items-center justify-center">
			<div className="admin-card mx-auto max-w-md p-8 text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-error)]/10">
					<ShieldOff className="h-8 w-8 text-[var(--admin-error)]" />
				</div>
				<h1 className="mb-2 text-xl font-semibold text-[var(--admin-text-primary)]">
					Admin Access Required
				</h1>
				<p className="mb-6 text-[var(--admin-text-secondary)]">{message}</p>
				<Link href="/" className="admin-btn admin-btn-primary">
					Go Home
				</Link>
			</div>
		</div>
	);
}

export default async function AdminLayout({ children }: Props) {
	try {
		await requireAdmin();
	} catch (error) {
		if (error instanceof AdminError) {
			switch (error.code) {
				case "NOT_LOGGED_IN":
					return redirect("/login?callbackUrl=/admin");
				case "NOT_ADMIN":
				case "FORBIDDEN":
					return <AdminAccessDenied message={error.message} />;
			}
		}

		return <AdminAccessDenied message="An unexpected error occurred." />;
	}

	return (
		<div className="admin-theme flex min-h-screen">
			<AdminSidebar />
			<main className="flex-1 overflow-auto bg-[var(--admin-bg-base)]">
				{/* Command Palette Header */}
				<div className="sticky top-0 z-header flex h-14 items-center justify-end gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-bg-base)]/80 px-8 backdrop-blur-sm">
					<AdminThemeToggle />
					<AdminCommandPalette />
				</div>
				<div className="mx-auto max-w-6xl p-8">{children}</div>
			</main>
		</div>
	);
}

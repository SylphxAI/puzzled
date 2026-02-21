"use client";

import { TopNav } from "@/shared/components/layout";
import { useSafeStreak, useSafeUser } from "@sylphx/sdk/react";

/**
 * Client component wrapper for TopNav that fetches streak data
 *
 * Uses SDK's useSafeStreak hook for Platform-managed streak tracking.
 * Gracefully handles when Sylphx Platform is not configured (SSR/prerendering).
 */
export function LayoutTopNav() {
	const { user } = useSafeUser();

	// Use SDK's useSafeStreak hook for Platform-managed streaks
	// Safe version won't throw during SSR/static generation
	// The streak is auto-discovered with these defaults if it doesn't exist
	const { current, isLoading, isConfigured } = useSafeStreak("daily-play", {
		defaults: {
			name: "Daily Play Streak",
			description: "Play at least one game daily to maintain your streak",
			frequency: "daily",
			gracePeriodHours: 12, // 12-hour grace period
		},
	});

	// Show streak only when user is authenticated, configured, and data is loaded
	const displayStreak = user && isConfigured && !isLoading ? current : 0;

	return <TopNav currentStreak={displayStreak} />;
}

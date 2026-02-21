"use client";

import { useSafeAnalytics } from "@sylphx/sdk/react";
import { useEffect, useState } from "react";
import { initWebVitals, setWebVitalsTracker } from "../lib/web-vitals";

/**
 * Web Vitals Reporter Component
 *
 * Initializes web vitals reporting and connects to SDK analytics.
 * Only runs in production with user consent.
 */
export function WebVitalsReporter() {
	const [isMounted, setIsMounted] = useState(false);

	// Only render on client side to avoid SSG/SSR issues
	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	return <WebVitalsReporterInner />;
}

/**
 * Inner component that uses SDK hooks
 * Only rendered client-side after mount
 */
function WebVitalsReporterInner() {
	const { track } = useSafeAnalytics();

	useEffect(() => {
		// Initialize web vitals listeners
		initWebVitals();

		// Connect to SDK analytics for reporting
		setWebVitalsTracker(track);
	}, [track]);

	return null;
}

"use client";

/**
 * Error Boundary for Admin Routes
 *
 * Catches errors in admin panel pages.
 * DOGFOODING: Uses SDK's useErrorTracking for error reporting.
 */

import { useErrorTracking } from "@sylphx/sdk/react";
import { Button } from "@sylphx/ui";
import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

interface ErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
	const { captureException } = useErrorTracking();
	const reported = useRef(false);

	useEffect(() => {
		if (reported.current) return;
		reported.current = true;

		captureException(error, {
			tags: { boundary: "admin" },
			extra: { digest: error.digest },
		});
	}, [error, captureException]);

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<div className="text-center max-w-md">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-5">
					<AlertTriangle className="h-7 w-7 text-destructive" />
				</div>

				<h1 className="text-xl font-bold mb-2">Admin Error</h1>
				<p className="text-muted-foreground text-sm mb-5">
					Something went wrong in the admin panel. Try refreshing or return to
					the dashboard.
				</p>

				{process.env.NODE_ENV === "development" && (
					<details className="mb-5 text-left bg-muted/50 rounded-lg p-3">
						<summary className="cursor-pointer text-xs font-medium">
							Error details
						</summary>
						<pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap text-destructive">
							{error.message}
							{error.stack && `\n\n${error.stack}`}
						</pre>
					</details>
				)}

				<div className="flex gap-2 justify-center">
					<Button variant="outline" size="sm" onClick={reset}>
						<RefreshCw className="h-4 w-4 mr-1.5" />
						Retry
					</Button>
					<Button size="sm" asChild>
						<a href="/admin">
							<LayoutDashboard className="h-4 w-4 mr-1.5" />
							Dashboard
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}

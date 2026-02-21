"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
			<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
				<WifiOff className="h-10 w-10 text-muted-foreground" />
			</div>
			<h1 className="mt-6 text-2xl font-bold">You're Offline</h1>
			<p className="mt-2 max-w-sm text-muted-foreground">
				It looks like you've lost your internet connection. Please check your
				connection and try again.
			</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-6 rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
			>
				Try Again
			</button>
		</div>
	);
}

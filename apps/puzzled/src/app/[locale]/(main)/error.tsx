"use client";

import { useErrorTracking } from "@sylphx/sdk/react";
import { Button } from "@sylphx/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

type Props = {
	error: Error & { digest?: string };
	reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
	const t = useTranslations("common");
	const { captureException, addBreadcrumb } = useErrorTracking();
	const reported = useRef(false);

	useEffect(() => {
		// Only report once
		if (reported.current) return;
		reported.current = true;

		// DOGFOODING: Report error to Sylphx Platform via SDK
		addBreadcrumb({
			category: "error-boundary",
			message: "Error caught in main layout",
			level: "error",
		});

		captureException(error, {
			tags: { errorBoundary: "main-layout" },
			extra: { digest: error.digest },
		});
	}, [error, captureException, addBreadcrumb]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
			<AlertTriangle className="h-12 w-12 text-wrong" />
			<h1 className="text-xl font-bold">{t("error")}</h1>
			<p className="text-muted-foreground">{t("errorDescription")}</p>
			<Button onClick={reset} variant="outline">
				<RefreshCw className="mr-2 h-4 w-4" />
				{t("retry")}
			</Button>
		</div>
	);
}

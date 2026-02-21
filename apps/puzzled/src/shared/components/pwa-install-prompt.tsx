"use client";

import { PWA_PROMPT_DISMISSED_KEY } from "@/lib/storage-keys";
import { cn } from "@/lib/utils";
import { Button } from "@sylphx/ui";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
	const t = useTranslations("pwa");
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [showPrompt, setShowPrompt] = useState(false);
	const [isIOS, setIsIOS] = useState(false);
	const [isStandalone, setIsStandalone] = useState(false);

	useEffect(() => {
		// Check if already installed
		const standalone = window.matchMedia("(display-mode: standalone)").matches;
		setIsStandalone(standalone);
		if (standalone) return;

		// Check if iOS
		const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
		setIsIOS(isIOSDevice);

		// Check if dismissed recently (within 7 days)
		const dismissedAt = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY);
		if (dismissedAt) {
			const dismissedDate = new Date(dismissedAt);
			const daysSinceDismissed =
				(Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
			if (daysSinceDismissed < 7) return;
		}

		// Listen for beforeinstallprompt event (Android/Desktop Chrome)
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			// Show prompt after a short delay (let user engage first)
			setTimeout(() => setShowPrompt(true), 3000);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		// For iOS, show instructions after delay
		if (isIOSDevice && !standalone) {
			setTimeout(() => setShowPrompt(true), 5000);
		}

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) return;

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			setShowPrompt(false);
		}
		setDeferredPrompt(null);
	};

	const handleDismiss = () => {
		setShowPrompt(false);
		localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, new Date().toISOString());
	};

	// Don't show if already installed or prompt not ready
	if (isStandalone || !showPrompt) return null;

	return (
		<div
			className={cn(
				"fixed bottom-20 left-4 right-4 z-toast animate-in fade-in slide-in-from-bottom-4 duration-300",
				"mx-auto max-w-md rounded-2xl border bg-card p-4 shadow-xl",
			)}
		>
			<button
				type="button"
				onClick={handleDismiss}
				className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Dismiss"
			>
				<X className="h-4 w-4" />
			</button>

			<div className="flex items-start gap-4">
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
					<Download className="h-6 w-6 text-primary" />
				</div>

				<div className="min-w-0 flex-1">
					<h3 className="font-semibold">{t("installTitle")}</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						{isIOS ? t("installInstructionsIOS") : t("installDescription")}
					</p>

					{!isIOS && deferredPrompt && (
						<Button onClick={handleInstall} size="sm" className="mt-3">
							{t("installButton")}
						</Button>
					)}

					{isIOS && (
						<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
							<span>{t("iosTap")}</span>
							<svg
								className="h-5 w-5"
								fill="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
							</svg>
							<span>{t("iosThen")}</span>
							<span className="font-medium">{t("iosAddHome")}</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

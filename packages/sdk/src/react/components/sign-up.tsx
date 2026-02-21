/**
 * SignUp Component
 *
 * Flexible sign-up component supporting redirect, embedded, and modal modes.
 */

"use client";

import { useEffect, useState } from "react";
import type { OAuthProviderId } from "../../types";
import { useSafeAuth, useSafeUser, useSdkReady } from "../hooks";
import {
	Modal,
	type OAuthProvider,
	SignUpForm,
	type ThemeVariables,
	defaultTheme,
} from "../ui";

// Re-export for convenience

export interface SignUpProps {
	/** URL to redirect to after successful sign up */
	afterSignUpUrl?: string;
	/** URL to redirect users to a waitlist page */
	waitlistUrl?: string;
	/**
	 * Display mode:
	 * - 'redirect': Navigate to platform signup page (default)
	 * - 'embedded': Show full sign-up form inline
	 * - 'modal': Show full sign-up form in a modal
	 */
	mode?: "redirect" | "embedded" | "modal";
	/**
	 * OAuth providers to show (SDK-level filtering)
	 * This further filters the providers enabled at platform and app level.
	 * - undefined/null = show all app-enabled providers
	 * - [] = hide OAuth section (email only)
	 * - ['google', 'github'] = only show these (if they're app-enabled)
	 */
	providers?: OAuthProviderId[] | null;
	/** Theme variables for embedded/modal mode */
	theme?: ThemeVariables;
	/** Custom appearance for redirect button */
	appearance?: {
		baseStyle?: React.CSSProperties;
		hoverStyle?: React.CSSProperties;
	};
	/** Custom class name */
	className?: string;
	/** Button content (for redirect mode) */
	children?: React.ReactNode;
	/** URL for sign in link (embedded/modal mode) */
	signInUrl?: string;
	/** Terms of Service URL */
	termsUrl?: string;
	/** Privacy Policy URL */
	privacyUrl?: string;
	/** Initial invite code */
	inviteCode?: string;
	/** Show invite code field */
	showInviteCode?: boolean;
	/** Require invite code */
	requireInviteCode?: boolean;
	/** Called on successful sign up */
	onSuccess?: () => void;
	/** Called on error */
	onError?: (error: string) => void;
	/** Show card wrapper (embedded mode, default: true) */
	showCard?: boolean;
}

/**
 * SignUp component with multiple display modes
 *
 * @example
 * ```tsx
 * // Redirect mode (default) - navigates to platform signup
 * <SignUp afterSignUpUrl="/onboarding" />
 *
 * // Embedded mode - shows full form inline
 * <SignUp mode="embedded" afterSignUpUrl="/onboarding" />
 *
 * // Modal mode - shows form in a modal (for buttons)
 * <SignUp mode="modal" afterSignUpUrl="/onboarding">
 *   Create Account
 * </SignUp>
 *
 * // With specific OAuth providers
 * <SignUp mode="embedded" providers={['google', 'github']} />
 *
 * // Email/password only
 * <SignUp mode="embedded" providers={[]} />
 *
 * // With invite code
 * <SignUp mode="embedded" showInviteCode requireInviteCode />
 *
 * // With waitlist (redirects instead of signup)
 * <SignUp mode="embedded" waitlistUrl="/waitlist" />
 * ```
 */
export function SignUp({
	afterSignUpUrl,
	waitlistUrl,
	mode = "redirect",
	providers,
	theme = defaultTheme,
	appearance,
	className,
	children,
	signInUrl = "/sign-in",
	termsUrl = "/terms",
	privacyUrl = "/privacy",
	inviteCode,
	showInviteCode = false,
	requireInviteCode = false,
	onSuccess,
	onError,
	showCard = true,
}: SignUpProps) {
	// SDK readiness check (SSOT for SSR safety and configuration)
	const { isReady, renderError } = useSdkReady({
		services: ["auth", "user"],
		componentType: "sign-up",
		theme,
	});

	const { signUp } = useSafeAuth();
	const { isSignedIn, isLoaded } = useSafeUser();
	const [modalOpen, setModalOpen] = useState(false);

	// SDK not ready - render error or null
	if (!isReady) {
		return renderError();
	}

	// Don't show if already signed in
	if (isLoaded && isSignedIn) {
		return null;
	}

	// Convert OAuthProviderId to OAuthProvider (compatible types)
	const oauthProviders = providers as OAuthProvider[] | undefined | null;

	// Redirect mode - show button that navigates to platform
	if (mode === "redirect") {
		const handleClick = () => {
			signUp({
				redirectUrl: afterSignUpUrl || window.location.href,
				providers,
			});
		};

		const defaultStyles: React.CSSProperties = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "0.5rem 1rem",
			fontSize: "0.875rem",
			fontWeight: 500,
			borderRadius: "0.375rem",
			border: "1px solid #e5e7eb",
			backgroundColor: "#fff",
			color: "#000",
			cursor: "pointer",
			transition: "background-color 0.2s",
			...appearance?.baseStyle,
		};

		return (
			<button
				onClick={handleClick}
				className={className}
				style={className ? undefined : defaultStyles}
				type="button"
			>
				{children || "Sign Up"}
			</button>
		);
	}

	// Embedded mode - show form inline
	if (mode === "embedded") {
		return (
			<SignUpForm
				theme={theme}
				providers={oauthProviders || []}
				afterSignUpUrl={afterSignUpUrl || "/dashboard"}
				signInUrl={signInUrl}
				termsUrl={termsUrl}
				privacyUrl={privacyUrl}
				inviteCode={inviteCode}
				showInviteCode={showInviteCode}
				requireInviteCode={requireInviteCode}
				waitlistUrl={waitlistUrl}
				onSuccess={onSuccess}
				onError={onError}
				showCard={showCard}
			/>
		);
	}

	// Modal mode - show button that opens modal
	if (mode === "modal") {
		const defaultStyles: React.CSSProperties = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "0.5rem 1rem",
			fontSize: "0.875rem",
			fontWeight: 500,
			borderRadius: "0.375rem",
			border: "1px solid #e5e7eb",
			backgroundColor: "#fff",
			color: "#000",
			cursor: "pointer",
			transition: "background-color 0.2s",
			...appearance?.baseStyle,
		};

		return (
			<>
				<button
					onClick={() => setModalOpen(true)}
					className={className}
					style={className ? undefined : defaultStyles}
					type="button"
				>
					{children || "Sign Up"}
				</button>
				<Modal
					open={modalOpen}
					onClose={() => setModalOpen(false)}
					theme={theme}
				>
					<SignUpForm
						theme={theme}
						providers={oauthProviders || []}
						afterSignUpUrl={afterSignUpUrl || "/dashboard"}
						signInUrl={signInUrl}
						termsUrl={termsUrl}
						privacyUrl={privacyUrl}
						inviteCode={inviteCode}
						showInviteCode={showInviteCode}
						requireInviteCode={requireInviteCode}
						waitlistUrl={waitlistUrl}
						onSuccess={() => {
							setModalOpen(false);
							onSuccess?.();
						}}
						onError={onError}
						showCard={false}
					/>
				</Modal>
			</>
		);
	}

	return null;
}

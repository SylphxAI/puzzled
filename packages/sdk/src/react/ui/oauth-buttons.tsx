/**
 * OAuth Provider Buttons
 *
 * Configurable OAuth login buttons for various providers.
 * Uses @sylphx/ui for icons (SSOT).
 */

import {
	OAUTH_PROVIDER_META,
	OAuthIcons,
	type OAuthProvider,
} from "@sylphx/ui";
import type * as React from "react";
import { useState } from "react";
import type { ThemeVariables } from "./styles";
import { baseStyles, defaultTheme, mergeStyles } from "./styles";

// Re-export for convenience
export type { OAuthProvider } from "@sylphx/ui";

export interface OAuthButtonProps {
	/** OAuth provider */
	provider: OAuthProvider;
	/** Called when button is clicked */
	onClick: (provider: OAuthProvider) => void;
	/** Whether the button is disabled */
	disabled?: boolean;
	/** Whether to show loading state */
	loading?: boolean;
	/** Theme variables */
	theme?: ThemeVariables;
	/** Button variant */
	variant?: "default" | "outline" | "icon-only";
	/** Full width button */
	fullWidth?: boolean;
}

// Provider styling (colors from OAUTH_PROVIDER_META)
const getProviderStyle = (provider: OAuthProvider) => {
	const meta = OAUTH_PROVIDER_META[provider];
	const isLight = provider === "google"; // Google has white bg
	return {
		name: meta.name,
		backgroundColor: isLight ? "#ffffff" : meta.color,
		color: isLight ? "#1f2937" : "#ffffff",
		hoverBackgroundColor: isLight ? "#f3f4f6" : meta.color,
	};
};

/**
 * Single OAuth provider button
 */
export function OAuthButton({
	provider,
	onClick,
	disabled = false,
	loading = false,
	theme = defaultTheme,
	variant = "default",
	fullWidth = true,
}: OAuthButtonProps) {
	const [isHovered, setIsHovered] = useState(false);
	const style = getProviderStyle(provider);
	const styles = baseStyles(theme);
	const IconComponent = OAuthIcons[provider];

	const isOutline = variant === "outline";
	const isIconOnly = variant === "icon-only";

	const buttonStyle: React.CSSProperties = mergeStyles(
		styles.button,
		{
			width: fullWidth ? "100%" : "auto",
			backgroundColor: isOutline ? "transparent" : style.backgroundColor,
			color: isOutline ? theme.colorForeground : style.color,
			border: isOutline
				? `1px solid ${theme.colorBorder}`
				: `1px solid ${style.backgroundColor}`,
			opacity: disabled || loading ? 0.6 : 1,
			cursor: disabled || loading ? "not-allowed" : "pointer",
			padding: isIconOnly ? "0.625rem" : "0.625rem 1rem",
			minHeight: "2.5rem",
		},
		isHovered && !disabled && !loading
			? {
					backgroundColor: isOutline
						? theme.colorMuted
						: style.hoverBackgroundColor,
					borderColor: isOutline
						? theme.colorBorder
						: style.hoverBackgroundColor,
					filter: isOutline ? "none" : "brightness(0.9)",
				}
			: {},
	);

	return (
		<button
			type="button"
			onClick={() => !disabled && !loading && onClick(provider)}
			disabled={disabled || loading}
			style={buttonStyle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			aria-label={isIconOnly ? `Continue with ${style.name}` : undefined}
			aria-busy={loading}
		>
			{loading ? (
				<Spinner aria-label={`Loading ${style.name}`} />
			) : (
				<>
					<span
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "1.25rem",
							height: "1.25rem",
						}}
						aria-hidden="true"
					>
						<IconComponent width={20} height={20} />
					</span>
					{!isIconOnly && <span>Continue with {style.name}</span>}
				</>
			)}
		</button>
	);
}

export interface OAuthButtonsProps {
	/** List of providers to show */
	providers: OAuthProvider[];
	/** Called when a provider button is clicked */
	onProviderClick: (provider: OAuthProvider) => void;
	/** Provider currently being processed */
	loadingProvider?: OAuthProvider | null;
	/** Whether all buttons are disabled */
	disabled?: boolean;
	/** Theme variables */
	theme?: ThemeVariables;
	/** Button variant */
	variant?: "default" | "outline" | "icon-only";
	/** Layout direction */
	layout?: "vertical" | "horizontal";
}

/**
 * Group of OAuth provider buttons
 */
export function OAuthButtons({
	providers,
	onProviderClick,
	loadingProvider,
	disabled = false,
	theme = defaultTheme,
	variant = "default",
	layout = "vertical",
}: OAuthButtonsProps) {
	if (providers.length === 0) return null;

	const containerStyle: React.CSSProperties = {
		display: "flex",
		flexDirection: layout === "horizontal" ? "row" : "column",
		gap: layout === "horizontal" ? "0.5rem" : "0.75rem",
	};

	return (
		<div style={containerStyle}>
			{providers.map((provider) => (
				<OAuthButton
					key={provider}
					provider={provider}
					onClick={onProviderClick}
					disabled={
						disabled ||
						(loadingProvider != null && loadingProvider !== provider)
					}
					loading={loadingProvider === provider}
					theme={theme}
					variant={variant}
					fullWidth={layout === "vertical"}
				/>
			))}
		</div>
	);
}

/**
 * Divider with "or" text
 */
export function OrDivider({
	theme = defaultTheme,
}: { theme?: ThemeVariables }) {
	const styles = baseStyles(theme);

	return (
		<div style={styles.divider}>
			<div style={styles.dividerLine} />
			<span style={styles.dividerText}>or</span>
			<div style={styles.dividerLine} />
		</div>
	);
}

// Loading spinner
function Spinner({ "aria-label": ariaLabel }: { "aria-label"?: string }) {
	return (
		<svg
			style={{
				width: "1.25rem",
				height: "1.25rem",
				animation: "sylphx-spin 0.75s linear infinite",
			}}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			role="img"
			aria-label={ariaLabel || "Loading"}
		>
			<circle cx="12" cy="12" r="10" opacity="0.25" />
			<path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
		</svg>
	);
}

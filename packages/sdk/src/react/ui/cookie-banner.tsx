/**
 * Cookie Banner Component
 *
 * GDPR/CCPA compliant cookie consent banner.
 * Appears at bottom or top of page, with Accept All / Customize options.
 */

"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { Z_INDEX_OVERLAY } from "../../constants";
import { useConsent } from "../consent-hooks";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

export interface CookieBannerProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Position of the banner */
	position?: "bottom" | "top" | "bottom-left" | "bottom-right";
	/** Banner title */
	title?: string;
	/** Banner description */
	description?: string;
	/** Accept all button text */
	acceptAllText?: string;
	/** Decline optional button text */
	declineText?: string;
	/** Customize button text */
	customizeText?: string;
	/** Privacy policy link */
	privacyPolicyUrl?: string;
	/** Privacy policy link text */
	privacyPolicyText?: string;
	/** Called when preferences are saved */
	onSave?: () => void;
	/** Custom class name */
	className?: string;
	/** Show the banner even if user has consented (for testing) */
	forceShow?: boolean;
	/** Variant style */
	variant?: "bar" | "popup" | "modal";
}

/**
 * Cookie consent banner
 *
 * @example
 * ```tsx
 * // Basic usage - auto shows when needed
 * <CookieBanner />
 *
 * // With custom text
 * <CookieBanner
 *   title="We value your privacy"
 *   description="We use cookies to improve your experience."
 *   privacyPolicyUrl="/privacy"
 * />
 *
 * // Popup variant in corner
 * <CookieBanner variant="popup" position="bottom-right" />
 * ```
 */
export function CookieBanner({
	theme = defaultTheme,
	position = "bottom",
	title = "Cookie Preferences",
	description = 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.',
	acceptAllText = "Accept All",
	declineText = "Decline Optional",
	customizeText = "Customize",
	privacyPolicyUrl,
	privacyPolicyText = "Privacy Policy",
	onSave,
	className,
	forceShow = false,
	variant = "bar",
}: CookieBannerProps) {
	const {
		showBanner,
		types,
		consents,
		acceptAll,
		declineOptional,
		setConsent,
		saveConsents,
		closeBanner,
		isLoading,
	} = useConsent();

	const [showCustomize, setShowCustomize] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const styles = baseStyles(theme);

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles();
	}, []);

	// Animate in
	useEffect(() => {
		if (showBanner || forceShow) {
			const timer = setTimeout(() => setIsVisible(true), 50);
			return () => clearTimeout(timer);
		} else {
			setIsVisible(false);
		}
	}, [showBanner, forceShow]);

	// Handle accept all
	const handleAcceptAll = async () => {
		await acceptAll();
		onSave?.();
	};

	// Handle decline optional
	const handleDeclineOptional = async () => {
		await declineOptional();
		onSave?.();
	};

	// Handle save preferences
	const handleSavePreferences = async () => {
		await saveConsents();
		setShowCustomize(false);
		onSave?.();
	};

	if (!showBanner && !forceShow) {
		return null;
	}

	// Position styles
	const positionStyles: Record<string, CSSProperties> = {
		bottom: {
			position: "fixed",
			bottom: 0,
			left: 0,
			right: 0,
			zIndex: Z_INDEX_OVERLAY,
		},
		top: {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			zIndex: Z_INDEX_OVERLAY,
		},
		"bottom-left": {
			position: "fixed",
			bottom: "1rem",
			left: "1rem",
			zIndex: Z_INDEX_OVERLAY,
			maxWidth: "400px",
		},
		"bottom-right": {
			position: "fixed",
			bottom: "1rem",
			right: "1rem",
			zIndex: Z_INDEX_OVERLAY,
			maxWidth: "400px",
		},
	};

	const containerStyle: CSSProperties = mergeStyles(
		{
			fontFamily: theme.fontFamily,
			backgroundColor: theme.colorBackground,
			borderTop:
				position === "bottom" || position === "top"
					? `1px solid ${theme.colorBorder}`
					: "none",
			boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)",
			transform: isVisible
				? "translateY(0)"
				: position.includes("top")
					? "translateY(-100%)"
					: "translateY(100%)",
			opacity: isVisible ? 1 : 0,
			transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
		},
		positionStyles[position],
		variant === "popup"
			? {
					borderRadius: theme.borderRadiusLg,
					border: `1px solid ${theme.colorBorder}`,
					boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
				}
			: {},
	);

	const contentStyle: CSSProperties = {
		padding: variant === "bar" ? "1rem 1.5rem" : "1.5rem",
		maxWidth: variant === "bar" ? "1200px" : "none",
		margin: variant === "bar" ? "0 auto" : 0,
	};

	// Optional categories (non-required)
	const optionalTypes = types.filter((t) => !t.required);

	return (
		<div
			style={containerStyle}
			className={className}
			role="dialog"
			aria-label="Cookie consent"
		>
			<div style={contentStyle}>
				{!showCustomize ? (
					// Main banner view
					<div
						style={
							variant === "bar"
								? mergeStyles(styles.flexBetween, {
										gap: "2rem",
										flexWrap: "wrap",
									})
								: {}
						}
					>
						<div style={{ flex: 1, minWidth: "200px" }}>
							<h3
								style={{
									margin: 0,
									fontSize: theme.fontSizeLg,
									fontWeight: 600,
									marginBottom: "0.5rem",
								}}
							>
								{title}
							</h3>
							<p
								style={mergeStyles(styles.textSm, styles.textMuted, {
									margin: 0,
									lineHeight: 1.6,
								})}
							>
								{description}
								{privacyPolicyUrl && (
									<>
										{" "}
										<a
											href={privacyPolicyUrl}
											style={styles.link}
											target="_blank"
											rel="noopener noreferrer"
										>
											{privacyPolicyText}
										</a>
									</>
								)}
							</p>
						</div>

						<div
							style={mergeStyles(styles.flexRow, {
								gap: "0.75rem",
								flexWrap: "wrap",
							})}
						>
							{optionalTypes.length > 0 && (
								<button
									type="button"
									onClick={() => setShowCustomize(true)}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									{customizeText}
								</button>
							)}
							<button
								type="button"
								onClick={handleDeclineOptional}
								disabled={isLoading}
								style={mergeStyles(styles.button, styles.buttonSecondary)}
							>
								{declineText}
							</button>
							<button
								type="button"
								onClick={handleAcceptAll}
								disabled={isLoading}
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								{isLoading ? <span style={styles.spinner} /> : acceptAllText}
							</button>
						</div>
					</div>
				) : (
					// Customize view
					<div>
						<div
							style={mergeStyles(styles.flexBetween, { marginBottom: "1rem" })}
						>
							<h3
								style={{
									margin: 0,
									fontSize: theme.fontSizeLg,
									fontWeight: 600,
								}}
							>
								Customize Preferences
							</h3>
							<button
								type="button"
								onClick={() => setShowCustomize(false)}
								style={mergeStyles(styles.button, styles.buttonGhost, {
									padding: "0.25rem",
								})}
								aria-label="Close"
							>
								<CloseIcon />
							</button>
						</div>

						<div style={{ marginBottom: "1.5rem" }}>
							{/* Required (always on) */}
							{types
								.filter((t) => t.required)
								.map((type) => (
									<ConsentToggle
										key={type.id}
										name={type.name}
										description={type.description}
										checked={true}
										disabled={true}
										required={true}
										theme={theme}
									/>
								))}

							{/* Optional */}
							{optionalTypes.map((type) => (
								<ConsentToggle
									key={type.id}
									name={type.name}
									description={type.description}
									checked={consents[type.slug] ?? type.defaultEnabled}
									onChange={(checked) => setConsent(type.slug, checked)}
									theme={theme}
								/>
							))}
						</div>

						<div
							style={mergeStyles(styles.flexRow, {
								gap: "0.75rem",
								justifyContent: "flex-end",
							})}
						>
							<button
								type="button"
								onClick={() => setShowCustomize(false)}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSavePreferences}
								disabled={isLoading}
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								{isLoading ? (
									<span style={styles.spinner} />
								) : (
									"Save Preferences"
								)}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// Consent toggle component
interface ConsentToggleProps {
	name: string;
	description?: string;
	checked: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	required?: boolean;
	theme: ThemeVariables;
}

function ConsentToggle({
	name,
	description,
	checked,
	onChange,
	disabled,
	required,
	theme,
}: ConsentToggleProps) {
	const toggleStyle: CSSProperties = {
		position: "relative",
		width: "44px",
		height: "24px",
		backgroundColor: checked ? theme.colorPrimary : theme.colorMuted,
		borderRadius: "12px",
		cursor: disabled ? "not-allowed" : "pointer",
		transition: "background-color 0.2s ease",
		opacity: disabled ? 0.6 : 1,
		flexShrink: 0,
	};

	const knobStyle: CSSProperties = {
		position: "absolute",
		top: "2px",
		left: checked ? "22px" : "2px",
		width: "20px",
		height: "20px",
		backgroundColor: "#fff",
		borderRadius: "50%",
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
		transition: "left 0.2s ease",
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: "1rem",
				padding: "0.75rem 0",
				borderBottom: `1px solid ${theme.colorBorder}`,
			}}
		>
			<div style={{ flex: 1 }}>
				<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
					<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>
						{name}
					</span>
					{required && (
						<span
							style={{
								fontSize: theme.fontSizeXs,
								color: theme.colorMutedForeground,
								backgroundColor: theme.colorMuted,
								padding: "0.125rem 0.375rem",
								borderRadius: "4px",
							}}
						>
							Required
						</span>
					)}
				</div>
				{description && (
					<p
						style={{
							margin: "0.25rem 0 0",
							fontSize: theme.fontSizeXs,
							color: theme.colorMutedForeground,
						}}
					>
						{description}
					</p>
				)}
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={`Toggle ${name}`}
				disabled={disabled}
				onClick={() => !disabled && onChange?.(!checked)}
				style={toggleStyle}
			>
				<span style={knobStyle} />
			</button>
		</div>
	);
}

// Close icon
function CloseIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

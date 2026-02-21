/**
 * Newsletter Form Component (Part of Email Service)
 *
 * Email capture form with validation and double opt-in support.
 * Self-contained with CSS-in-JS styles.
 *
 * Newsletter is a sub-feature of the Email service for marketing/bulk emails.
 */

"use client";

import { useEffect, useState } from "react";
import { useSubscriberForm } from "../newsletter-hooks";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

export interface NewsletterFormProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Called on successful subscription */
	onSuccess?: (email: string) => void;
	/** Called on error */
	onError?: (error: string) => void;
	/** Custom class name */
	className?: string;
	/** Form title */
	title?: string;
	/** Form description */
	description?: string;
	/** Placeholder text */
	placeholder?: string;
	/** Submit button text */
	buttonText?: string;
	/** Success message */
	successMessage?: string;
	/** Available preference options */
	preferenceOptions?: Array<{
		id: string;
		label: string;
		description?: string;
	}>;
	/** Show preference checkboxes */
	showPreferences?: boolean;
	/** Require at least one preference */
	requirePreference?: boolean;
	/** Show privacy policy link */
	showPrivacy?: boolean;
	/** Privacy policy URL */
	privacyUrl?: string;
	/** Layout style */
	layout?: "inline" | "stacked";
}

/**
 * Newsletter subscription form
 *
 * @example
 * ```tsx
 * <NewsletterForm
 *   title="Stay Updated"
 *   description="Get the latest news and updates"
 *   preferenceOptions={[
 *     { id: 'product', label: 'Product Updates' },
 *     { id: 'blog', label: 'Blog Posts' },
 *   ]}
 * />
 * ```
 */
export function NewsletterForm({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	title,
	description = "Subscribe to our newsletter",
	placeholder = "Enter your email",
	buttonText = "Subscribe",
	successMessage = "Thanks for subscribing! Please check your email to confirm.",
	preferenceOptions = [],
	showPreferences = false,
	requirePreference = false,
	showPrivacy = false,
	privacyUrl = "/privacy",
	layout = "stacked",
}: NewsletterFormProps) {
	const {
		email,
		setEmail,
		preferences,
		togglePreference,
		submit,
		isLoading,
		error: formError,
		success,
		reset,
	} = useSubscriberForm();

	const styles = baseStyles(theme);
	const [localError, setLocalError] = useState<string | null>(null);

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles();
	}, []);

	// Handle success callback
	useEffect(() => {
		if (success && onSuccess) {
			onSuccess(email);
		}
	}, [success, email, onSuccess]);

	// Handle error callback
	useEffect(() => {
		if (formError && onError) {
			onError(formError.message);
		}
	}, [formError, onError]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocalError(null);

		// Validate email
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setLocalError("Please enter a valid email address");
			return;
		}

		// Validate preferences if required
		if (
			requirePreference &&
			showPreferences &&
			Object.values(preferences).filter(Boolean).length === 0
		) {
			setLocalError("Please select at least one preference");
			return;
		}

		await submit();
	};

	const errorMessage = localError || (formError ? formError.message : null);

	if (success) {
		return (
			<div
				className={className}
				style={mergeStyles(styles.card, {
					textAlign: "center" as const,
					padding: "2rem",
				})}
			>
				<div style={{ color: theme.colorSuccess }}>
					<svg
						viewBox="0 0 24 24"
						width="48"
						height="48"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				</div>
				<p
					style={{
						marginTop: "1rem",
						color: theme.colorSuccess,
						fontSize: theme.fontSizeBase,
					}}
				>
					{successMessage}
				</p>
				<button
					type="button"
					onClick={reset}
					style={mergeStyles(styles.button, styles.buttonSecondary, {
						marginTop: "1rem",
					})}
				>
					Subscribe another email
				</button>
			</div>
		);
	}

	return (
		<div
			className={className}
			style={mergeStyles(styles.card, { padding: "1.5rem" })}
		>
			{title && <h3 style={styles.cardTitle}>{title}</h3>}
			{description && <p style={styles.cardDescription}>{description}</p>}

			<form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
				<div
					style={
						layout === "inline" ? { display: "flex", gap: "0.5rem" } : undefined
					}
				>
					<div
						style={layout === "inline" ? { flex: 1 } : { marginBottom: "1rem" }}
					>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={placeholder}
							disabled={isLoading}
							style={mergeStyles(
								styles.input,
								errorMessage ? styles.inputError : {},
							)}
						/>
					</div>
					<button
						type="submit"
						disabled={isLoading}
						style={mergeStyles(
							styles.button,
							styles.buttonPrimary,
							isLoading ? styles.buttonDisabled : {},
						)}
					>
						{isLoading ? <span style={styles.spinner} /> : buttonText}
					</button>
				</div>

				{showPreferences && preferenceOptions.length > 0 && (
					<div style={{ marginTop: "1rem" }}>
						<p style={mergeStyles(styles.label, { marginBottom: "0.5rem" })}>
							Email preferences{" "}
							{requirePreference && (
								<span style={{ color: theme.colorDestructive }}>*</span>
							)}
						</p>
						{preferenceOptions.map((option) => (
							<label
								key={option.id}
								style={{
									display: "flex",
									alignItems: "flex-start",
									gap: "0.5rem",
									marginBottom: "0.5rem",
									cursor: "pointer",
								}}
							>
								<input
									type="checkbox"
									checked={preferences[option.id] ?? false}
									onChange={() => togglePreference(option.id)}
									disabled={isLoading}
									style={{ marginTop: "0.25rem" }}
								/>
								<div>
									<span style={{ fontSize: theme.fontSizeBase }}>
										{option.label}
									</span>
									{option.description && (
										<p
											style={mergeStyles(styles.textSm, styles.textMuted, {
												marginTop: "0.125rem",
											})}
										>
											{option.description}
										</p>
									)}
								</div>
							</label>
						))}
					</div>
				)}

				{errorMessage && (
					<div
						style={mergeStyles(styles.alert, styles.alertError, {
							marginTop: "0.5rem",
							marginBottom: 0,
						})}
					>
						{errorMessage}
					</div>
				)}

				{showPrivacy && (
					<p
						style={mergeStyles(styles.textSm, styles.textMuted, {
							marginTop: "1rem",
						})}
					>
						By subscribing, you agree to our{" "}
						<a
							href={privacyUrl}
							style={styles.link}
							target="_blank"
							rel="noopener noreferrer"
						>
							Privacy Policy
						</a>
					</p>
				)}
			</form>
		</div>
	);
}

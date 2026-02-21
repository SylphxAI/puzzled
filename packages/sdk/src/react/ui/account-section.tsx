/**
 * Account Section Component
 *
 * Account management: email change, data export, account deletion.
 * Self-contained with CSS-in-JS styles.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { UI_NOTIFICATION_MS, UI_SUCCESS_REDIRECT_MS } from "../../constants";
import { RequireSdk, useAuth, useUser } from "../hooks";
import { useSecurityContext, useUserContext } from "../services-context";
import type { ThemeVariables } from "./styles";
import {
	baseStyles,
	defaultTheme,
	injectGlobalStyles,
	mergeStyles,
} from "./styles";

export interface AccountSectionProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Called on successful action */
	onSuccess?: (message: string) => void;
	/** Called on error */
	onError?: (error: string) => void;
	/** Custom class name */
	className?: string;
	/** Show email change option */
	showEmailChange?: boolean;
	/** Show data export option */
	showDataExport?: boolean;
	/** Show account deletion option */
	showDeleteAccount?: boolean;
	/** URL to redirect after account deletion */
	afterDeleteUrl?: string;
}

/**
 * Account management section
 *
 * @example
 * ```tsx
 * <AccountSection
 *   onSuccess={(msg) => toast.success(msg)}
 *   afterDeleteUrl="/"
 * />
 * ```
 */
export function AccountSection(props: AccountSectionProps) {
	return (
		<RequireSdk services={["auth"]} componentType="account" theme={props.theme}>
			<AccountSectionInner {...props} />
		</RequireSdk>
	);
}

/** Inner component that safely uses platform hooks */
function AccountSectionInner({
	theme = defaultTheme,
	onSuccess,
	onError,
	className,
	showEmailChange = true,
	showDataExport = true,
	showDeleteAccount = true,
	afterDeleteUrl = "/",
}: AccountSectionProps) {
	const { user } = useUser();
	const { signOut } = useAuth();
	const userContext = useUserContext();
	const securityContext = useSecurityContext();
	const styles = baseStyles(theme);

	// State
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Email change state
	const [showEmailChangeForm, setShowEmailChangeForm] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [emailPassword, setEmailPassword] = useState("");
	const [isChangingEmail, setIsChangingEmail] = useState(false);

	// Data export state
	const [isExporting, setIsExporting] = useState(false);
	const [exportUrl, setExportUrl] = useState<string | null>(null);

	// Delete account state
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const [delete2FACode, setDelete2FACode] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteStep, setDeleteStep] = useState<"confirm" | "password" | "2fa">(
		"confirm",
	);
	const [has2FAEnabled, setHas2FAEnabled] = useState(false);
	const [isChecking2FA, setIsChecking2FA] = useState(false);

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles();
	}, []);

	// Clear messages after timeout
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess(null);
				setError(null);
			}, UI_NOTIFICATION_MS);
			return () => clearTimeout(timer);
		}
	}, [success, error]);

	// Handle email change request
	const handleEmailChange = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!newEmail || !newEmail.includes("@")) {
			setError("Please enter a valid email address");
			return;
		}

		setIsChangingEmail(true);
		setError(null);

		try {
			const result = await securityContext.emailChangeRequest(newEmail);
			setShowEmailChangeForm(false);
			setNewEmail("");
			setEmailPassword("");
			setSuccess(
				result.message ||
					"Verification email sent to your new address. Please check your inbox.",
			);
			onSuccess?.("Verification email sent");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to change email";
			setError(message);
			onError?.(message);
		} finally {
			setIsChangingEmail(false);
		}
	};

	// Handle data export
	const handleDataExport = async () => {
		setIsExporting(true);
		setError(null);

		try {
			const data = await userContext.exportData();
			setExportUrl(data.downloadUrl);
			setSuccess("Your data export is ready for download");
			onSuccess?.("Data export ready");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to export data";
			setError(message);
			onError?.(message);
		} finally {
			setIsExporting(false);
		}
	};

	// Check 2FA status when delete confirmation is shown (industry best practice)
	const checkSecurityStatus = useCallback(async () => {
		setIsChecking2FA(true);
		try {
			const status = await securityContext.getTwoFactorStatus();
			setHas2FAEnabled(status.enabled);
		} catch {
			// If we can't check 2FA, assume it's not enabled
			setHas2FAEnabled(false);
		} finally {
			setIsChecking2FA(false);
		}
	}, [securityContext]);

	// Handle delete confirmation step
	const handleDeleteConfirmStep = async () => {
		if (deleteConfirmText !== "DELETE") {
			setError("Please type DELETE to confirm");
			return;
		}

		// Check 2FA status before proceeding
		await checkSecurityStatus();

		// Move to password step
		setDeleteStep("password");
	};

	// Handle password verification step
	const handlePasswordStep = () => {
		if (!deletePassword) {
			setError("Please enter your password");
			return;
		}

		if (has2FAEnabled) {
			// Move to 2FA step
			setDeleteStep("2fa");
		} else {
			// No 2FA, proceed with deletion
			handleDeleteAccount();
		}
	};

	// Handle 2FA verification step (industry standard: verify 2FA before destructive actions)
	const handle2FAStep = () => {
		if (!delete2FACode || delete2FACode.length !== 6) {
			setError("Please enter a valid 6-digit code");
			return;
		}
		handleDeleteAccount();
	};

	// Handle account deletion with password and optional 2FA
	const handleDeleteAccount = async () => {
		setIsDeleting(true);
		setError(null);

		try {
			// If 2FA is enabled, verify the code first
			if (has2FAEnabled && delete2FACode) {
				await securityContext.twoFactorVerify(delete2FACode);
			}

			// Proceed with deletion (pass password for re-authentication)
			await userContext.deleteAccount(deletePassword);
			setSuccess("Account deleted. Redirecting...");
			onSuccess?.("Account deleted");

			// Sign out and redirect
			setTimeout(async () => {
				await signOut({ redirectUrl: afterDeleteUrl });
			}, UI_SUCCESS_REDIRECT_MS);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to delete account";
			setError(message);
			onError?.(message);
			setIsDeleting(false);
		}
	};

	// Reset delete state
	const resetDeleteState = () => {
		setShowDeleteConfirm(false);
		setDeleteConfirmText("");
		setDeletePassword("");
		setDelete2FACode("");
		setDeleteStep("confirm");
		setHas2FAEnabled(false);
	};

	const cardStyles: React.CSSProperties = mergeStyles(styles.card, {
		padding: "1rem",
		marginBottom: "1rem",
	});

	return (
		<div className={className}>
			{/* Alerts */}
			{success && (
				<div style={mergeStyles(styles.alert, styles.alertSuccess, styles.mb4)}>
					{success}
				</div>
			)}
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, styles.mb4)}>
					{error}
				</div>
			)}

			{/* Email Change */}
			{showEmailChange && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Email Address</h4>
							<p
								style={mergeStyles(styles.textSm, styles.textMuted, {
									margin: "0.25rem 0 0",
								})}
							>
								{user?.email}
							</p>
						</div>
						{!showEmailChangeForm && (
							<button
								type="button"
								onClick={() => setShowEmailChangeForm(true)}
								style={mergeStyles(styles.button, styles.buttonOutline)}
							>
								Change
							</button>
						)}
					</div>

					{showEmailChangeForm && (
						<form
							onSubmit={handleEmailChange}
							style={{
								marginTop: "1rem",
								paddingTop: "1rem",
								borderTop: `1px solid ${theme.colorBorder}`,
							}}
						>
							<div style={styles.formGroup}>
								<label style={styles.label}>New Email Address</label>
								<input
									type="email"
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									placeholder="new@example.com"
									required
									style={styles.input}
								/>
							</div>
							<div style={styles.formGroup}>
								<label style={styles.label}>Current Password</label>
								<input
									type="password"
									value={emailPassword}
									onChange={(e) => setEmailPassword(e.target.value)}
									placeholder="Enter your password to confirm"
									required
									style={styles.input}
								/>
							</div>
							<div style={mergeStyles(styles.flexRow, { gap: "0.5rem" })}>
								<button
									type="submit"
									disabled={isChangingEmail}
									style={mergeStyles(
										styles.button,
										styles.buttonPrimary,
										isChangingEmail ? styles.buttonDisabled : {},
									)}
								>
									{isChangingEmail ? (
										<>
											<span style={styles.spinner} />
											Sending...
										</>
									) : (
										"Send Verification"
									)}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowEmailChangeForm(false);
										setNewEmail("");
										setEmailPassword("");
									}}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									Cancel
								</button>
							</div>
						</form>
					)}
				</div>
			)}

			{/* Data Export */}
			{showDataExport && (
				<div style={cardStyles}>
					<div style={styles.flexBetween}>
						<div>
							<h4 style={{ margin: 0, fontWeight: 500 }}>Export Your Data</h4>
							<p
								style={mergeStyles(styles.textSm, styles.textMuted, {
									margin: "0.25rem 0 0",
								})}
							>
								Download a copy of all your data
							</p>
						</div>
						{!exportUrl ? (
							<button
								type="button"
								onClick={handleDataExport}
								disabled={isExporting}
								style={mergeStyles(
									styles.button,
									styles.buttonOutline,
									isExporting ? styles.buttonDisabled : {},
								)}
							>
								{isExporting ? (
									<>
										<span style={styles.spinner} />
										Preparing...
									</>
								) : (
									<>
										<DownloadIcon size={16} />
										Export
									</>
								)}
							</button>
						) : (
							<a
								href={exportUrl}
								download
								style={mergeStyles(styles.button, styles.buttonPrimary)}
							>
								<DownloadIcon size={16} />
								Download
							</a>
						)}
					</div>
				</div>
			)}

			{/* Delete Account */}
			{showDeleteAccount && (
				<div
					style={mergeStyles(cardStyles, {
						borderColor: theme.colorDestructive,
						backgroundColor: `${theme.colorDestructive}05`,
					})}
				>
					<div style={styles.flexBetween}>
						<div>
							<h4
								style={{
									margin: 0,
									fontWeight: 500,
									color: theme.colorDestructive,
								}}
							>
								Delete Account
							</h4>
							<p
								style={mergeStyles(styles.textSm, styles.textMuted, {
									margin: "0.25rem 0 0",
								})}
							>
								Permanently delete your account and all data
							</p>
						</div>
						{!showDeleteConfirm && (
							<button
								type="button"
								onClick={() => setShowDeleteConfirm(true)}
								style={mergeStyles(styles.button, styles.buttonDestructive)}
							>
								<TrashIcon size={16} />
								Delete Account
							</button>
						)}
					</div>

					{showDeleteConfirm && (
						<div
							style={{
								marginTop: "1rem",
								paddingTop: "1rem",
								borderTop: `1px solid ${theme.colorDestructive}30`,
							}}
						>
							{/* Step indicator */}
							<div
								style={mergeStyles(styles.textXs, styles.textMuted, {
									marginBottom: "1rem",
								})}
							>
								Step{" "}
								{deleteStep === "confirm"
									? "1"
									: deleteStep === "password"
										? "2"
										: "3"}{" "}
								of {has2FAEnabled ? "3" : "2"}
							</div>

							{/* Step 1: Confirm with DELETE text */}
							{deleteStep === "confirm" && (
								<>
									<div
										style={mergeStyles(styles.alert, styles.alertError, {
											backgroundColor: `${theme.colorDestructive}10`,
										})}
									>
										<strong>Warning:</strong> This action cannot be undone. All
										your data will be permanently deleted.
									</div>

									<p
										style={mergeStyles(styles.textSm, styles.textMuted, {
											margin: "1rem 0 0.5rem",
										})}
									>
										Type <strong>DELETE</strong> to confirm:
									</p>
									<input
										type="text"
										value={deleteConfirmText}
										onChange={(e) => setDeleteConfirmText(e.target.value)}
										placeholder="DELETE"
										style={mergeStyles(styles.input, { marginBottom: "1rem" })}
									/>

									<div style={mergeStyles(styles.flexRow, { gap: "0.5rem" })}>
										<button
											type="button"
											onClick={handleDeleteConfirmStep}
											disabled={isChecking2FA || deleteConfirmText !== "DELETE"}
											style={mergeStyles(
												styles.button,
												styles.buttonDestructive,
												isChecking2FA || deleteConfirmText !== "DELETE"
													? styles.buttonDisabled
													: {},
											)}
										>
											{isChecking2FA ? (
												<>
													<span style={styles.spinner} />
													Checking...
												</>
											) : (
												"Continue"
											)}
										</button>
										<button
											type="button"
											onClick={resetDeleteState}
											style={mergeStyles(styles.button, styles.buttonOutline)}
										>
											Cancel
										</button>
									</div>
								</>
							)}

							{/* Step 2: Password verification */}
							{deleteStep === "password" && (
								<>
									<p
										style={mergeStyles(styles.textSm, styles.textMuted, {
											margin: "0 0 0.5rem",
										})}
									>
										Enter your password to verify your identity:
									</p>
									<input
										type="password"
										value={deletePassword}
										onChange={(e) => setDeletePassword(e.target.value)}
										placeholder="Enter your password"
										autoComplete="current-password"
										style={mergeStyles(styles.input, { marginBottom: "1rem" })}
									/>

									<div style={mergeStyles(styles.flexRow, { gap: "0.5rem" })}>
										<button
											type="button"
											onClick={handlePasswordStep}
											disabled={!deletePassword}
											style={mergeStyles(
												styles.button,
												styles.buttonDestructive,
												!deletePassword ? styles.buttonDisabled : {},
											)}
										>
											{has2FAEnabled ? "Continue" : "Delete Account"}
										</button>
										<button
											type="button"
											onClick={() => setDeleteStep("confirm")}
											style={mergeStyles(styles.button, styles.buttonOutline)}
										>
											Back
										</button>
									</div>
								</>
							)}

							{/* Step 3: 2FA verification (only if 2FA is enabled) */}
							{deleteStep === "2fa" && (
								<>
									<div
										style={mergeStyles(styles.flexCenter, {
											width: "3rem",
											height: "3rem",
											borderRadius: "50%",
											backgroundColor: `${theme.colorDestructive}15`,
											margin: "0 auto 1rem",
										})}
									>
										<ShieldIcon size={24} color={theme.colorDestructive} />
									</div>
									<p
										style={mergeStyles(
											styles.textSm,
											styles.textMuted,
											styles.textCenter,
											{ margin: "0 0 1rem" },
										)}
									>
										Enter your two-factor authentication code to confirm:
									</p>
									<input
										type="text"
										value={delete2FACode}
										onChange={(e) =>
											setDelete2FACode(
												e.target.value.replace(/\D/g, "").slice(0, 6),
											)
										}
										placeholder="000000"
										maxLength={6}
										style={mergeStyles(styles.input, {
											marginBottom: "1rem",
											textAlign: "center",
											letterSpacing: "0.5em",
											fontSize: theme.fontSizeLg,
										})}
									/>

									<div
										style={mergeStyles(styles.flexRow, {
											gap: "0.5rem",
											justifyContent: "center",
										})}
									>
										<button
											type="button"
											onClick={handle2FAStep}
											disabled={isDeleting || delete2FACode.length !== 6}
											style={mergeStyles(
												styles.button,
												styles.buttonDestructive,
												isDeleting || delete2FACode.length !== 6
													? styles.buttonDisabled
													: {},
											)}
										>
											{isDeleting ? (
												<>
													<span style={styles.spinner} />
													Deleting...
												</>
											) : (
												"Permanently Delete"
											)}
										</button>
										<button
											type="button"
											onClick={() => setDeleteStep("password")}
											style={mergeStyles(styles.button, styles.buttonOutline)}
										>
											Back
										</button>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// Icons
function DownloadIcon({ size = 24 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	);
}

function TrashIcon({ size = 24 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

function ShieldIcon({
	size = 24,
	color = "currentColor",
}: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
		</svg>
	);
}

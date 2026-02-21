"use client";

import {
	ArrowLeft,
	ArrowRight,
	KeyRound,
	Loader2,
	Mail,
	ShieldCheck,
	Smartphone,
} from "lucide-react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { cn } from "../utils";
import { Button } from "./button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

// ==========================================
// Types
// ==========================================

export type ChallengeLevel = "strict_mfa" | "strict" | "moderate" | "lax";
export type IdentityMethod = "password" | "email";
export type MfaMethod = "totp" | "backup";

export interface ChallengeRequirement {
	operation: string;
	level: ChallengeLevel;
	methods: {
		identity: IdentityMethod[];
		mfa: MfaMethod[];
	};
	user: {
		hasPassword: boolean;
		has2FA: boolean;
		maskedEmail: string;
	};
}

export interface ChallengeModalProps {
	/** Whether the modal is open */
	open: boolean;
	/** Callback when modal should close */
	onOpenChange: (open: boolean) => void;
	/** The challenge requirement from the PRECONDITION_FAILED error */
	requirement: ChallengeRequirement | null;
	/** Callback to verify identity (password or email code) */
	onVerifyIdentity: (method: IdentityMethod, value: string) => Promise<void>;
	/** Callback to verify MFA (TOTP or backup code) */
	onVerifyMfa: (method: MfaMethod, value: string) => Promise<void>;
	/** Callback to send email verification code */
	onSendCode: () => Promise<{ expiresAt: string; maskedEmail: string }>;
	/** Callback when verification is complete */
	onComplete: () => void;
	/** Optional title override */
	title?: string;
	/** Optional description override */
	description?: string;
}

export interface ChallengeModalRef {
	/** Reset the modal state */
	reset: () => void;
}

// ==========================================
// Sub-components
// ==========================================

interface PasswordInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

function PasswordInput({
	value,
	onChange,
	onSubmit,
	disabled,
	error,
	autoFocus,
}: PasswordInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) {
			inputRef.current?.focus();
		}
	}, [autoFocus]);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<KeyRound className="h-5 w-5 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Enter your account password to verify your identity.
				</p>
			</div>
			<Input
				ref={inputRef}
				type="password"
				label="Password"
				placeholder="Enter your password"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => e.key === "Enter" && !disabled && onSubmit()}
				disabled={disabled}
				error={error}
				autoComplete="current-password"
			/>
		</div>
	);
}

interface EmailCodeInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onSendCode: () => void;
	maskedEmail: string;
	codeSent: boolean;
	countdown: number;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

function EmailCodeInput({
	value,
	onChange,
	onSubmit,
	onSendCode,
	maskedEmail,
	codeSent,
	countdown,
	disabled,
	error,
	autoFocus,
}: EmailCodeInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus && codeSent) {
			inputRef.current?.focus();
		}
	}, [autoFocus, codeSent]);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<Mail className="h-5 w-5 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					We'll send a 6-digit code to <strong>{maskedEmail}</strong>
				</p>
			</div>

			{!codeSent ? (
				<Button onClick={onSendCode} disabled={disabled} className="w-full">
					<Mail className="mr-2 h-4 w-4" />
					Send Verification Code
				</Button>
			) : (
				<>
					<Input
						ref={inputRef}
						type="text"
						inputMode="numeric"
						label="Verification Code"
						placeholder="Enter 6-digit code"
						value={value}
						onChange={(e) =>
							onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
						}
						onKeyDown={(e) =>
							e.key === "Enter" && !disabled && value.length === 6 && onSubmit()
						}
						disabled={disabled}
						error={error}
						autoComplete="one-time-code"
					/>
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							{countdown > 0
								? `Resend in ${countdown}s`
								: "Didn't receive the code?"}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={onSendCode}
							disabled={countdown > 0 || disabled}
						>
							Resend Code
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

interface TotpInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

function TotpInput({
	value,
	onChange,
	onSubmit,
	disabled,
	error,
	autoFocus,
}: TotpInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) {
			inputRef.current?.focus();
		}
	}, [autoFocus]);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<Smartphone className="h-5 w-5 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Enter the 6-digit code from your authenticator app.
				</p>
			</div>
			<Input
				ref={inputRef}
				type="text"
				inputMode="numeric"
				label="Authentication Code"
				placeholder="Enter 6-digit code"
				value={value}
				onChange={(e) =>
					onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
				}
				onKeyDown={(e) =>
					e.key === "Enter" && !disabled && value.length === 6 && onSubmit()
				}
				disabled={disabled}
				error={error}
				autoComplete="one-time-code"
			/>
		</div>
	);
}

interface BackupCodeInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

function BackupCodeInput({
	value,
	onChange,
	onSubmit,
	disabled,
	error,
	autoFocus,
}: BackupCodeInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) {
			inputRef.current?.focus();
		}
	}, [autoFocus]);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<ShieldCheck className="h-5 w-5 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Enter one of your backup codes. Each code can only be used once.
				</p>
			</div>
			<Input
				ref={inputRef}
				type="text"
				label="Backup Code"
				placeholder="Enter backup code"
				value={value}
				onChange={(e) => onChange(e.target.value.toUpperCase())}
				onKeyDown={(e) =>
					e.key === "Enter" && !disabled && value.length >= 8 && onSubmit()
				}
				disabled={disabled}
				error={error}
				autoComplete="off"
			/>
		</div>
	);
}

// ==========================================
// Main Component
// ==========================================

const ChallengeModal = forwardRef<ChallengeModalRef, ChallengeModalProps>(
	(
		{
			open,
			onOpenChange,
			requirement,
			onVerifyIdentity,
			onVerifyMfa,
			onSendCode,
			onComplete,
			title,
			description,
		},
		ref,
	) => {
		// Step: 'identity' or 'mfa'
		const [step, setStep] = useState<"identity" | "mfa">("identity");

		// Identity method state
		const [identityMethod, setIdentityMethod] =
			useState<IdentityMethod>("password");
		const [password, setPassword] = useState("");
		const [emailCode, setEmailCode] = useState("");
		const [emailCodeSent, setEmailCodeSent] = useState(false);
		const [countdown, setCountdown] = useState(0);

		// MFA method state
		const [mfaMethod, setMfaMethod] = useState<MfaMethod>("totp");
		const [totpCode, setTotpCode] = useState("");
		const [backupCode, setBackupCode] = useState("");

		// UI state
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState<string | null>(null);

		// Reset function
		const reset = useCallback(() => {
			setStep("identity");
			setIdentityMethod("password");
			setPassword("");
			setEmailCode("");
			setEmailCodeSent(false);
			setCountdown(0);
			setMfaMethod("totp");
			setTotpCode("");
			setBackupCode("");
			setLoading(false);
			setError(null);
		}, []);

		// Expose reset via ref
		useImperativeHandle(ref, () => ({ reset }), [reset]);

		// Reset when modal closes or requirement changes
		useEffect(() => {
			if (!open) {
				// Delay reset to allow close animation
				const timer = setTimeout(reset, 200);
				return () => clearTimeout(timer);
			}
		}, [open, reset]);

		useEffect(() => {
			if (requirement) {
				// Set default identity method based on available methods
				if (
					requirement.methods.identity.includes("password") &&
					requirement.user.hasPassword
				) {
					setIdentityMethod("password");
				} else if (requirement.methods.identity.includes("email")) {
					setIdentityMethod("email");
				}

				// Set default MFA method
				if (requirement.methods.mfa.includes("totp")) {
					setMfaMethod("totp");
				} else if (requirement.methods.mfa.includes("backup")) {
					setMfaMethod("backup");
				}
			}
		}, [requirement]);

		// Countdown timer for email code
		useEffect(() => {
			if (countdown > 0) {
				const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
				return () => clearTimeout(timer);
			}
		}, [countdown]);

		// Handle sending email code
		const handleSendCode = async () => {
			setLoading(true);
			setError(null);
			try {
				await onSendCode();
				setEmailCodeSent(true);
				setCountdown(60); // 60 second cooldown
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send code");
			} finally {
				setLoading(false);
			}
		};

		// Handle identity verification
		const handleVerifyIdentity = async () => {
			const value = identityMethod === "password" ? password : emailCode;
			if (!value) {
				setError("Please enter the required value");
				return;
			}

			setLoading(true);
			setError(null);
			try {
				await onVerifyIdentity(identityMethod, value);

				// If MFA required, move to MFA step
				if (
					requirement?.level === "strict_mfa" &&
					requirement.methods.mfa.length > 0
				) {
					setStep("mfa");
				} else {
					// Complete!
					onComplete();
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Verification failed");
			} finally {
				setLoading(false);
			}
		};

		// Handle MFA verification
		const handleVerifyMfa = async () => {
			const value = mfaMethod === "totp" ? totpCode : backupCode;
			if (!value) {
				setError("Please enter the required value");
				return;
			}

			setLoading(true);
			setError(null);
			try {
				await onVerifyMfa(mfaMethod, value);
				// Complete!
				onComplete();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Verification failed");
			} finally {
				setLoading(false);
			}
		};

		if (!requirement) return null;

		const requiresMfa =
			requirement.level === "strict_mfa" && requirement.methods.mfa.length > 0;
		const hasMultipleIdentityMethods =
			requirement.methods.identity.length > 1 ||
			(requirement.methods.identity.includes("password") &&
				requirement.user.hasPassword);
		const hasMultipleMfaMethods = requirement.methods.mfa.length > 1;

		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{title ??
								(step === "identity"
									? "Verify Your Identity"
									: "Two-Factor Authentication")}
						</DialogTitle>
						<DialogDescription>
							{description ??
								(step === "identity"
									? "This action requires you to verify your identity."
									: "Enter your two-factor authentication code to continue.")}
						</DialogDescription>
					</DialogHeader>

					<DialogBody>
						{/* Step indicator for strict_mfa */}
						{requiresMfa && (
							<div className="mb-6 flex items-center justify-center gap-2">
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
										step === "identity"
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground",
									)}
								>
									1
								</div>
								<div className="h-px w-8 bg-border" />
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
										step === "mfa"
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground",
									)}
								>
									2
								</div>
							</div>
						)}

						{step === "identity" ? (
							<>
								{hasMultipleIdentityMethods ? (
									<Tabs
										value={identityMethod}
										onValueChange={(v) => {
											setIdentityMethod(v as IdentityMethod);
											setError(null);
										}}
									>
										<TabsList className="mb-4 w-full">
											{requirement.methods.identity.includes("password") &&
												requirement.user.hasPassword && (
													<TabsTrigger value="password" className="flex-1">
														<KeyRound className="mr-2 h-4 w-4" />
														Password
													</TabsTrigger>
												)}
											{requirement.methods.identity.includes("email") && (
												<TabsTrigger value="email" className="flex-1">
													<Mail className="mr-2 h-4 w-4" />
													Email Code
												</TabsTrigger>
											)}
										</TabsList>

										<TabsContent value="password">
											<PasswordInput
												value={password}
												onChange={setPassword}
												onSubmit={handleVerifyIdentity}
												disabled={loading}
												error={error ?? undefined}
												autoFocus={identityMethod === "password"}
											/>
										</TabsContent>

										<TabsContent value="email">
											<EmailCodeInput
												value={emailCode}
												onChange={setEmailCode}
												onSubmit={handleVerifyIdentity}
												onSendCode={handleSendCode}
												maskedEmail={requirement.user.maskedEmail}
												codeSent={emailCodeSent}
												countdown={countdown}
												disabled={loading}
												error={error ?? undefined}
												autoFocus={identityMethod === "email"}
											/>
										</TabsContent>
									</Tabs>
								) : requirement.methods.identity.includes("email") ? (
									<EmailCodeInput
										value={emailCode}
										onChange={setEmailCode}
										onSubmit={handleVerifyIdentity}
										onSendCode={handleSendCode}
										maskedEmail={requirement.user.maskedEmail}
										codeSent={emailCodeSent}
										countdown={countdown}
										disabled={loading}
										error={error ?? undefined}
										autoFocus
									/>
								) : (
									<PasswordInput
										value={password}
										onChange={setPassword}
										onSubmit={handleVerifyIdentity}
										disabled={loading}
										error={error ?? undefined}
										autoFocus
									/>
								)}
							</>
						) : (
							<>
								{hasMultipleMfaMethods ? (
									<Tabs
										value={mfaMethod}
										onValueChange={(v) => {
											setMfaMethod(v as MfaMethod);
											setError(null);
										}}
									>
										<TabsList className="mb-4 w-full">
											{requirement.methods.mfa.includes("totp") && (
												<TabsTrigger value="totp" className="flex-1">
													<Smartphone className="mr-2 h-4 w-4" />
													Authenticator
												</TabsTrigger>
											)}
											{requirement.methods.mfa.includes("backup") && (
												<TabsTrigger value="backup" className="flex-1">
													<ShieldCheck className="mr-2 h-4 w-4" />
													Backup Code
												</TabsTrigger>
											)}
										</TabsList>

										<TabsContent value="totp">
											<TotpInput
												value={totpCode}
												onChange={setTotpCode}
												onSubmit={handleVerifyMfa}
												disabled={loading}
												error={error ?? undefined}
												autoFocus={mfaMethod === "totp"}
											/>
										</TabsContent>

										<TabsContent value="backup">
											<BackupCodeInput
												value={backupCode}
												onChange={setBackupCode}
												onSubmit={handleVerifyMfa}
												disabled={loading}
												error={error ?? undefined}
												autoFocus={mfaMethod === "backup"}
											/>
										</TabsContent>
									</Tabs>
								) : requirement.methods.mfa.includes("totp") ? (
									<TotpInput
										value={totpCode}
										onChange={setTotpCode}
										onSubmit={handleVerifyMfa}
										disabled={loading}
										error={error ?? undefined}
										autoFocus
									/>
								) : (
									<BackupCodeInput
										value={backupCode}
										onChange={setBackupCode}
										onSubmit={handleVerifyMfa}
										disabled={loading}
										error={error ?? undefined}
										autoFocus
									/>
								)}
							</>
						)}
					</DialogBody>

					<DialogFooter>
						{step === "mfa" && (
							<Button
								variant="outline"
								onClick={() => setStep("identity")}
								disabled={loading}
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back
							</Button>
						)}
						<Button
							onClick={
								step === "identity" ? handleVerifyIdentity : handleVerifyMfa
							}
							disabled={
								loading ||
								(step === "identity" &&
									identityMethod === "email" &&
									!emailCodeSent) ||
								(step === "identity" &&
									identityMethod === "password" &&
									!password) ||
								(step === "identity" &&
									identityMethod === "email" &&
									emailCode.length !== 6) ||
								(step === "mfa" &&
									mfaMethod === "totp" &&
									totpCode.length !== 6) ||
								(step === "mfa" &&
									mfaMethod === "backup" &&
									backupCode.length < 8)
							}
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Verifying...
								</>
							) : step === "identity" && requiresMfa ? (
								<>
									Continue
									<ArrowRight className="ml-2 h-4 w-4" />
								</>
							) : (
								"Verify"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);

ChallengeModal.displayName = "ChallengeModal";

export { ChallengeModal };

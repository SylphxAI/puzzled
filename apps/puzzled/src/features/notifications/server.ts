// Edge-compatible exports

// Email exports (edge-compatible via Resend HTTP API)
export {
	// Low-level utilities for custom email sending
	FROM_EMAIL,
	getResend,
	// High-level email functions
	sendEmailChangeNotification,
	sendEmailChangeVerification,
	sendPasswordResetEmail,
	sendIdentityVerificationCode,
	sendStreakAtRiskEmail,
	sendSubscriptionConfirmation,
	sendTestEmail,
	sendTrialEndedEmail,
	sendTrialEndingSoonEmail,
	sendTrialStartedEmail,
	sendVerificationEmail,
	sendWelcomeEmail,
	sendWinBackDay7Email,
	sendWinBackDay14Email,
	sendWinBackDay30Email,
} from './lib/email'
export {
	getVapidPublicKey,
	isPushConfigured,
	type PushPayload,
	subscribeToPush,
	unsubscribeFromPush,
} from './lib/push'

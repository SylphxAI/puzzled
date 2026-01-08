import { Resend } from 'resend'
import { APP_EMAIL_NAME, APP_NAME, DEFAULT_FROM_EMAIL, SUPPORT_EMAIL } from '@/lib/config/app'
import { escapeHtml, getServerBaseUrl } from '@/lib/utils'

// App URL - single source of truth from utils
const APP_URL = getServerBaseUrl()

// Lazy import to avoid circular dependency
let generateUnsubscribeToken: ((userId: string) => string) | null = null
async function getUnsubscribeToken(userId: string): Promise<string> {
	if (!generateUnsubscribeToken) {
		const mod = await import('@/app/api/email/unsubscribe/route')
		generateUnsubscribeToken = mod.generateUnsubscribeToken
	}
	return generateUnsubscribeToken(userId)
}

// Lazy initialization to avoid build-time errors when env vars aren't set
let resendInstance: Resend | null = null

/**
 * Get Resend client instance (singleton)
 * Exported for shared use in security-alert-emails.ts
 */
export function getResend(): Resend | null {
	if (!process.env.RESEND_API_KEY) {
		console.error('[Email] RESEND_API_KEY is not configured')
		return null
	}
	if (!resendInstance) {
		resendInstance = new Resend(process.env.RESEND_API_KEY)
	}
	return resendInstance
}

/** Default from email - single source of truth */
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL

export async function sendWelcomeEmail({ email, name }: { email: string; name: string }) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping welcome email - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Welcome to ${APP_NAME}!`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Welcome to ${APP_NAME}!</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>Thanks for joining ${APP_NAME}! We're excited to have you.</p>
				<p>Start playing now:</p>
				<ul>
					<li><strong>Wordle</strong> - Guess the 5-letter word</li>
					<li><strong>Connections</strong> - Group 16 words into 4 categories</li>
					<li><strong>Daily Quiz</strong> - Test your knowledge</li>
				</ul>
				<a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Play Now</a>
				<p style="color: #666; margin-top: 32px;">Happy gaming!<br>The ${APP_NAME} Team</p>
			</div>
		`,
	})
}

export async function sendVerificationEmail({ email, token }: { email: string; token: string }) {
	const resend = getResend()
	if (!resend) {
		console.error('[Email] Cannot send verification email - RESEND_API_KEY not configured')
		throw new Error('Email service not configured. Please contact support.')
	}

	const verifyUrl = `${APP_URL}/verify-email?token=${token}`

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Verify your email',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Verify your email</h1>
				<p>Click the button below to verify your email address:</p>
				<a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Verify Email</a>
				<p style="color: #666; margin-top: 32px;">If you didn't create an account, you can ignore this email.</p>
			</div>
		`,
	})
}

export async function sendPasswordResetEmail({ email, token }: { email: string; token: string }) {
	const resend = getResend()
	if (!resend) {
		console.error('[Email] Cannot send password reset email - RESEND_API_KEY not configured')
		throw new Error('Email service not configured. Please contact support.')
	}

	const resetUrl = `${APP_URL}/reset-password?token=${token}`

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Reset your password',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Reset your password</h1>
				<p>Click the button below to reset your password:</p>
				<a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Reset Password</a>
				<p style="color: #666; margin-top: 32px;">If you didn't request this, you can ignore this email.</p>
			</div>
		`,
	})
}

export async function sendSubscriptionConfirmation({
	email,
	name,
	plan,
}: {
	email: string
	name: string
	plan: 'premium' | 'annual'
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping subscription confirmation - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Welcome to Premium!',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">You're now a Premium member!</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>Thanks for upgrading to ${plan === 'annual' ? 'Annual' : 'Monthly'} Premium!</p>
				<p>You now have access to:</p>
				<ul>
					<li>All games unlimited</li>
					<li>Full statistics & leaderboards</li>
					<li>Push notifications</li>
					<li>Early access to new games</li>
				</ul>
				<a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Start Playing</a>
				<p style="color: #666; margin-top: 32px;">Happy gaming!<br>The ${APP_NAME} Team</p>
			</div>
		`,
	})
}

export async function sendStreakAtRiskEmail({
	email,
	name,
	game,
	currentStreak,
}: {
	email: string
	name: string
	game: string
	currentStreak: number
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping streak reminder - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Don't lose your ${currentStreak}-day streak!`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #eab308;">⚠️ Streak at risk!</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>You have a <strong>${currentStreak}-day streak</strong> in ${escapeHtml(game)}!</p>
				<p>Don't forget to play today to keep it going.</p>
				<a href="${APP_URL}/games/${game.toLowerCase()}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Play Now</a>
			</div>
		`,
	})
}

// ==================
// Trial Email Sequences
// ==================

export async function sendTrialStartedEmail({ email, name }: { email: string; name: string }) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping trial started email - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Your 7-day Premium trial has started!',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Welcome to Premium!</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>Your <strong>7-day free trial</strong> of ${APP_NAME} Premium has started! You now have full access to:</p>
				<ul>
					<li><strong>All games unlimited</strong> - Play Wordle, Connections, and Daily Quiz anytime</li>
					<li><strong>Puzzle archive</strong> - Access past puzzles whenever you want</li>
					<li><strong>Streak protection</strong> - Freeze your streak to keep it safe</li>
					<li><strong>Leaderboards</strong> - Compete with players worldwide</li>
				</ul>
				<p style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 12px; margin: 20px 0;">
					<strong>Important:</strong> Your trial lasts 7 days. After that, you'll be charged $4.99/month. Cancel anytime before the trial ends.
				</p>
				<a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Start Playing</a>
				<p style="color: #666; margin-top: 32px;">Happy gaming!<br>The ${APP_NAME} Team</p>
			</div>
		`,
	})
}

export async function sendTrialEndingSoonEmail({
	email,
	name,
	daysLeft,
}: {
	email: string
	name: string
	daysLeft: number
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping trial ending soon email - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Your Premium trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}!`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #f97316;">⏰ Trial ending soon!</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>Your 7-day Premium trial ends in <strong>${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}</strong>.</p>
				<p>After your trial ends, you'll continue to enjoy:</p>
				<ul>
					<li>All games unlimited</li>
					<li>Full puzzle archive access</li>
					<li>Streak protection features</li>
					<li>Leaderboard competition</li>
				</ul>
				<p style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0;">
					<strong>Automatic renewal:</strong> Your subscription will automatically renew at $4.99/month. You can cancel anytime in your account settings.
				</p>
				<a href="${APP_URL}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">View Subscription</a>
				<p style="color: #666; margin-top: 24px; font-size: 14px;">
					Don't want to continue? <a href="${APP_URL}/account" style="color: #6366f1;">Cancel your trial</a> before it ends.
				</p>
			</div>
		`,
	})
}

export async function sendTrialEndedEmail({ email, name }: { email: string; name: string }) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping trial ended email - Resend not configured')
		return null
	}
	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Your Premium subscription is now active',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Welcome to Premium! 🎉</h1>
				<p>Hi ${escapeHtml(name || 'there')},</p>
				<p>Your 7-day trial has ended and your Premium subscription is now active.</p>
				<p style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 12px; margin: 20px 0;">
					<strong>Subscription details:</strong><br>
					Plan: Premium Monthly<br>
					Price: $4.99/month<br>
					Next billing date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
				</p>
				<p>You'll continue to enjoy all Premium features:</p>
				<ul>
					<li>All games unlimited</li>
					<li>Full puzzle archive</li>
					<li>Streak protection</li>
					<li>Leaderboards</li>
				</ul>
				<a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Keep Playing</a>
				<p style="color: #666; margin-top: 24px; font-size: 14px;">
					Need to manage your subscription? <a href="${APP_URL}/account" style="color: #6366f1;">Visit your account settings</a>
				</p>
				<p style="color: #666; margin-top: 32px;">Thank you for being a Premium member!<br>The ${APP_NAME} Team</p>
			</div>
		`,
	})
}

// ==================
// Win-Back Email Sequences
// ==================

/**
 * Day 7 win-back email: "We miss you!" + what they're missing
 */
export async function sendWinBackDay7Email({
	email,
	name,
	userId,
}: {
	email: string
	name: string | null
	userId: string
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping win-back day 7 email - Resend not configured')
		return null
	}

	const displayName = escapeHtml(name || 'there')
	const appUrl = APP_URL
	// CAN-SPAM: Generate signed unsubscribe token
	const unsubscribeToken = await getUnsubscribeToken(userId)

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'We miss you! 🎮',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">We Miss You!</h1>
				<p>Hi ${displayName},</p>
				<p>We noticed you haven't played in a while. Your puzzles are waiting for you!</p>

				<h2 style="color: #333; font-size: 18px; margin-top: 24px;">Here's what you're missing:</h2>
				<ul style="line-height: 1.8;">
					<li><strong>Daily Wordle</strong> - New 5-letter word challenges</li>
					<li><strong>Connections</strong> - Fresh category puzzles</li>
					<li><strong>Daily Quiz</strong> - Test your knowledge</li>
				</ul>

				<p style="margin-top: 24px;">Come back and challenge yourself today!</p>

				<a href="${appUrl}?utm_source=email&utm_medium=winback&utm_campaign=day7" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Play Now</a>

				<p style="color: #666; margin-top: 32px; font-size: 14px;">
					Your progress is saved and waiting for you.<br>
					The ${APP_NAME} Team
				</p>

				<p style="color: #999; margin-top: 24px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					Not interested? <a href="${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}" style="color: #999;">Unsubscribe from marketing emails</a>
				</p>
			</div>
		`,
	})
}

/**
 * Day 14 win-back email: "Here's what's new" + new features
 */
export async function sendWinBackDay14Email({
	email,
	name,
	userId,
	newFeatures,
}: {
	email: string
	name: string | null
	userId: string
	newFeatures?: Array<{ name: string; description: string | null }>
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping win-back day 14 email - Resend not configured')
		return null
	}

	const displayName = escapeHtml(name || 'there')
	const appUrl = APP_URL
	// CAN-SPAM: Generate signed unsubscribe token
	const unsubscribeToken = await getUnsubscribeToken(userId)

	// Default features if none provided
	const features = newFeatures || [
		{ name: 'Wordle', description: 'Daily word puzzle challenges' },
		{ name: 'Connections', description: 'Group words into categories' },
		{ name: 'Daily Quiz', description: 'Test your knowledge' },
	]

	const featuresHtml = features
		.map(
			(feature) => `
		<li style="margin-bottom: 16px;">
			<strong style="color: #6366f1;">${escapeHtml(feature.name)}</strong>
			${feature.description ? `<br><span style="color: #666;">${escapeHtml(feature.description)}</span>` : ''}
		</li>
	`,
		)
		.join('')

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Here's what's new at ${APP_NAME}! 🎉`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">New Puzzles Waiting For You!</h1>
				<p>Hi ${displayName},</p>
				<p>It's been a couple of weeks since we've seen you. We've been busy creating new challenges just for you!</p>

				<h2 style="color: #333; font-size: 18px; margin-top: 24px;">What's New:</h2>
				<ul style="line-height: 1.8; list-style: none; padding-left: 0;">
					${featuresHtml}
				</ul>

				<p style="margin-top: 24px;">Plus, your statistics and progress are all saved and ready for you.</p>

				<a href="${appUrl}?utm_source=email&utm_medium=winback&utm_campaign=day14" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Check Out What's New</a>

				<p style="color: #666; margin-top: 32px; font-size: 14px;">
					We can't wait to see you back!<br>
					The ${APP_NAME} Team
				</p>

				<p style="color: #999; margin-top: 24px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					Not interested? <a href="${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}" style="color: #999;">Unsubscribe from marketing emails</a>
				</p>
			</div>
		`,
	})
}

/**
 * Day 30 win-back email: "50% off to come back" + discount code
 */
/**
 * Send a test email to verify email notifications are working
 */
export async function sendTestEmail({ email, name }: { email: string; name: string | null }) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping test email - Resend not configured')
		return null
	}

	const appUrl = APP_URL
	const displayName = escapeHtml(name || 'there')
	const timestamp = new Date().toLocaleString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short',
	})

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Test Email from ${APP_NAME}`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Test Email Received!</h1>
				<p>Hi ${displayName},</p>
				<p>This is a test email from ${APP_NAME}. If you're seeing this, your email notifications are working correctly!</p>
				<p style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 12px; margin: 20px 0;">
					<strong>Sent at:</strong> ${timestamp}
				</p>
				<p>You can manage your email notification preferences in your account settings.</p>
				<a href="${appUrl}/settings/preferences" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Notification Settings</a>
				<p style="color: #666; margin-top: 32px;">Happy gaming!<br>The ${APP_NAME} Team</p>
			</div>
		`,
	})
}

export async function sendWinBackDay30Email({
	email,
	name,
	userId,
	discountCode,
}: {
	email: string
	name: string | null
	userId: string
	discountCode: string
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping win-back day 30 email - Resend not configured')
		return null
	}

	const displayName = escapeHtml(name || 'there')
	const appUrl = APP_URL
	// Escape discount code in case it contains special characters
	const safeDiscountCode = escapeHtml(discountCode)
	// Generate signed unsubscribe token (prevents user ID enumeration)
	const unsubscribeToken = await getUnsubscribeToken(userId)

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Come back with 50% OFF Premium! 🎁',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 32px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
					<h1 style="color: white; margin: 0;">Special Offer Just For You!</h1>
					<p style="font-size: 24px; font-weight: bold; margin: 16px 0;">50% OFF Premium</p>
					<p style="margin: 0; opacity: 0.9;">We'd love to have you back</p>
				</div>

				<p>Hi ${displayName},</p>
				<p>We miss having you as part of the ${APP_NAME} community! As a special thank you for being a valued member, we're offering you <strong>50% OFF</strong> your first month of Premium.</p>

				<h2 style="color: #333; font-size: 18px; margin-top: 24px;">Premium Benefits:</h2>
				<ul style="line-height: 1.8;">
					<li><strong>Full Puzzle Archive</strong> - Access past daily puzzles anytime</li>
					<li><strong>Streak Freeze Protection</strong> - Never lose your progress</li>
					<li><strong>Advanced Statistics</strong> - Track your improvements</li>
					<li><strong>Leaderboard Access</strong> - Compete with other players</li>
					<li><strong>Ad-Free Experience</strong> - Pure, uninterrupted gameplay</li>
				</ul>

				<div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 16px; margin: 24px 0; border-radius: 4px;">
					<p style="margin: 0; font-size: 14px; color: #666;">Your exclusive discount code:</p>
					<p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: #6366f1; font-family: monospace;">${safeDiscountCode}</p>
				</div>

				<p style="color: #dc2626; font-weight: 600;">⏰ This offer expires in 7 days!</p>

				<a href="${appUrl}/pricing?coupon=${encodeURIComponent(discountCode)}&utm_source=email&utm_medium=winback&utm_campaign=day30" style="display: inline-block; background: #6366f1; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin-top: 16px; font-size: 18px; font-weight: bold;">Claim Your 50% OFF</a>

				<p style="color: #666; margin-top: 32px; font-size: 14px;">
					No obligations. Cancel anytime.<br>
					We'd love to have you back!<br>
					The ${APP_NAME} Team
				</p>

				<p style="color: #999; margin-top: 24px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					Not interested? <a href="${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}" style="color: #999;">Unsubscribe from marketing emails</a>
				</p>
			</div>
		`,
	})
}

// ==================
// Identity Verification Code
// ==================

/**
 * Send a 6-digit verification code for identity verification
 * Used for sensitive operations when user needs to prove account ownership
 */
export async function sendIdentityVerificationCode({
	email,
	code,
	operation,
}: {
	email: string
	code: string
	operation: 'reauth' | 'email_change' | 'delete_account' | 'enable_2fa'
}) {
	const resend = getResend()
	if (!resend) {
		console.error('[Email] Cannot send identity verification code - RESEND_API_KEY not configured')
		throw new Error('Email service not configured. Please contact support.')
	}

	// Human-readable operation names
	const operationNames: Record<typeof operation, string> = {
		reauth: 'verify your identity',
		email_change: 'change your email address',
		delete_account: 'delete your account',
		enable_2fa: 'enable two-factor authentication',
	}

	const operationName = operationNames[operation]

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: `Your verification code: ${code}`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Verification Code</h1>
				<p>You requested a code to ${operationName}.</p>
				<div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
					<p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Your verification code is:</p>
					<p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1; font-family: monospace;">${escapeHtml(code)}</p>
				</div>
				<p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
				<p style="color: #666; margin-top: 24px;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
				<p style="color: #999; margin-top: 32px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					The ${APP_NAME} Team
				</p>
			</div>
		`,
	})
}

// ==================
// Email Change Verification
// ==================

/**
 * Send verification email to the new email address
 * User must click the link to confirm the email change
 */
export async function sendEmailChangeVerification({
	email,
	token,
	currentEmail,
}: {
	email: string
	token: string
	currentEmail: string
}) {
	const resend = getResend()
	if (!resend) {
		console.error('[Email] Cannot send email change verification - RESEND_API_KEY not configured')
		throw new Error('Email service not configured. Please contact support.')
	}

	const appUrl = APP_URL
	const verifyUrl = `${appUrl}/verify-email-change?token=${encodeURIComponent(token)}`

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: email,
		subject: 'Verify your new email address',
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Verify your new email</h1>
				<p>You've requested to change your ${APP_NAME} account email from <strong>${escapeHtml(currentEmail)}</strong> to this email address.</p>
				<p>Click the button below to verify this email address and complete the change:</p>
				<a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Verify Email Address</a>
				<p style="color: #666; margin-top: 32px;">This link expires in 24 hours.</p>
				<p style="color: #666; margin-top: 16px;">If you didn't request this change, you can safely ignore this email. Your account email will remain unchanged.</p>
				<p style="color: #999; margin-top: 32px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					The ${APP_NAME} Team
				</p>
			</div>
		`,
	})
}

/**
 * Notify the old email address that the email was changed
 * This is a security measure to alert users of unauthorized changes
 */
export async function sendEmailChangeNotification({
	oldEmail,
	newEmail,
}: {
	oldEmail: string
	newEmail: string
}) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping email change notification - Resend not configured')
		return null
	}

	const appUrl = APP_URL

	return resend.emails.send({
		from: `${APP_EMAIL_NAME} <${FROM_EMAIL}>`,
		to: oldEmail,
		subject: `Your ${APP_NAME} email has been changed`,
		html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #6366f1;">Email address changed</h1>
				<p>This is to confirm that the email address for your ${APP_NAME} account has been changed.</p>
				<div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0;">
					<p style="margin: 0 0 8px 0;"><strong>Previous email:</strong> ${escapeHtml(oldEmail)}</p>
					<p style="margin: 0;"><strong>New email:</strong> ${escapeHtml(newEmail)}</p>
				</div>
				<p>If you made this change, no further action is needed.</p>
				<p style="color: #dc2626; margin-top: 24px;"><strong>Didn't make this change?</strong></p>
				<p>If you didn't authorize this change, your account may have been compromised. Please contact us immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1;">${SUPPORT_EMAIL}</a>.</p>
				<a href="${appUrl}/settings/security" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">Review Account Security</a>
				<p style="color: #999; margin-top: 32px; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
					The ${APP_NAME} Team
				</p>
			</div>
		`,
	})
}

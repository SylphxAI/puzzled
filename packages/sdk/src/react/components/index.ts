/**
 * Sylphx React Components
 *
 * Pre-built UI components for authentication, billing, and organization management.
 * Follows Clerk's component API patterns.
 */

// Auth components
export { SignIn, type SignInProps } from './sign-in'
export { SignUp, type SignUpProps } from './sign-up'
export { ForgotPassword, type ForgotPasswordProps } from './forgot-password'
export { ResetPassword, type ResetPasswordProps } from './reset-password'
export { VerifyEmail, type VerifyEmailProps } from './verify-email'

// User components
export { UserButton, type UserButtonProps } from './user-button'

// Organization components
export { OrganizationSwitcher, type OrganizationSwitcherProps } from './organization-switcher'
export { MembersList, type MembersListProps } from './members-list'
export { InviteMember, type InviteMemberProps } from './invite-member'

// Billing components
export { PricingTable, type PricingTableProps } from './pricing-table'
export { BillingCard, type BillingCardProps } from './billing-card'
export { CheckoutButton, type CheckoutButtonProps } from './checkout-button'
export { PlatformBalanceCard, type PlatformBalanceCardProps } from './platform-balance'
export { UsageMetrics, type UsageMetricsProps } from './usage-metrics'

// Notification components
export {
	NotificationCenter,
	NotificationBadge,
	useNotificationDropdown,
	type NotificationCenterProps,
	type NotificationBadgeProps,
	type MessageActions,
} from './notification-center'

// Access control components
export {
	Protect,
	SignedIn as SignedInProtect,
	SignedOut as SignedOutProtect,
	AdminOnly,
	PremiumOnly,
	useProtect,
	type ProtectProps,
	type StandardRole,
} from './protect'

// Referral components
export { ReferralLeaderboard, type ReferralLeaderboardProps } from './referral-leaderboard'

// Re-export OAuthProviderId for convenience
export type { OAuthProviderId } from '../../types'

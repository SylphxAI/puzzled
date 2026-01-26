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



// Notification components


// Access control components
export {
	Protect,
	
	
	AdminOnly,
	PremiumOnly,
	useProtect,
	type ProtectProps,
	type StandardRole,
} from './protect'

// Referral components


// Re-export OAuthProviderId for convenience


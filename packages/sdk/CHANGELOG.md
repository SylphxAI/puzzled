# Changelog

All notable changes to the Sylphx SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Session replay integration with `useSessionReplay` hook
- Error tracking with `captureError`, `captureMessage`, `useErrorBoundary`
- Feature flags with `useFlag`, `useFlags`, `useFlagLoading` hooks
- Analytics CDP with identity resolution and event tracking

### Changed
- Improved TypeScript strict mode compliance
- Enhanced tree-shaking with better ESM exports

## [0.1.0] - 2025-01-20

### Added

#### Core
- `createSylphxClient` - Initialize SDK with app credentials
- `SylphxProvider` - React context provider with `platformMode` support
- `useSylphx` - Access SDK client from any component

#### Authentication (60+ hooks)
- `useSession` - Current user session
- `useUser` - Authenticated user data
- `useSignIn` - Email/password sign in
- `useSignUp` - User registration
- `useSignOut` - Session termination
- `useSocialAuth` - OAuth providers (Google, GitHub, Apple, etc.)
- `usePasskey` - WebAuthn passkey authentication
- `useMagicLink` - Passwordless email authentication
- `useOTP` - One-time password verification
- `useTwoFactor` - 2FA setup and verification
- `usePasswordReset` - Forgot password flow
- `useEmailChange` - Email update with verification
- `useUpdateProfile` - Profile data updates
- `useDeleteAccount` - Account deletion
- `useSessions` - Multi-session management
- `useDevices` - Device management
- `useOrganization` - Organization context
- `useTeamMembers` - Team member management
- `useInvitations` - Team invitations
- `useRoles` - Role-based access control

#### AI
- `useChat` - Conversational AI with streaming
- `useCompletion` - Text completion
- `useObject` - Structured AI output
- `useTokenUsage` - Token consumption tracking
- `useAIModels` - Available models list

#### Analytics
- `useTrack` - Event tracking
- `useIdentify` - User identification
- `usePage` - Page view tracking
- `useAnalyticsEnabled` - Privacy controls

#### Billing
- `useSubscription` - Current subscription status
- `usePlans` - Available pricing plans
- `useCheckout` - Stripe checkout
- `usePortal` - Customer portal
- `useUsage` - Usage metrics
- `useInvoices` - Invoice history

#### Storage
- `useUpload` - File upload with progress
- `useDownload` - File download
- `useFiles` - File listing
- `useAvatarUpload` - Profile image upload

#### Feature Flags
- `useFlag` - Single flag evaluation
- `useFlags` - Multiple flags
- `useFlagLoading` - Loading state
- `useExperiment` - A/B testing

#### Notifications
- `useNotifications` - Notification list
- `useUnreadCount` - Unread badge count
- `useMarkAsRead` - Mark notifications read
- `usePushPermission` - Push notification setup

#### Jobs
- `useJob` - Job status polling
- `useJobSubmit` - Submit background job
- `useJobHistory` - Job execution history

#### Config
- `useConfig` - Remote configuration
- `useConfigValue` - Single config value

### Components (40+)
- `AuthGuard` - Protected route wrapper
- `SignInForm` - Pre-built sign in UI
- `SignUpForm` - Pre-built registration UI
- `UserButton` - User menu dropdown
- `UserAvatar` - Profile image with fallback
- `OrganizationSwitcher` - Org context switcher
- `ChatInterface` - AI chat UI
- `FileUploader` - Drag-drop file upload
- `NotificationBell` - Notification indicator
- `SubscriptionCard` - Plan display

### Server-Side
- `createServerClient` - Server-side SDK client
- `withAuth` - Next.js middleware for auth
- `getSession` - Server-side session retrieval
- `validateWebhook` - Webhook signature verification

### Security
- HTTP-only cookie authentication
- CSRF protection
- Rate limiting integration
- Webhook signature validation

[Unreleased]: https://github.com/sylphx/sdk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sylphx/sdk/releases/tag/v0.1.0

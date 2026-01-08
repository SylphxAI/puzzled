export {
	SettingsHeader,
	SettingsSearch,
	SettingsSearchTrigger,
	SettingsSidebar,
	useSettingsSearch,
} from './components'

// Validation limits (SSOT)
export { LIMITS } from './lib/constants'

// Security alerts service (handles email notifications internally for critical alerts)
export { createSecurityAlert, type SecurityAlertMetadata } from './lib/security-alerts'
// Re-export search utilities
export { type SettingItem, type SettingSection, searchSettings } from './lib/settings-search'

// Suspicious login detection
export {
	detectSuspiciousLogin,
	type SuspiciousLoginResult,
	type SuspiciousReason,
	shouldTriggerSuspiciousAlert,
} from './lib/suspicious-login-detection'

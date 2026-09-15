export { BottomNav } from './bottom-nav'
export { Header } from './header'
export { LanguageSwitcher } from './language-switcher'
export { Logo } from './logo'
export { SettingsPageHeader } from './settings-page-header'
export { TopNav } from './top-nav'

/**
 * Footer is intentionally not re-exported here: it reads the game registry
 * (server-only) and this barrel is imported from client components.
 * Import it directly from '@/shared/components/layout/footer'.
 *
 * Error Boundary - Use SDK's version directly
 * @example import { ErrorBoundary } from '@/lib/identity/react'
 */

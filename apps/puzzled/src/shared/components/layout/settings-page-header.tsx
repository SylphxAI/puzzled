import type { LucideIcon } from 'lucide-react'

type SettingsPageHeaderProps = {
	icon: LucideIcon
	/** CSS classes for gradient background (include full class names for Tailwind) */
	gradientClasses: string
	/** CSS classes for icon color */
	iconColorClass: string
	title: string
	description: string
}

/**
 * Reusable header component for settings pages.
 *
 * Provides consistent styling across all settings sections with:
 * - Gradient icon badge
 * - Title and description
 *
 * @example
 * ```tsx
 * <SettingsPageHeader
 *   icon={UserCircle}
 *   gradientClasses="from-rose-500/20 to-pink-500/20"
 *   iconColorClass="text-rose-500"
 *   title={t('profile.title')}
 *   description={t('profile.description')}
 * />
 * ```
 */
export function SettingsPageHeader({
	icon: Icon,
	gradientClasses,
	iconColorClass,
	title,
	description,
}: SettingsPageHeaderProps) {
	return (
		<div className="flex items-center gap-3">
			<div
				className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradientClasses}`}
			>
				<Icon className={`h-6 w-6 ${iconColorClass}`} />
			</div>
			<div>
				<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
		</div>
	)
}

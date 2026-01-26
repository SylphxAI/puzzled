'use client'

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Icon,
} from '@sylphx/ui'
import { Check, ChevronDown, Globe, Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import {
	type Locale,
	localeCountryCodes,
	localeGroups,
	localeNames,
	localeShortNames,
	locales,
} from '@/lib/i18n/config'
import { usePathname, useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

// ==========================================
// Language Switcher Component
// ==========================================

interface LanguageSwitcherProps {
	/** Show as full button with text instead of icon-only */
	variant?: 'icon' | 'button' | 'inline'
	/** Additional class names */
	className?: string
}

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
	const t = useTranslations('common')
	const locale = useLocale() as Locale
	const router = useRouter()
	const pathname = usePathname()
	const [isPending, startTransition] = useTransition()

	const handleLocaleChange = (newLocale: Locale) => {
		if (newLocale === locale) return

		startTransition(() => {
			// Update URL with new locale
			router.replace(pathname, { locale: newLocale })

			// Store preference in cookie for returning visitors
			document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
		})
	}

	// Icon-only trigger (for header/navbar)
	if (variant === 'icon') {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className={cn(
							'relative h-10 w-10 rounded-full',
							'hover:bg-muted',
							isPending && 'pointer-events-none opacity-50',
							className,
						)}
						aria-label={t('changeLanguage')}
					>
						<Icon
							icon={`circle-flags:${localeCountryCodes[locale]}`}
							className="h-5 w-5"
							aria-hidden="true"
						/>
						{isPending && (
							<span className="absolute inset-0 flex items-center justify-center">
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							</span>
						)}
					</Button>
				</DropdownMenuTrigger>
				<LanguageDropdownContent
					currentLocale={locale}
					onSelect={handleLocaleChange}
					isPending={isPending}
				/>
			</DropdownMenu>
		)
	}

	// Button trigger with text (for settings page)
	if (variant === 'button') {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						className={cn(
							'h-11 min-w-[180px] justify-between gap-3 px-4',
							isPending && 'pointer-events-none opacity-50',
							className,
						)}
						aria-label={t('changeLanguage')}
					>
						<span className="flex items-center gap-3">
							<Icon
								icon={`circle-flags:${localeCountryCodes[locale]}`}
								className="h-5 w-5 shrink-0"
								aria-hidden="true"
							/>
							<span className="truncate">{localeNames[locale]}</span>
						</span>
						<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
				<LanguageDropdownContent
					currentLocale={locale}
					onSelect={handleLocaleChange}
					isPending={isPending}
				/>
			</DropdownMenu>
		)
	}

	// Inline variant (for inline text with current language)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium',
						'text-primary underline-offset-4 hover:underline',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						isPending && 'pointer-events-none opacity-50',
						className,
					)}
					aria-label={t('changeLanguage')}
				>
					<Icon
						icon={`circle-flags:${localeCountryCodes[locale]}`}
						className="h-4 w-4"
						aria-hidden="true"
					/>
					<span>{localeShortNames[locale]}</span>
				</button>
			</DropdownMenuTrigger>
			<LanguageDropdownContent
				currentLocale={locale}
				onSelect={handleLocaleChange}
				isPending={isPending}
			/>
		</DropdownMenu>
	)
}

// ==========================================
// Dropdown Content
// ==========================================

interface LanguageDropdownContentProps {
	currentLocale: Locale
	onSelect: (locale: Locale) => void
	isPending: boolean
}

function LanguageDropdownContent({
	currentLocale,
	onSelect,
	isPending,
}: LanguageDropdownContentProps) {
	const t = useTranslations('common')

	return (
		<DropdownMenuContent align="end" className="w-64 p-2" sideOffset={8}>
			{/* Header */}
			<div className="mb-2 flex items-center gap-2 px-2 py-1.5">
				<Languages className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">{t('selectLanguage')}</span>
			</div>

			<DropdownMenuSeparator />

			{/* English Group */}
			<DropdownMenuGroup>
				<DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
					English
				</DropdownMenuLabel>
				{localeGroups.english.map((loc) => (
					<LanguageMenuItem
						key={loc}
						locale={loc}
						isSelected={currentLocale === loc}
						onSelect={onSelect}
						disabled={isPending}
					/>
				))}
			</DropdownMenuGroup>

			<DropdownMenuSeparator className="my-2" />

			{/* Chinese Group */}
			<DropdownMenuGroup>
				<DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
					中文
				</DropdownMenuLabel>
				{localeGroups.chinese.map((loc) => (
					<LanguageMenuItem
						key={loc}
						locale={loc}
						isSelected={currentLocale === loc}
						onSelect={onSelect}
						disabled={isPending}
					/>
				))}
			</DropdownMenuGroup>

			{/* Footer note */}
			<DropdownMenuSeparator className="my-2" />
			<p className="px-2 py-1.5 text-xs text-muted-foreground">{t('languageChangeNote')}</p>
		</DropdownMenuContent>
	)
}

// ==========================================
// Menu Item
// ==========================================

interface LanguageMenuItemProps {
	locale: Locale
	isSelected: boolean
	onSelect: (locale: Locale) => void
	disabled?: boolean
}

function LanguageMenuItem({ locale, isSelected, onSelect, disabled }: LanguageMenuItemProps) {
	return (
		<DropdownMenuItem
			className={cn(
				'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
				'focus:bg-accent',
				isSelected && 'bg-accent/50',
			)}
			onSelect={() => onSelect(locale)}
			disabled={disabled}
		>
			<Icon
				icon={`circle-flags:${localeCountryCodes[locale]}`}
				className="h-5 w-5 shrink-0"
				aria-hidden="true"
			/>
			<div className="flex flex-1 flex-col gap-0.5">
				<span className={cn('text-sm', isSelected && 'font-medium')}>{localeNames[locale]}</span>
				{/* Show region hint for Chinese variants */}
				{locale === 'zh-HK' && <span className="text-xs text-muted-foreground">Hong Kong</span>}
				{locale === 'zh-TW' && <span className="text-xs text-muted-foreground">Taiwan</span>}
				{locale === 'zh-CN' && (
					<span className="text-xs text-muted-foreground">Mainland China</span>
				)}
			</div>
			{isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
		</DropdownMenuItem>
	)
}

// ==========================================
// Compact Language Indicator
// ==========================================

/**
 * Simple language indicator showing current locale flag
 * Use in mobile headers or tight spaces
 */
function LanguageIndicator({ className }: { className?: string }) {
	const locale = useLocale() as Locale

	return (
		<div className={cn('flex items-center gap-1.5', className)}>
			<Icon
				icon={`circle-flags:${localeCountryCodes[locale]}`}
				className="h-4 w-4"
				aria-hidden="true"
			/>
			<span className="text-xs font-medium uppercase text-muted-foreground">
				{locale.split('-')[1] || locale}
			</span>
		</div>
	)
}

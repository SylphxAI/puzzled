'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@sylphx/ui'
import { Check, Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactElement } from 'react'
import { type Locale, localeBadges, localeGroups, localeNames } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

/**
 * The language menu itself. Kept out of the switcher so the dropdown runtime
 * (Base UI, floating-ui, motion) is fetched when a visitor reaches for the
 * menu, not with every page: see `language-switcher.tsx`.
 */
export default function LanguageMenu({
	trigger,
	currentLocale,
	onSelect,
	isPending,
}: {
	trigger: ReactElement
	currentLocale: Locale
	onSelect: (locale: Locale) => void
	isPending: boolean
}) {
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<LanguageDropdownContent
				currentLocale={currentLocale}
				onSelect={onSelect}
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

			<DropdownMenuSeparator className="my-2" />

			{/* Other languages: each is listed in its own language */}
			<DropdownMenuGroup>
				<DropdownMenuLabel className="px-2 text-xs font-normal text-muted-foreground">
					More languages
				</DropdownMenuLabel>
				{localeGroups.other.map((loc) => (
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
			<span className="flex h-6 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
				{localeBadges[locale]}
			</span>
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

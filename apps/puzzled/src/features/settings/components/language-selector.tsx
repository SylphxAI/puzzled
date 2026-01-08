'use client'

import { Check, ChevronDown, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { type Locale, localeCountryCodes, localeNames, locales } from '@/lib/i18n/config'
import { usePathname, useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import {
	ConfirmDialog,
	Icon,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/shared/components/ui'

/**
 * LanguageSelector - Elegant language selector for settings page
 *
 * A refined, inline language selector with beautiful dropdown.
 * Shows current language with flag, expands to show all options.
 */
export function LanguageSelector() {
	const t = useTranslations('common')
	const locale = useLocale() as Locale
	const router = useRouter()
	const pathname = usePathname()
	const [open, setOpen] = useState(false)
	const [isChanging, setIsChanging] = useState(false)
	const [confirmOpen, setConfirmOpen] = useState(false)
	const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)

	const handleLocaleSelect = useCallback(
		(newLocale: Locale) => {
			if (newLocale === locale) {
				setOpen(false)
				return
			}
			// Show confirmation dialog before switching
			setPendingLocale(newLocale)
			setOpen(false)
			setConfirmOpen(true)
		},
		[locale],
	)

	const handleConfirmChange = useCallback(() => {
		if (!pendingLocale) return
		setIsChanging(true)
		// Small delay for visual feedback
		setTimeout(() => {
			router.replace(pathname, { locale: pendingLocale })
		}, 150)
	}, [pendingLocale, pathname, router])

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						role="combobox"
						aria-expanded={open}
						aria-haspopup="listbox"
						aria-label={t('changeLanguage')}
						disabled={isChanging}
						className={cn(
							'group flex h-11 min-w-[180px] items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 text-left transition-all duration-200',
							'hover:border-primary/40 hover:bg-muted/50',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
							'disabled:pointer-events-none disabled:opacity-60',
							open && 'border-primary/40 bg-muted/50 ring-2 ring-primary/20',
						)}
					>
						{/* Current language flag */}
						<span className="relative flex h-6 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px] shadow-sm ring-1 ring-black/10 dark:ring-white/10">
							<Icon
								icon={`flagpack:${localeCountryCodes[locale]}`}
								aria-hidden="true"
								className="h-full w-full"
							/>
						</span>

						{/* Current language name */}
						<span className="flex-1 truncate text-sm font-medium">{localeNames[locale]}</span>

						{/* Chevron indicator */}
						<ChevronDown
							className={cn(
								'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
								open && 'rotate-180 text-primary',
							)}
						/>
					</button>
				</PopoverTrigger>

				<PopoverContent
					align="end"
					sideOffset={8}
					className={cn(
						'w-[280px] overflow-hidden rounded-2xl border-border/50 p-0 shadow-xl shadow-black/10',
						'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
					)}
				>
					{/* Header */}
					<div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
							<Globe className="h-4 w-4 text-primary" />
						</div>
						<div>
							<p className="text-sm font-semibold">{t('selectLanguage')}</p>
							<p className="text-xs text-muted-foreground">
								{locales.length} {t('languagesAvailable')}
							</p>
						</div>
					</div>

					{/* Language list */}
					<div
						role="listbox"
						aria-label={t('selectLanguage')}
						className="max-h-[320px] overflow-y-auto overscroll-contain p-2"
					>
						{locales.map((loc, index) => {
							const isSelected = locale === loc
							return (
								<button
									key={loc}
									type="button"
									role="option"
									aria-selected={isSelected}
									onClick={() => handleLocaleSelect(loc)}
									className={cn(
										'group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
										'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
										isSelected && 'bg-primary/5',
									)}
									style={{
										animationDelay: `${index * 20}ms`,
									}}
								>
									{/* Flag */}
									<span
										className={cn(
											'relative flex h-7 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[5px] shadow-sm ring-1 transition-all duration-150',
											isSelected
												? 'ring-primary/50 shadow-primary/20'
												: 'ring-black/10 dark:ring-white/10 group-hover/item:ring-primary/30',
										)}
									>
										<Icon
											icon={`flagpack:${localeCountryCodes[loc]}`}
											aria-hidden="true"
											className="h-full w-full"
										/>
									</span>

									{/* Language name */}
									<span
										className={cn(
											'flex-1 text-sm transition-colors duration-150',
											isSelected ? 'font-semibold text-primary' : 'font-medium',
										)}
									>
										{localeNames[loc]}
									</span>

									{/* Check indicator */}
									<span
										className={cn(
											'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
											isSelected
												? 'bg-primary text-primary-foreground scale-100'
												: 'bg-transparent scale-75 opacity-0 group-hover/item:bg-muted-foreground/10 group-hover/item:scale-100 group-hover/item:opacity-100',
										)}
									>
										<Check className="h-3 w-3" strokeWidth={3} />
									</span>
								</button>
							)
						})}
					</div>

					{/* Footer hint */}
					<div className="border-t border-border/50 bg-muted/20 px-4 py-2.5">
						<p className="text-center text-xs text-muted-foreground">{t('languageChangeNote')}</p>
					</div>
				</PopoverContent>
			</Popover>

			{/* Confirmation dialog for language change */}
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={(open) => {
					setConfirmOpen(open)
					if (!open) setPendingLocale(null)
				}}
				title={t('confirmLanguageChange')}
				description={
					pendingLocale
						? t('confirmLanguageChangeDescription', {
								language: localeNames[pendingLocale],
							})
						: ''
				}
				confirmLabel={t('switchLanguage')}
				cancelLabel={t('cancel')}
				onConfirm={handleConfirmChange}
			/>
		</>
	)
}

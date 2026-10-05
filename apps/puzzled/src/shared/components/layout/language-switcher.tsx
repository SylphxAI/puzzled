'use client'

import { Button } from '@sylphx/ui'
import { ChevronDown, Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { lazy, Suspense, useTransition } from 'react'
import { type Locale, localeNames, localeShortNames } from '@/lib/i18n/config'
import { usePathname, useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { useLazyMenu } from './use-lazy-menu'

// The dropdown runtime is fetched when a visitor reaches for the menu; until
// then the page carries only the trigger below. `ssr` never applies: the menu
// only mounts after a press.
const loadMenu = () => import('./language-switcher-menu')
const LanguageMenu = lazy(loadMenu)

// ==========================================
// Language Switcher Component
// ==========================================

interface LanguageSwitcherProps {
	/** Show as full button with text instead of icon-only */
	variant?: 'icon' | 'button' | 'inline'
	/** Render for a dark (ink) background such as the footer. */
	tone?: 'default' | 'inverse'
	/** Additional class names */
	className?: string
}

export function LanguageSwitcher({
	variant = 'icon',
	tone = 'default',
	className,
}: LanguageSwitcherProps) {
	const t = useTranslations('common')
	const locale = useLocale() as Locale
	const router = useRouter()
	const pathname = usePathname()
	const [isPending, startTransition] = useTransition()
	const { opened, triggerProps } = useLazyMenu(loadMenu)

	const handleLocaleChange = (newLocale: Locale) => {
		if (newLocale === locale) return

		startTransition(() => {
			// Update URL with new locale
			router.replace(pathname, { locale: newLocale })

			// Store preference in cookie for returning visitors
			// biome-ignore lint/suspicious/noDocumentCookie: locale preference must be set client-side as a simple cookie for the proxy to read before JS hydration
			document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
		})
	}

	const trigger = (extra?: Record<string, unknown>) => {
		// Icon-only trigger (for header/navbar)
		if (variant === 'icon') {
			return (
				<Button
					variant="ghost"
					size="icon"
					className={cn(
						'relative h-11 w-11 rounded-full',
						'hover:bg-muted',
						isPending && 'pointer-events-none opacity-50',
						className,
					)}
					aria-label={t('changeLanguage')}
					{...extra}
				>
					<Languages className="h-5 w-5" aria-hidden="true" />
					{isPending && (
						<span className="absolute inset-0 flex items-center justify-center">
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						</span>
					)}
				</Button>
			)
		}

		// Button trigger with text (for settings page)
		if (variant === 'button') {
			return (
				<Button
					variant="outline"
					className={cn(
						'h-11 min-w-[180px] justify-between gap-3 px-4',
						tone === 'inverse' &&
							'border-white/25 bg-transparent text-white hover:border-white/40 hover:bg-white/10',
						isPending && 'pointer-events-none opacity-50',
						className,
					)}
					// WCAG 2.5.3: the name starts with the visible label.
					aria-label={`${localeNames[locale]}, ${t('changeLanguage')}`}
					{...extra}
				>
					<span className="flex items-center gap-3">
						<Languages className="h-5 w-5 shrink-0" aria-hidden="true" />
						<span className="truncate">{localeNames[locale]}</span>
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
				</Button>
			)
		}

		// Inline variant (for inline text with current language)
		return (
			<button
				type="button"
				className={cn(
					'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium',
					'text-primary underline-offset-4 hover:underline',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					isPending && 'pointer-events-none opacity-50',
					className,
				)}
				aria-label={`${localeShortNames[locale]}, ${t('changeLanguage')}`}
				{...extra}
			>
				<Languages className="h-4 w-4" aria-hidden="true" />
				<span>{localeShortNames[locale]}</span>
			</button>
		)
	}

	const plainTrigger = trigger(triggerProps)
	if (!opened) return plainTrigger

	return (
		<Suspense fallback={plainTrigger}>
			<LanguageMenu
				trigger={trigger()}
				currentLocale={locale}
				onSelect={handleLocaleChange}
				isPending={isPending}
			/>
		</Suspense>
	)
}

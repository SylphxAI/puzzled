'use client'

import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'
import { currencyOptionLabel, serializeCurrencyCookie } from '@/lib/billing/currency'
import { cn } from '@/lib/utils'
import styles from './pricing.module.css'

type Props = {
	currencies: string[]
	current: string
	/** Compact inline selector for tight above-the-fold unlock cards. */
	compact?: boolean
}

/**
 * Switches the pricing currency among those the catalogue publishes. The choice
 * is a strictly necessary preference cookie (like language and theme), so the
 * server renders the right prices on the next request with no flash.
 */
export function CurrencySwitcher({ currencies, current, compact = false }: Props) {
	const t = useTranslations('plus.pricing')
	const locale = useLocale()
	const router = useRouter()
	const selectId = useId()
	if (currencies.length < 2) return null

	const choose = (code: string) => {
		if (!code || code === current) return
		// biome-ignore lint/suspicious/noDocumentCookie: strictly necessary preference; the server reads it to render prices
		document.cookie = serializeCurrencyCookie(code, window.location.protocol === 'https:')
		router.refresh()
	}

	return (
		<fieldset
			className={cn(
				'flex min-w-0 max-w-full items-center border-0 p-0',
				compact ? 'shrink-0 gap-1.5' : 'gap-3',
				!compact && styles.currency,
			)}
		>
			<legend className="sr-only">{t('currencyLabel')}</legend>
			<label
				htmlFor={selectId}
				className={compact ? 'sr-only' : 'shrink-0 text-sm text-muted-foreground'}
			>
				{t('currencyLabel')}
			</label>
			<div className="relative min-w-0 max-w-full">
				<select
					id={selectId}
					value={current}
					onChange={(event) => choose(event.target.value)}
					className={cn(
						'cursor-pointer appearance-none truncate rounded-xl border border-border bg-card font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
						compact
							? 'min-h-11 max-w-[10.5rem] py-1.5 pl-2.5 pr-8 text-xs'
							: 'min-h-12 w-full max-w-[min(18rem,calc(100vw-8.5rem))] py-2 pl-3.5 pr-9 text-sm',
					)}
				>
					{currencies.map((code) => (
						<option key={code} value={code}>
							{currencyOptionLabel(code, locale)}
						</option>
					))}
				</select>
				<ChevronDown
					aria-hidden="true"
					className={cn(
						'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
						compact ? 'right-2.5' : 'right-3',
					)}
				/>
			</div>
		</fieldset>
	)
}

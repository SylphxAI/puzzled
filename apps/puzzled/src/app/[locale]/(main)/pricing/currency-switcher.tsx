'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { serializeCurrencyCookie } from '@/lib/billing/currency'
import { cn } from '@/lib/utils'

type Props = {
	currencies: string[]
	current: string
}

/**
 * Switches the pricing currency among those the catalogue publishes. The choice
 * is a strictly necessary preference cookie (like language and theme), so the
 * server renders the right prices on the next request with no flash.
 */
export function CurrencySwitcher({ currencies, current }: Props) {
	const t = useTranslations('plus.pricing')
	const router = useRouter()
	if (currencies.length < 2) return null

	const choose = (code: string) => {
		if (code === current) return
		// biome-ignore lint/suspicious/noDocumentCookie: strictly necessary preference; the server reads it to render prices
		document.cookie = serializeCurrencyCookie(code, window.location.protocol === 'https:')
		router.refresh()
	}

	return (
		<fieldset className="mb-5 flex items-center gap-3 border-0 p-0">
			<legend className="sr-only">{t('currencyLabel')}</legend>
			<span className="text-sm text-muted-foreground" aria-hidden="true">
				{t('currencyLabel')}
			</span>
			<div className="inline-flex rounded-full border border-border bg-card p-1">
				{currencies.map((code) => (
					<button
						key={code}
						type="button"
						aria-pressed={code === current}
						onClick={() => choose(code)}
						className={cn(
							'min-h-11 min-w-14 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
							code === current
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted',
						)}
					>
						{code.toUpperCase()}
					</button>
				))}
			</div>
		</fieldset>
	)
}

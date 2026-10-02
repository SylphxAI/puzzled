'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { canStoreMarketing, onConsentChange } from '@/features/analytics/lib/consent'
import { type AdsConfig, adScriptSrc } from '@/lib/ads'
import { useAdsConfig } from './ad-context'

declare global {
	interface Window {
		adsbygoogle?: unknown[]
	}
}

/**
 * One ad unit, labelled. Renders nothing unless ads are configured, the viewer
 * has no Puzzled Plus and the visitor accepted cookies. Place it only on the
 * archive index and the result screen, never inside a puzzle.
 *
 * `config` is passed by server pages; result screens omit it and read the
 * provider the game page wraps around them.
 */
export function AdSlot({ config }: { config?: AdsConfig | null }) {
	const fromContext = useAdsConfig()
	const ads = config ?? fromContext
	const t = useTranslations('common')
	const [consented, setConsented] = useState(false)
	const pushed = useRef(false)

	useEffect(() => {
		// AdSense is advertising: it needs the advertising choice, not analytics.
		setConsented(canStoreMarketing())
		return onConsentChange(() => setConsented(canStoreMarketing()))
	}, [])

	useEffect(() => {
		if (!ads || !consented || pushed.current) return
		pushed.current = true
		loadAdScript(ads)
		try {
			window.adsbygoogle = window.adsbygoogle ?? []
			window.adsbygoogle.push({})
		} catch {
			// An ad that fails to load leaves an empty box, never an error.
		}
	}, [ads, consented])

	if (!ads || !consented) return null
	return (
		<aside aria-label={t('advertisement')} className="w-full text-center">
			<p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
				{t('advertisement')}
			</p>
			<ins
				className="adsbygoogle block min-h-[90px] w-full"
				data-ad-client={ads.clientId}
				data-ad-slot={ads.slotId}
				data-ad-format="auto"
				data-full-width-responsive="true"
			/>
		</aside>
	)
}

/**
 * Adds the loader once. A script inserted by our own nonced code is trusted by
 * `strict-dynamic`, so the policy needs no ad host in `script-src`.
 */
function loadAdScript({ clientId }: AdsConfig) {
	const src = adScriptSrc(clientId)
	if (document.querySelector(`script[src="${src}"]`)) return
	const script = document.createElement('script')
	script.async = true
	script.crossOrigin = 'anonymous'
	script.src = src
	document.head.appendChild(script)
}

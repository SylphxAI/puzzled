'use client'

import { useEffect } from 'react'
import { markStartIntent, START_INTENT_ATTRIBUTE } from '@/features/daily/lib/start-intent'

/**
 * Records a press on any Play link marked `data-start-intent="<slug>"`, so
 * the game page it opens can start the board without asking again. One
 * delegated listener; the links themselves stay server-rendered.
 */
export function StartIntentListener() {
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
			const target = event.target instanceof Element ? event.target : null
			const link = target?.closest(`a[${START_INTENT_ATTRIBUTE}]`)
			const slug = link?.getAttribute(START_INTENT_ATTRIBUTE)
			if (slug) markStartIntent(slug)
		}
		document.addEventListener('click', onClick, true)
		return () => document.removeEventListener('click', onClick, true)
	}, [])
	return null
}

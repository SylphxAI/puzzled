'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
	canStoreMarketing,
	canTrackAnalytics,
	onConsentChange,
} from '@/features/analytics/lib/consent'
import {
	createGoogleTag,
	type GoogleTagController,
	type GoogleTagIds,
	setActiveGoogleTag,
	type TagDocument,
	type TagWindow,
} from '@/features/analytics/lib/google-tag'

/**
 * Wires the Google tag to the cookie choice. Mounted only when an id is
 * configured. It loads nothing until the visitor has granted analytics or
 * marketing, reacts to a changed choice, and reports page views for public
 * routes only. Renders nothing.
 */
export function GoogleTag({ ids }: { ids: GoogleTagIds }) {
	const pathname = usePathname()
	const controller = useRef<GoogleTagController | null>(null)
	const pathRef = useRef(pathname)
	pathRef.current = pathname

	useEffect(() => {
		const tag = createGoogleTag({
			ids: { ga: ids.ga, ads: ids.ads },
			win: window as unknown as TagWindow,
			doc: document as unknown as TagDocument,
			consent: () => ({ analytics: canTrackAnalytics(), marketing: canStoreMarketing() }),
		})
		controller.current = tag
		setActiveGoogleTag(tag)
		tag.sync()
		tag.pageView(pathRef.current)
		const off = onConsentChange(() => {
			tag.sync()
			tag.pageView(pathRef.current)
		})
		return () => {
			off()
			setActiveGoogleTag(null)
			controller.current = null
		}
	}, [ids.ga, ids.ads])

	useEffect(() => {
		controller.current?.pageView(pathname)
	}, [pathname])

	return null
}

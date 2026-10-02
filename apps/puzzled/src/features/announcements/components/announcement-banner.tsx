'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
	addDismissed,
	DISMISSED_COOKIE,
	parseDismissed,
	serializeDismissedCookie,
} from '../lib/dismissed'
import type { BannerAnnouncement } from '../lib/visible'

const TONE: Record<string, string> = {
	info: 'border-border bg-muted/40',
	success: 'border-success/40 bg-success/10',
	warning: 'border-warning/50 bg-warning/10',
	maintenance: 'border-warning/50 bg-warning/10',
}

/**
 * A site-wide notice an admin wrote (the copy is the announcement row, never
 * code). The server renders it in the document flow and leaves a dismissed one
 * out, so it neither appears on hydration nor shifts the page; with nothing to
 * show the parent renders no element and reserves no space. Dismissing is the
 * visitor's own action and is remembered in a strictly necessary cookie.
 */
export function AnnouncementBanner({ items }: { items: BannerAnnouncement[] }) {
	const t = useTranslations('announcements')
	const [hidden, setHidden] = useState<readonly string[]>([])
	const [focusId, setFocusId] = useState<string | null>(null)
	const shown = items.filter((item) => !hidden.includes(item.id))

	// The dismissed notice's button is gone: focus the next notice's button if
	// one is left, otherwise the page.
	useEffect(() => {
		if (focusId === null) return
		const next = document.querySelector<HTMLElement>(`[data-announcement="${focusId}"] button`)
		;(next ?? document.getElementById('main-content'))?.focus()
		setFocusId(null)
	}, [focusId])

	if (shown.length === 0) return null

	function dismiss(id: string) {
		// biome-ignore lint/suspicious/noDocumentCookie: strictly necessary UI state; Cookie Store API is not universal
		document.cookie = serializeDismissedCookie(
			addDismissed(parseDismissed(readCookie()), id),
			window.location.protocol === 'https:',
		)
		const index = shown.findIndex((item) => item.id === id)
		const remaining = shown.filter((item) => item.id !== id)
		const next = remaining
			.slice(index)
			.concat(remaining.slice(0, index))
			.find((i) => i.dismissible)
		setHidden((current) => [...current, id])
		setFocusId(next?.id ?? '')
	}

	return (
		<section aria-label={t('region')} className="page-shell-wide flex flex-col gap-2 pt-3">
			{shown.map((item) => (
				<div
					key={item.id}
					data-announcement={item.id}
					className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-foreground ${
						TONE[item.type] ?? TONE.info
					}`}
				>
					<div className="min-w-0 flex-1">
						<p className="font-semibold">{item.title}</p>
						<p className="mt-0.5 whitespace-pre-line text-foreground/85">{item.body}</p>
					</div>
					{item.dismissible ? (
						<button
							type="button"
							onClick={() => dismiss(item.id)}
							aria-label={t('dismiss', { title: item.title })}
							className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X aria-hidden="true" className="h-4 w-4" />
						</button>
					) : null}
				</div>
			))}
		</section>
	)
}

function readCookie(): string | null {
	const match = document.cookie.split('; ').find((part) => part.startsWith(`${DISMISSED_COOKIE}=`))
	return match ? match.slice(match.indexOf('=') + 1) : null
}

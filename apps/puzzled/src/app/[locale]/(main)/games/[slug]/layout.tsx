import type { ReactNode } from 'react'
import { requireGamePage } from '@/features/catalog/lib/game-page'

type Props = {
	children: ReactNode
	params: Promise<{ locale: string; slug: string }>
}

/**
 * Module segment guard.
 *
 * The registry decides which slugs exist. The check runs in the layout rather
 * than only in the page because the group's `loading.tsx` streams a shell
 * before a page-level rejection can be raised — a rejection at segment level
 * happens while the router is still resolving the route, so an unknown slug
 * answers with a real 404 status instead of a 200 shell.
 */
export default async function GameSegmentLayout({ children, params }: Props) {
	const { slug } = await params
	requireGamePage(slug)

	return <>{children}</>
}

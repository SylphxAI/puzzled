// Isolated process: exercise the real result trees without leaking module mocks.

import { strict as assert } from 'node:assert'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../scripts/i18n-resolved-catalogue'
import { AlreadyCompletedView } from '../../src/features/daily/components/already-completed-view'
import { GameResultCard } from '../../src/features/daily/components/game-result'
import { PlusOfferProvider } from '../../src/features/plus-offer/components/plus-offer-context'
import { offerAccess, plusOfferFor } from '../../src/features/plus-offer/lib/plus-offer'

const dayKey = '2026-10-29'
const session = {
	status: 'won' as const,
	score: 100,
	attempts: 4,
	completedAt: new Date('2026-10-29T03:00:00Z'),
}
const input = { gameCount: 19, freeSlug: 'word-groups' }
const decisions = {
	guest: offerAccess(false, 'failed', true),
	account: offerAccess(true, { salesOpen: true, entitled: false }, 'failed'),
	closed: offerAccess(false, 'failed', false),
	unknownGuest: offerAccess(false, 'failed', 'failed'),
	unknownAccount: offerAccess(true, 'failed', true),
	entitled: offerAccess(true, { salesOpen: true, entitled: true }, true),
}
const rows = []
const baselines = new Map<string, string>()
for (const [decision, access] of Object.entries(decisions)) {
	for (const [run, mode, puzzleDate, gameSlug] of [
		['today', 'daily', dayKey, 'word-groups'],
		['archive', 'archive', dayKey, 'word-groups'],
		['earlier', 'daily', '2026-10-28', 'word-groups'],
		['otherGame', 'daily', dayKey, 'sudoku'],
	] as const) {
		for (const surface of ['first', 'reopened'] as const) {
			const result =
				surface === 'first'
					? createElement(GameResultCard, {
							gameType: gameSlug,
							status: session.status,
							stats: { attempts: session.attempts, score: session.score },
							mode,
							puzzleDate,
						})
					: createElement(AlreadyCompletedView, {
							gameSlug,
							gameName: 'Threads',
							puzzleDate,
							session,
							mode,
							currentStreak: 2,
						})
			const html = renderToStaticMarkup(
				<NextIntlClientProvider
					locale="en-US"
					messages={resolveLocale('en-US')}
					timeZone="Asia/Hong_Kong"
				>
					<QueryClientProvider client={new QueryClient()}>
						<PlusOfferProvider offer={plusOfferFor(access, input)} dayKey={dayKey}>
							{result}
						</PlusOfferProvider>
					</QueryClientProvider>
				</NextIntlClientProvider>,
			)
			// The offer changes nothing else in either result's saved facts or actions.
			const rest = html.replace(
				/<section aria-labelledby="plus-result-title"[\s\S]*?<\/section>/g,
				'',
			)
			const key = `${run}:${surface}`
			if (baselines.has(key)) assert.equal(rest, baselines.get(key))
			else baselines.set(key, rest)

			rows.push({
				decision,
				run,
				surface,
				cards: (html.match(/aria-labelledby="plus-result-title"/g) ?? []).length,
				pricing: (html.match(/href="[^"]*\/pricing"/g) ?? []).length,
				share: html.includes('Share'),
			})
		}
	}
}
console.log(JSON.stringify(rows))

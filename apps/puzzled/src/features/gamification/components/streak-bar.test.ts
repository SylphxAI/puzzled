import { describe, expect, test } from 'bun:test'
import { NextIntlClientProvider } from 'next-intl'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import streak from '@/messages/en-US/streak.json'
import { StreakBar } from './streak-bar'

const renderStreakBar = (props: Parameters<typeof StreakBar>[0]) =>
	renderToStaticMarkup(
		createElement(NextIntlClientProvider, {
			locale: 'en-US',
			timeZone: 'Asia/Hong_Kong',
			messages: { streak },
			// biome-ignore lint/correctness/noChildrenProp: NextIntlClientProvider requires children in its typed props.
			children: createElement(StreakBar, props),
		}),
	)

describe('StreakBar', () => {
	test('renders detailed milestone badge with inline SVG and no external icon fetch', () => {
		const html = renderStreakBar({ currentStreak: 7, bestStreak: 14, variant: 'detailed' })
		expect(html).toContain('7-Day Streak!')
		expect(html).toContain('<svg')
		expect(html).not.toContain('iconify')
		expect(html).toContain('role="progressbar"')
	})

	test('omits milestone badge between milestones while keeping progress bar', () => {
		const html = renderStreakBar({ currentStreak: 5, variant: 'detailed' })
		expect(html).not.toContain('-Day Streak!')
		expect(html).toContain('role="progressbar"')
	})
})

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import labels from '../../messages/en-US/offline.json'
import { OfflineView } from './offline-view'

describe('offline recovery', () => {
	test('explains the connection requirement without claiming offline play or saved progress', () => {
		const html = renderToStaticMarkup(<OfflineView labels={labels} />)
		expect(html).toContain('You’re offline')
		expect(html).toContain('Puzzles need an internet connection. Reconnect, then try again.')
		expect(html).not.toMatch(/saved|play offline|coming soon/i)
		expect(html.match(/<h1\b/g)).toHaveLength(1)
		expect(html.match(/<a\b/g)).toHaveLength(1)
		expect(html).toContain('href="/"')
		expect(html).toContain('Try again')
	})

	test('uses a native full navigation and preserves the chosen locale', () => {
		const html = renderToStaticMarkup(<OfflineView labels={labels} homeHref="/zh-HK" />)
		expect(html).toContain('href="/zh-HK"')
		expect(html).not.toMatch(/<script|onclick=/i)
	})
})

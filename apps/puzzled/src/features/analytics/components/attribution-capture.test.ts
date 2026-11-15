import { describe, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// AttributionCapture is mounted in LocaleLayout outside NextIntlClientProvider.
// Mock only next/navigation so any regression importing usePathname from
// @/lib/i18n/routing (or next-intl) immediately throws during render.
mock.module('next/navigation', () => ({
	usePathname: () => '/pricing',
	useSearchParams: () => new URLSearchParams('gclid=test_click_123'),
}))

const { AttributionCapture } = await import('./attribution-capture')

describe('AttributionCapture', () => {
	test('renders cleanly outside NextIntlClientProvider', () => {
		const html = renderToStaticMarkup(createElement(AttributionCapture))
		expect(html).toBe('')
	})
})

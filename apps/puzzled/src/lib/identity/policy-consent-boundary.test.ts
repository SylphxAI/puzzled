import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

function MockPolicyConsentGate({ children }: { children: ReactNode }) {
	return children
}

mock.module('next/navigation', () => ({
	usePathname: () => '/pricing',
}))

mock.module('./react', () => ({
	useSafeUser: () => ({ user: null, isLoaded: false }),
}))

mock.module('./policy-consent-gate', () => ({
	PolicyConsentGate: MockPolicyConsentGate,
}))

const { PolicyConsentBoundary } = await import('./policy-consent-boundary')

describe('PolicyConsentBoundary SSR', () => {
	test('renders children during SSR before session state resolves instead of blanking the document', () => {
		const html = renderToStaticMarkup(
			createElement(PolicyConsentBoundary, null, createElement('main', null, 'Pricing')),
		)
		expect(html).toContain('<main>Pricing</main>')
		expect(html).not.toContain('role="status"')
	})
})

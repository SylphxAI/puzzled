import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoundaryErrorView, type BoundaryErrorViewProps } from './boundary-error-view'

const boom = Object.assign(new Error('crossword hydrate failed'), { digest: 'abc123' })

const render = (props: Partial<BoundaryErrorViewProps> = {}) =>
	renderToStaticMarkup(
		createElement(BoundaryErrorView, {
			boundary: 'test',
			error: boom,
			reset: () => {},
			title: 'Something went wrong',
			description: 'Please try again.',
			retryLabel: 'Try again',
			...props,
		}),
	)

describe('BoundaryErrorView', () => {
	test('renders the resolved copy and the retry action', () => {
		const html = render()
		expect(html).toContain('Something went wrong')
		expect(html).toContain('Please try again.')
		expect(html).toContain('Try again')
	})

	test('shows the raw error detail only when a surface asks for it', () => {
		expect(render({ detail: boom.message })).toContain('crossword hydrate failed')
		expect(render()).not.toContain('crossword hydrate failed')
	})

	test('keeps extra actions after the retry button', () => {
		const html = render({ actions: createElement('a', { href: '/admin' }, 'Dashboard') })
		expect(html).toContain('Dashboard')
		expect(html.indexOf('Try again')).toBeLessThan(html.indexOf('Dashboard'))
	})
})

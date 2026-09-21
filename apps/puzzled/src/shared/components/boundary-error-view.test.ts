import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('error boundary wiring', () => {
	const appDir = join(import.meta.dir, '..', '..', 'app')

	/** Every `error.tsx` under the app router, at any nesting depth. */
	function boundaryFiles(dir: string): string[] {
		return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const path = join(dir, entry.name)
			if (entry.isDirectory()) return boundaryFiles(path)
			return entry.name === 'error.tsx' ? [path] : []
		})
	}

	test('every route error boundary renders and reports through the shared view', () => {
		const files = boundaryFiles(appDir)
		expect(files.length).toBeGreaterThanOrEqual(5)

		const withoutSharedView = files.filter(
			(path) => !readFileSync(path, 'utf8').includes('BoundaryErrorView'),
		)
		expect(withoutSharedView).toEqual([])

		// Reporting lives in the shared view now; a boundary calling the reporter
		// directly is exactly the duplication this row removed.
		const directReporters = files.filter((path) =>
			readFileSync(path, 'utf8').includes('reportBoundaryError'),
		)
		expect(directReporters).toEqual([])
	})
})

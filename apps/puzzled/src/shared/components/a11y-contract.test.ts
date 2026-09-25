import { describe, expect, test } from 'bun:test'
// Deep imports: the package barrel pulls every client surface (dialogs, sheet,
// toasts), which is unnecessary and slow for a server-rendered assertion.
import { FormFeedback, InlineFeedback } from '@sylphx/ui/components/form-feedback'
import { Input, Textarea } from '@sylphx/ui/components/input'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Contract the app expects from `@sylphx/ui` form primitives.
 *
 * Page owners inherit error announcement by using these components, so the
 * wiring is pinned here: a rendered error must be programmatically associated
 * (`aria-describedby`), must flip the field state (`aria-invalid`) and must be
 * announced (`role="alert"`). Without it a screen reader user gets a silent
 * failed submission (audit P1-5, WCAG 3.3.1 / 4.1.3).
 */

const render = (element: ReactElement) => renderToStaticMarkup(element)

describe('Input error contract', () => {
	test('associates and announces the error message', () => {
		const html = render(
			createElement(Input, { id: 'email', label: 'Email', error: 'Enter a valid email' }),
		)

		expect(html).toContain('aria-invalid="true"')
		expect(html).toContain('aria-describedby="email-error"')
		expect(html).toMatch(/id="email-error"[^>]*role="alert"/)
	})

	test('keeps the field valid and unassociated when there is no error', () => {
		const html = render(createElement(Input, { id: 'email', label: 'Email' }))

		expect(html).toContain('aria-invalid="false"')
		expect(html).not.toContain('aria-describedby')
		expect(html).not.toContain('role="alert"')
	})

	test('describes the field with the helper text when one is provided', () => {
		const html = render(
			createElement(Input, { id: 'email', label: 'Email', helperText: 'We never share it' }),
		)

		expect(html).toContain('aria-invalid="false"')
		expect(html).toContain('aria-describedby="email-helper"')
	})
})

describe('Textarea error contract', () => {
	test('associates and announces the error message', () => {
		const html = render(
			createElement(Textarea, { id: 'message', label: 'Message', error: 'Too short' }),
		)

		expect(html).toContain('aria-invalid="true"')
		expect(html).toContain('aria-describedby="message-error"')
		expect(html).toMatch(/id="message-error"[^>]*role="alert"/)
	})
})

describe('Form feedback contract', () => {
	test('announces errors assertively', () => {
		const html = render(createElement(FormFeedback, { error: 'Sign-in failed' }))

		expect(html).toContain('role="alert"')
		expect(html).toContain('aria-live="assertive"')
		expect(html).toContain('Sign-in failed')
	})

	test('announces non-errors politely', () => {
		const html = render(createElement(FormFeedback, { success: 'Saved' }))

		expect(html).toContain('role="status"')
		expect(html).toContain('aria-live="polite"')
	})

	test('renders nothing without a message', () => {
		expect(render(createElement(FormFeedback, {}))).toBe('')
	})

	test('inline feedback keeps the alert role for errors', () => {
		const html = render(createElement(InlineFeedback, { message: 'Required' }))

		expect(html).toContain('role="alert"')
		expect(html).toContain('Required')
	})
})

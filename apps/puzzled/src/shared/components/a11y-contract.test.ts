import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/**
 * Motion gating contract (WCAG 2.3.3, audit A6).
 *
 * Framer defaults to `reducedMotion: "never"`, so every file in `@sylphx/ui`
 * that renders Framer motion has to sit behind the package's
 * `MotionPreferences` (`MotionConfig reducedMotion="user"`) or gate its own
 * values through `useReducedMotion`. This guard fails the moment a new motion
 * surface is added without one of those — which is exactly how the gap
 * appeared in production.
 */
describe('Motion gating contract', () => {
	const UI_SRC = join(import.meta.dir, '../../../../../packages/ui/src')
	const GATE_MARKERS = ['MotionPreferences', 'useReducedMotion', 'MotionConfig']

	function sourceFiles(dir: string): string[] {
		return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const full = join(dir, entry.name)
			if (entry.isDirectory()) return sourceFiles(full)
			return /\.tsx?$/.test(entry.name) ? [full] : []
		})
	}

	/** Runtime (not type-only) `motion/react` imports mean the file renders motion. */
	function importsMotionRuntime(source: string): boolean {
		const withoutTypeImports = source.replace(
			/import\s+type\b[^;]*?from\s+["']motion\/react["'];?/g,
			'',
		)
		return /from\s+["']motion\/react["']/.test(withoutTypeImports)
	}

	test('every Framer motion surface is gated behind the reduced-motion preference', () => {
		const ungated = sourceFiles(UI_SRC)
			.map((file) => ({ file, source: readFileSync(file, 'utf8') }))
			.filter(({ source }) => importsMotionRuntime(source))
			.filter(({ source }) => !GATE_MARKERS.some((marker) => source.includes(marker)))
			.map(({ file }) => file.slice(UI_SRC.length + 1))

		expect(
			ungated,
			`packages/ui files rendering Framer motion without a reduced-motion gate: ${ungated.join(', ')}`,
		).toEqual([])
	})

	test('the gate uses Framer reducedMotion="user" rather than a hand-rolled stub', () => {
		const gate = readFileSync(join(UI_SRC, 'motion/motion-preferences.tsx'), 'utf8')

		expect(gate).toContain('MotionConfig')
		expect(gate).toContain('reducedMotion="user"')
	})
})

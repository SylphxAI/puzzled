import { describe, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN', 'ja', 'es', 'pt-BR'] as const

let catalogue: unknown = resolveLocale('en-US').settings

mock.module('next-intl', () => ({
	useTranslations: (namespace: string) => (key: string) => {
		let node: unknown = { [namespace]: catalogue }[namespace]
		for (const part of key.split('.')) {
			node = (node as Record<string, unknown> | undefined)?.[part]
		}
		if (typeof node !== 'string') throw new Error(`missing message: ${namespace}.${key}`)
		return node
	},
}))

const { AutoFreezeToggle } = await import('./auto-freeze-toggle')

function render(initialEnabled: boolean | null): string {
	return renderToStaticMarkup(createElement(AutoFreezeToggle, { initialEnabled }))
}

describe('AutoFreezeToggle', () => {
	test('renders a labelled switch reflecting the server state', () => {
		const on = render(true)
		expect(on).toContain('role="switch"')
		expect(on).toContain('aria-checked="true"')
		expect(on).toContain('aria-labelledby="auto-freeze-heading"')
		expect(on).toContain('Auto-freeze is ON')
		const off = render(false)
		expect(off).toContain('aria-checked="false"')
		expect(off).toContain('Auto-freeze is OFF')
	})

	test('an unreadable state shows a notice and no switch', () => {
		const html = render(null)
		expect(html).not.toContain('role="switch"')
		expect(html).toContain('role="alert"')
	})

	test('every shipped locale resolves every string the control uses', () => {
		for (const locale of LOCALES) {
			catalogue = resolveLocale(locale).settings
			expect(() => render(true)).not.toThrow()
			expect(() => render(null)).not.toThrow()
			const s = catalogue as { preferences: { streakFreeze: Record<string, string> } }
			expect(typeof s.preferences.streakFreeze.saveFailed).toBe('string')
		}
		catalogue = resolveLocale('en-US').settings
	})
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import enGBSettings from '../../../messages/en-GB/settings.json'
import enUSSettings from '../../../messages/en-US/settings.json'
import zhCNSettings from '../../../messages/zh-CN/settings.json'
import zhHKSettings from '../../../messages/zh-HK/settings.json'
import zhTWSettings from '../../../messages/zh-TW/settings.json'

/**
 * The console's push panel (S2 audit, console finding 2 + 3).
 *
 * The panel was hardcoded English and its main toggle was a bare \`<button>\`
 * whose only child is a decorative \`<span>\`, so it reached the accessibility
 * tree unnamed. Both are pinned here: the copy must come from the 'settings'
 * catalogue, and the switch must be labelled by the panel heading.
 *
 * The mock resolves the keys against the catalogues the app actually ships, so a
 * removed or renamed key fails this test rather than passing silently.
 */

const CATALOGUES: Record<string, unknown> = {
	'en-US': enUSSettings,
	'en-GB': enGBSettings,
	'zh-HK': zhHKSettings,
	'zh-TW': zhTWSettings,
	'zh-CN': zhCNSettings,
}

let catalogue = CATALOGUES['en-US']

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

interface HookState {
	isSupported: boolean
	isEnabled: boolean
	isLoadingPreferences: boolean
	error: Error | null
}

let hookState: HookState = {
	isSupported: true,
	isEnabled: true,
	isLoadingPreferences: false,
	error: null,
}

mock.module('@/features/push/hooks/use-puzzled-push', () => ({
	usePuzzledPush: () => ({
		...hookState,
		requestPermission: async () => {},
		disablePush: async () => {},
		updatePreferences: async () => {},
		preferences: {
			pushEnabled: hookState.isEnabled,
			pushDailyReminder: true,
			pushStreakAlert: true,
			pushNewGames: false,
			dailyReminderTime: '09:00',
		},
	}),
}))

const { NotificationPreferences } = await import('./notification-preferences')

function renderPanel(): string {
	return renderToStaticMarkup(createElement(NotificationPreferences, { variant: 'panel' }))
}

function pushCopy(locale: string): Record<string, string> {
	const settings = CATALOGUES[locale] as { notifications: { push: Record<string, string> } }
	return settings.notifications.push
}

beforeEach(() => {
	catalogue = CATALOGUES['en-US']
	hookState = { isSupported: true, isEnabled: true, isLoadingPreferences: false, error: null }
})

describe('push settings panel — accessible name', () => {
	test('names the main switch with the heading it controls', () => {
		const html = renderPanel()

		expect(html).toContain('role="switch"')
		expect(html).toContain('aria-labelledby="push-notifications-heading"')
		expect(html).toContain('id="push-notifications-heading"')
		// The name has to resolve to real, reader-facing copy, not an empty shell.
		expect(html).toMatch(
			new RegExp(`id="push-notifications-heading"[^>]*>${pushCopy('en-US').heading}<`),
		)
	})

	test('states the switch position for assistive tech, not just colour', () => {
		expect(renderPanel()).toContain('aria-checked="true"')

		hookState = { ...hookState, isEnabled: false }
		expect(renderPanel()).toContain('aria-checked="false"')
	})

	test("names the switch in the reader's language", () => {
		for (const locale of ['en-GB', 'zh-HK', 'zh-TW', 'zh-CN']) {
			catalogue = CATALOGUES[locale]
			const html = renderPanel()

			expect(html).toContain('aria-labelledby="push-notifications-heading"')
			expect(html).toMatch(
				new RegExp(`id="push-notifications-heading"[^>]*>${pushCopy(locale).heading}<`),
			)
		}
	})

	test('renders no hardcoded English when the catalogue is not English', () => {
		catalogue = CATALOGUES['zh-HK']
		const html = renderPanel()

		for (const english of [
			'Push Notifications',
			'Notification Types',
			'Daily Puzzle Reminder',
			'Streak Alerts',
			'Save Preferences',
		]) {
			expect(html).not.toContain(english)
		}
	})
})

describe('push settings panel — catalogue coverage', () => {
	test('every locale carries the same push keys', () => {
		const reference = Object.keys(pushCopy('en-US')).sort()

		for (const locale of ['en-GB', 'zh-HK', 'zh-TW', 'zh-CN']) {
			const copy = pushCopy(locale)
			expect(`${locale}: ${Object.keys(copy).sort().join(',')}`).toBe(
				`${locale}: ${reference.join(',')}`,
			)
			// A Chinese reader must not be served the English sentence.
			for (const [key, value] of Object.entries(copy)) {
				if (locale === 'en-GB') continue
				expect(`${locale}.${key}: ${value}`).not.toBe(`${locale}.${key}: ${pushCopy('en-US')[key]}`)
			}
		}
	})
})

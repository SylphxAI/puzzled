import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { createElement, type ReactNode } from 'react'
import { localeFallbacks, locales } from '@/lib/i18n/config'

let signedIn = false
let locale = 'en-US'
let params = new URLSearchParams('challenge_id=mailed-challenge&token=mailed-secret')
let verifyCalls: unknown[] = []
let verify: () => Promise<void> = async () => undefined
const navigations: string[] = []
const messages = new Map<string, { auth: Record<string, string>; common: Record<string, string> }>()

function catalogue(name: string) {
	const value = messages.get(name)
	if (!value) throw new Error(`Missing catalogue ${name}`)
	return value
}

mock.module('next/navigation', () => ({
	useSearchParams: () => params,
	useRouter: () => ({ push: (path: string) => navigations.push(path) }),
}))
mock.module('next-intl', () => ({
	useTranslations: (namespace: 'auth' | 'common') => (key: string) => {
		const text = catalogue(locale)[namespace][key]
		if (!text) throw new Error(`Missing ${locale}.${namespace}.${key}`)
		return text
	},
}))
mock.module('@/lib/identity/react', () => ({
	useSafeAuth: () => ({
		verifyEmail: async (input: unknown) => {
			verifyCalls.push(input)
			await verify()
		},
		resendVerificationEmail: async () => undefined,
	}),
	useSafeUser: () => ({ isSignedIn: signedIn }),
}))
function TestLink({ href, children, ...props }: { href: string; children: ReactNode }) {
	return createElement('a', { ...props, href }, children)
}
function TestButton({ children, ...props }: { children: ReactNode }) {
	return createElement('button', { type: 'button', ...props }, children)
}
function TestIcon() {
	return null
}
mock.module('@/lib/i18n/routing', () => ({ Link: TestLink }))
mock.module('@sylphx/ui', () => ({ Button: TestButton, GamepadIcon: TestIcon }))

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Page: typeof import('@/app/[locale]/verify-email/page').default

beforeAll(async () => {
	GlobalRegistrator.register()
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
	for (const name of locales) {
		const fallback = localeFallbacks[name]
		messages.set(name, {
			auth: {
				...(fallback ? (await import(`../../messages/${fallback}/auth.json`)).default : {}),
				...(await import(`../../messages/${name}/auth.json`)).default,
			},
			common: {
				...(fallback ? (await import(`../../messages/${fallback}/common.json`)).default : {}),
				...(name === 'en-GB' ? {} : (await import(`../../messages/${name}/common.json`)).default),
			},
		})
	}
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ default: Page } = await import('@/app/[locale]/verify-email/page'))
})

afterAll(async () => {
	mock.restore()
	await GlobalRegistrator.unregister()
})

async function mount() {
	verifyCalls = []
	navigations.length = 0
	verify = async () => undefined
	params = new URLSearchParams('challenge_id=mailed-challenge&token=mailed-secret')
	const container = document.createElement('div')
	const root = createRoot(container)
	await React.act(async () => root.render(createElement(Page)))
	return { container, root }
}

describe('email proof confirmation', () => {
	for (const name of locales) {
		for (const hasSession of [false, true]) {
			test(`${name}: ${hasSession ? 'signed-in' : 'sessionless'} proof keeps explicit recovery and sign-in actions`, async () => {
				locale = name
				signedIn = hasSession
				const { container, root } = await mount()
				try {
					// Fetching the mailed link must not spend its secret (mail scanners).
					expect(verifyCalls).toHaveLength(0)
					const confirm = container.querySelector('button')
					expect(confirm?.textContent).toBe(catalogue(name).auth.confirmEmail)
					await React.act(async () => confirm?.click())
					expect(verifyCalls).toEqual([
						{ challengeId: 'mailed-challenge', secret: 'mailed-secret' },
					])
					expect(container.textContent).toContain(catalogue(name).auth.emailVerified)
					expect(container.textContent).toContain(catalogue(name).auth.verifiedSignInGuidance)
					const reset = container.querySelector('a[href="/forgot-password"]')
					expect(reset?.textContent).toBe(catalogue(name).auth.setNewPassword)
					expect(reset?.className).toContain('min-h-11')
					expect(reset?.className).toContain('bg-primary')
					expect(container.querySelector('a[href="/login"]')?.textContent).toBe(
						catalogue(name).common.signIn,
					)
					expect(container.querySelector('a[href="/"]')?.textContent).toBe(
						catalogue(name).auth.backToPlay,
					)
					expect(navigations).toHaveLength(0)
				} finally {
					await React.act(async () => root.unmount())
				}
			})
		}
	}

	test('does not navigate away after the old two-second timer', async () => {
		locale = 'en-US'
		signedIn = false
		const { container, root } = await mount()
		try {
			await React.act(async () => container.querySelector('button')?.click())
			await new Promise((resolve) => setTimeout(resolve, 2100))
			expect(navigations).toHaveLength(0)
			expect(container.querySelector('a[href="/forgot-password"]')).not.toBeNull()
		} finally {
			await React.act(async () => root.unmount())
		}
	})

	test('prevents duplicate proof while pending and never shows success on refusal', async () => {
		locale = 'en-US'
		signedIn = false
		const { container, root } = await mount()
		let refuse: (reason: Error) => void = () => undefined
		verify = () =>
			new Promise<void>((_, reject) => {
				refuse = reject
			})
		try {
			const confirm = container.querySelector('button')
			await React.act(async () => {
				confirm?.click()
				confirm?.click()
			})
			expect(verifyCalls).toHaveLength(1)
			expect(container.querySelector('a[href="/forgot-password"]')).toBeNull()
			await React.act(async () => refuse(new Error('invalid proof')))
			expect(container.textContent).toContain(catalogue(locale).auth.verificationFailed)
			expect(container.textContent).not.toContain(catalogue(locale).auth.emailVerified)
			expect(navigations).toHaveLength(0)
		} finally {
			await React.act(async () => root.unmount())
		}
	})
})

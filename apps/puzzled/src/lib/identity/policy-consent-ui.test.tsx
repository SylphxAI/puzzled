import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { createElement, type ReactNode } from 'react'

let pathname = '/games'
let signupTermsAccepted: unknown
const requests: { url: string; init?: RequestInit }[] = []
const originalFetch = globalThis.fetch
let respond: (url: string, init?: RequestInit) => Promise<Response>

mock.module('next/navigation', () => ({
	usePathname: () => pathname,
	useSearchParams: () => new URLSearchParams(),
}))
mock.module('next-intl', () => ({
	useTranslations: () =>
		Object.assign((key: string) => key, {
			rich: (key: string, values: Record<string, (text: string) => ReactNode>) =>
				createElement('span', null, key, values.terms?.('Terms'), values.privacy?.('Privacy')),
		}),
}))
function TestLink({ href, children }: { href: string; children: ReactNode }) {
	return createElement('a', { href }, children)
}
mock.module('@/lib/i18n/routing', () => ({ Link: TestLink }))
mock.module('@/lib/identity/react', () => ({
	useSafeAuth: () => ({ signInWithOAuth: async () => undefined }),
	useSignUpForm: (options: { termsAccepted?: boolean }) => {
		signupTermsAccepted = options.termsAccepted
		return {
			form: { name: 'Player', email: 'player@example.com', password: 'long-enough-password' },
			setName() {},
			setEmail() {},
			setPassword() {},
			isSignInRetry: false,
			isLoading: false,
			loadingProvider: null,
			error: null,
			passwordValid: true,
			handleSubmit: async () => undefined,
			handleOAuthSignUp: async () => undefined,
		}
	},
}))
function EmptyField() {
	return null
}
function TestSubmit({ disabled, label }: { disabled: boolean; label: string }) {
	return createElement('button', { type: 'submit', disabled }, label)
}
function TestOAuth({ disabled }: { disabled: boolean }) {
	return createElement('button', { type: 'button', disabled, 'data-oauth': true }, 'Google')
}
// Keep this test about the form's consent wiring, not shared field styling.
mock.module('@/app/[locale]/(auth)/_components/auth-fields', () => ({
	MIN_PASSWORD_LENGTH: 12,
	emailProblem: () => null,
	passwordProblem: () => null,
	AuthField: EmptyField,
	PasswordField: EmptyField,
	FormAlert: EmptyField,
	AuthSubmit: TestSubmit,
	OAuthButtons: TestOAuth,
}))

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let PolicyConsentGate: typeof import('./policy-consent-gate').PolicyConsentGate
let SignUpForm: typeof import('@/app/[locale]/(auth)/signup/signup-form').SignUpForm
let root: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement

const currentStatus = {
	user_id: 'player-1',
	current_terms_version: '2026-11-14',
	current_privacy_version: '2026-11-14',
	accepted_terms_version: '2026-11-14',
	accepted_privacy_version: '2026-11-14',
	accepted_at: '2026-11-14T00:00:00Z',
	needs_reconsent: false,
}
const staleStatus = {
	...currentStatus,
	accepted_terms_version: null,
	accepted_privacy_version: null,
	accepted_at: null,
	needs_reconsent: true,
}

beforeAll(async () => {
	GlobalRegistrator.register({ url: 'https://puzzled.gg/games' })
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ PolicyConsentGate } = await import('./policy-consent-gate'))
	;({ SignUpForm } = await import('@/app/[locale]/(auth)/signup/signup-form'))
})
beforeEach(() => {
	pathname = '/games'
	requests.length = 0
	signupTermsAccepted = undefined
	respond = async () => Response.json(currentStatus)
	globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
		requests.push({ url: String(url), init })
		return respond(String(url), init)
	}) as typeof fetch
})
afterEach(async () => {
	if (root) await React.act(async () => root?.unmount())
	root = null
	host?.remove()
	globalThis.fetch = originalFetch
})
afterAll(async () => {
	mock.restore()
	await GlobalRegistrator.unregister()
})

async function mount(child: ReactNode) {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	await React.act(async () => root?.render(child))
}
function gate(userId: string | null = 'player-1') {
	return (
		<PolicyConsentGate userId={userId}>
			<div data-protected>Protected puzzle</div>
		</PolicyConsentGate>
	)
}
function expectBlocked() {
	expect(host.querySelector('[data-protected]')).toBeNull()
}
function expectReleased() {
	expect(host.querySelector('[data-protected]')?.textContent).toBe('Protected puzzle')
}
function checkbox() {
	const element = host.querySelector<HTMLInputElement>('input[type="checkbox"]')
	if (!element) throw new Error('Consent checkbox not rendered')
	return element
}
function submit() {
	const element = host.querySelector<HTMLButtonElement>('button[type="submit"]')
	if (!element) throw new Error('Consent submit not rendered')
	return element
}

describe('versioned policy consent gate', () => {
	test('passes guests without a consent lookup', async () => {
		await mount(gate(null))
		expectReleased()
		expect(requests).toHaveLength(0)
	})
	for (const path of ['/terms', '/privacy', '/en-US/terms', '/zh-HK/privacy']) {
		test(`allows legal page ${path}`, async () => {
			pathname = path
			respond = async () => Response.json(staleStatus)
			await mount(gate())
			expectReleased()
		})
	}
	test('blocks children while status is pending, then releases current acceptance', async () => {
		let resolve!: (value: Response) => void
		respond = () =>
			new Promise<Response>((done) => {
				resolve = done
			})
		await mount(gate())
		expectBlocked()
		expect(requests[0]?.url).toBe('/api/identity/policy-consent')
		expect(requests[0]?.init?.method ?? 'GET').toBe('GET')
		await React.act(async () => resolve(Response.json(currentStatus)))
		expectReleased()
	})
	test('does not reuse clearance when the account changes', async () => {
		await mount(gate())
		expectReleased()
		let resolve!: (value: Response) => void
		respond = () =>
			new Promise<Response>((done) => {
				resolve = done
			})
		await React.act(async () => root?.render(gate('player-2')))
		expectBlocked()
		await React.act(async () => resolve(Response.json({ ...currentStatus, user_id: 'player-2' })))
		expectReleased()
		expect(requests).toHaveLength(2)
	})
	test('an old account response cannot release the replacement account', async () => {
		let resolveOld!: (value: Response) => void
		respond = () =>
			new Promise<Response>((done) => {
				resolveOld = done
			})
		await mount(gate())
		respond = async () => Response.json({ ...staleStatus, user_id: 'player-2' })
		await React.act(async () => root?.render(gate('player-2')))
		await React.act(async () => resolveOld(Response.json(currentStatus)))
		expectBlocked()
		expect(checkbox().checked).toBe(false)
	})
	test('rechecks clearance after a protected route change', async () => {
		await mount(gate())
		expectReleased()
		pathname = '/games/sudoku'
		respond = async () => Response.json(staleStatus)
		await React.act(async () => root?.render(gate()))
		expectBlocked()
		expect(requests).toHaveLength(2)
	})
	for (const failure of ['network', 'http', 'malformed'] as const) {
		test(`fails closed on ${failure} status`, async () => {
			respond = async () => {
				if (failure === 'network') throw new TypeError('offline')
				if (failure === 'http') return Response.json({ error: 'unavailable' }, { status: 502 })
				return Response.json({ needs_reconsent: false })
			}
			await mount(gate())
			expectBlocked()
		})
	}
	test('requires a fresh unchecked assertion and sends only the current four legal fields', async () => {
		respond = async (_url, init) =>
			Response.json(init?.method === 'POST' ? currentStatus : staleStatus)
		await mount(gate())
		expectBlocked()
		expect(checkbox().checked).toBe(false)
		expect(submit().disabled).toBe(true)
		expect(host.querySelector('a[href="/terms"]')).not.toBeNull()
		expect(host.querySelector('a[href="/privacy"]')).not.toBeNull()
		await React.act(async () => checkbox().click())
		expect(submit().disabled).toBe(false)
		await React.act(async () => submit().click())
		const posts = requests.filter(({ init }) => init?.method === 'POST')
		expect(posts).toHaveLength(1)
		expect(posts[0]?.url).toBe('/api/identity/policy-consent')
		expect(JSON.parse(String(posts[0]?.init?.body))).toEqual({
			terms_accepted: true,
			terms_version: '2026-11-14',
			privacy_version: '2026-11-14',
			surface: 'puzzled_web',
		})
		expectReleased()
	})
	test('POST failure stays blocking and a successful retry releases children', async () => {
		let attempts = 0
		respond = async (_url, init) => {
			if (init?.method !== 'POST') return Response.json(staleStatus)
			attempts++
			return attempts === 1
				? Response.json({ error: 'unavailable' }, { status: 502 })
				: Response.json(currentStatus)
		}
		await mount(gate())
		await React.act(async () => checkbox().click())
		await React.act(async () => submit().click())
		expectBlocked()
		if (!checkbox().checked) await React.act(async () => checkbox().click())
		await React.act(async () => submit().click())
		expect(attempts).toBe(2)
		expectReleased()
	})
	test('a successful HTTP response that still requires consent cannot release children', async () => {
		respond = async () => Response.json(staleStatus)
		await mount(gate())
		await React.act(async () => checkbox().click())
		await React.act(async () => submit().click())
		expectBlocked()
	})
})

describe('affirmative signup checkbox', () => {
	test('starts unchecked with both signup methods disabled and passes the assertion to the hook', async () => {
		await mount(createElement(SignUpForm, { providers: ['google'] }))
		const terms = host.querySelector<HTMLInputElement>('#signup-terms')
		expect(terms).not.toBeNull()
		expect(terms?.checked).toBe(false)
		expect(signupTermsAccepted).toBe(false)
		expect(submit().disabled).toBe(true)
		expect(host.querySelector<HTMLButtonElement>('[data-oauth]')?.disabled).toBe(true)
		await React.act(async () => terms?.click())
		expect(signupTermsAccepted).toBe(true)
		expect(submit().disabled).toBe(false)
		expect(host.querySelector<HTMLButtonElement>('[data-oauth]')?.disabled).toBe(false)
		await React.act(async () => terms?.click())
		expect(signupTermsAccepted).toBe(false)
		expect(submit().disabled).toBe(true)
		expect(host.querySelector<HTMLButtonElement>('[data-oauth]')?.disabled).toBe(true)
	})
})

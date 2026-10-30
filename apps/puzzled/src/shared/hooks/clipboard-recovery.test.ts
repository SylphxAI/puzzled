import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { ReactNode } from 'react'
import common from '@/messages/en-US/common.json'
import plus from '@/messages/en-US/plus.json'
import share from '@/messages/en-US/share.json'

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let NextIntlClientProvider: typeof import('next-intl').NextIntlClientProvider
let AppRouterContext: typeof import('next/dist/shared/lib/app-router-context.shared-runtime').AppRouterContext
let AccountId: typeof import('@/app/[locale]/(main)/settings/account/account-id').AccountId
let SubscriptionPanel: typeof import('@/app/[locale]/(main)/settings/subscription/subscription-client').SubscriptionPanel
let ResultShareRecovery: typeof import('@/features/daily/components/result-share-recovery').ResultShareRecovery
let root: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement
let writes: { value: string; resolve: () => void; reject: (error: Error) => void }[]

beforeAll(async () => {
	GlobalRegistrator.register({ url: 'https://example.com' })
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ NextIntlClientProvider } = await import('next-intl'))
	;({ AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime'))
	;({ AccountId } = await import('@/app/[locale]/(main)/settings/account/account-id'))
	;({ SubscriptionPanel } = await import(
		'@/app/[locale]/(main)/settings/subscription/subscription-client'
	))
	;({ ResultShareRecovery } = await import('@/features/daily/components/result-share-recovery'))
})
afterEach(async () => {
	if (root) await React.act(async () => root?.unmount())
	host?.remove()
	root = null
})
afterAll(async () => {
	await GlobalRegistrator.unregister()
})

async function mount(child: ReactNode) {
	writes = []
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: {
			writeText: (value: string) =>
				new Promise<void>((resolve, reject) => writes.push({ value, resolve, reject })),
		},
	})
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	const router = {
		bfcacheId: 'test-view',
		back() {},
		forward() {},
		refresh() {},
		push() {},
		replace() {},
		async prefetch() {},
	}
	await React.act(async () =>
		root?.render(
			React.createElement(
				AppRouterContext.Provider,
				{ value: router },
				React.createElement(NextIntlClientProvider, {
					locale: 'en-US',
					messages: { common, plus, share },
					children: child,
				}),
			),
		),
	)
}
function button(label: string) {
	const found = [...host.querySelectorAll('button')].find((e) => e.textContent === label)
	if (!found) throw new Error(`Missing button ${label}`)
	return found
}
async function deny(index: number) {
	await React.act(async () =>
		writes[index].reject(new DOMException('Clipboard permission denied', 'NotAllowedError')),
	)
}
async function resolve(index: number) {
	await React.act(async () => writes[index].resolve())
}
async function click(label: string) {
	await React.act(async () => button(label).click())
}
function expectPending() {
	expect(button(common.clipboard.pending).disabled).toBe(true)
	expect(host.textContent).not.toContain('Copied')
}
function expectFailure(text: string) {
	expect(host.querySelector('[role="alert"]')?.textContent).toBe(common.clipboard.failed)
	expect(window.getSelection()?.toString()).toBe(text)
	expect(host.textContent).not.toContain('Copied')
}

describe('clipboard recovery on settings and result components', () => {
	test('account id awaits the write, selects on denial, retries, and clears stale success', async () => {
		await mount(
			React.createElement(AccountId, {
				id: 'example-account-id',
				label: 'Account ID',
				hint: 'Support reference',
				copyLabel: 'Copy ID',
				copiedLabel: 'Copied',
			}),
		)
		await click('Copy ID')
		expectPending()
		await deny(0)
		expectFailure('example-account-id')
		await click('Copy ID')
		expectPending()
		await resolve(1)
		expect(button('Copied').disabled).toBe(false)
		await click('Copied')
		expectPending()
		await deny(2)
		expectFailure('example-account-id')
		expect(writes.map((x) => x.value)).toEqual(Array(3).fill('example-account-id'))
	})

	test('family invite catches a denial, selects the link, and allows another copy', async () => {
		const view: import('@/lib/billing/plus').SubscriptionView = {
			salesOpen: true,
			entitled: true,
			source: 'family',
			trialEndsMs: null,
			planId: 'family_monthly',
			status: 'active',
			periodEndMs: null,
			subscriptionTrialEndMs: null,
			cancelAtPeriodEnd: false,
			family: { role: 'owner', inviteCode: 'example-invite', maxMembers: 5, members: [] },
		}
		await mount(
			React.createElement(SubscriptionPanel, { view, locale: 'en-US', fromCheckout: false }),
		)
		await click(plus.family.copy)
		expectPending()
		await deny(0)
		expectFailure('https://example.com/family/join?code=example-invite')
		await click(plus.family.copy)
		await resolve(1)
		expect(button(plus.family.copied).disabled).toBe(false)
		await click(plus.family.copied)
		expectPending()
		await deny(2)
		expectFailure('https://example.com/family/join?code=example-invite')
	})

	test('result caption remains available and selectable when copying is denied', async () => {
		const caption = 'Daily puzzle result. Play: example.com/games/sudoku'
		await mount(React.createElement(ResultShareRecovery, { text: caption }))
		const text = host.querySelector('textarea') as HTMLTextAreaElement
		expect(text.value).toBe(caption)
		expect(text.selectionStart).toBe(0)
		expect(text.selectionEnd).toBe(caption.length)
		await click(share.copy)
		expectPending()
		await deny(0)
		expect(host.querySelector('[role="alert"]')?.textContent).toBe(common.clipboard.failed)
		expect(text.selectionEnd).toBe(caption.length)
		await click(share.copy)
		await resolve(1)
		expect(host.querySelector('[role="alert"]')).toBeNull()
		expect(button(common.copied).disabled).toBe(false)
	})
})

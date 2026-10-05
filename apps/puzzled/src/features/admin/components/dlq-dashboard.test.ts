import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Bun module mocks are process-wide for the run, so each replacement spreads the
// real module surface and overrides only the seams this test needs.
const realApi = await import('@/lib/api')
const realNavigation = await import('next/navigation')

const retried: { id: string }[] = []
const idle = { mutate: () => {}, error: null }

mock.module('next-intl', () => ({
	useTranslations: () => (key: string) => key,
	useLocale: () => 'en-US',
}))

mock.module('next/navigation', () => ({
	...realNavigation,
	useRouter: () => ({ refresh: () => {} }),
}))

mock.module('@/lib/api', () => ({
	...realApi,
	useDlqList: () => ({ data: undefined, refetch: () => {} }),
	useDlqRetry: () => ({
		mutate: (input: { id: string }) => {
			retried.push(input)
		},
		error: null,
	}),
	useDlqResolve: () => idle,
	useDlqMarkFailed: () => idle,
}))

afterAll(() => {
	try {
		mock.module('@/lib/api', () => realApi)
		mock.module('next/navigation', () => realNavigation)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { DLQDashboard } = await import('./dlq-dashboard')

const ITEM_ID = '0197a000-0000-7000-8000-0000000000d1'
const stats = { total: 1, pending: 1, retrying: 0, resolved: 0, failed: 0, byWorkflow: {} }
const item = {
	id: ITEM_ID,
	workflowName: 'daily-puzzle',
	status: 'pending',
	retryCount: 0,
	maxRetries: 3,
	error: 'boom',
	createdAt: new Date('2026-10-05T09:00:00Z'),
}

describe('DLQ retry', () => {
	beforeAll(() => {
		GlobalRegistrator.register({ url: 'http://localhost/' })
		// biome-ignore lint/suspicious/noExplicitAny: React's act flag lives on globalThis.
		;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
	})
	afterAll(async () => {
		await GlobalRegistrator.unregister()
	})

	test('a Retry click retries the item at once, with no confirmation dialog', async () => {
		const React = await import('react')
		const { createRoot } = await import('react-dom/client')
		const host = document.createElement('div')
		document.body.append(host)
		const root = createRoot(host)
		await React.act(async () => {
			root.render(
				React.createElement(DLQDashboard, {
					initialStats: stats,
					// biome-ignore lint/suspicious/noExplicitAny: a partial row is enough for the row view.
					initialItems: [item as any],
				}),
			)
		})
		const retry = host.querySelector('button[aria-label="actions.retry"]') as HTMLButtonElement
		expect(retry).not.toBeNull()
		await React.act(async () => {
			retry.click()
		})
		expect(retried).toEqual([{ id: ITEM_ID }])
		expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull()
		await React.act(async () => {
			root.unmount()
		})
	})
})

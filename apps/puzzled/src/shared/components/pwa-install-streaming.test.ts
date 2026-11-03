import { afterAll, beforeAll, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { FIRST_FINISH_DAY_KEY } from '@/lib/storage-keys'
import { DAY_PRIMARY_ACTION_ATTR } from './pwa-install-policy'

mock.module('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))
mock.module('@/lib/i18n/routing', () => ({ usePathname: () => '/' }))
mock.module('@/shared/components/pwa-install-event', () => ({
	getInstallPrompt: () => ({ prompt: async () => {}, userChoice: Promise.resolve({}) }),
	onInstallPrompt: () => () => {},
	clearInstallPrompt: () => {},
}))

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let PWAInstallPrompt: typeof import('./pwa-install-prompt').PWAInstallPrompt
let reportIntersection: (entries: { target: Element; isIntersecting: boolean }[]) => void
const observed = new Set<Element>()
let originalIntersection: PropertyDescriptor | undefined

beforeAll(async () => {
	GlobalRegistrator.register({ url: 'https://puzzled.gg/' })
	Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
	originalIntersection = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
	Object.defineProperty(globalThis, 'IntersectionObserver', {
		configurable: true,
		value: class {
			constructor(callback: typeof reportIntersection) {
				reportIntersection = callback
			}
			observe(target: Element) {
				observed.add(target)
			}
			unobserve(target: Element) {
				observed.delete(target)
			}
			disconnect() {
				observed.clear()
			}
		},
	})
	React = await import('react')
	;({ createRoot } = await import('react-dom/client'))
	;({ PWAInstallPrompt } = await import('./pwa-install-prompt'))
})

afterAll(async () => {
	if (originalIntersection)
		Object.defineProperty(globalThis, 'IntersectionObserver', originalIntersection)
	else Reflect.deleteProperty(globalThis, 'IntersectionObserver')
	Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
	await GlobalRegistrator.unregister()
})

test('mounted prompt stays hidden when home streams its action without navigation', async () => {
	localStorage.setItem(FIRST_FINISH_DAY_KEY, '2000-01-01')
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await React.act(async () => root.render(React.createElement(PWAInstallPrompt)))
		// Make the install request ready while home still has only its skeleton.
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 3050))
		})
		expect(container.querySelector('output')).toBeNull()
		const play = document.createElement('button')
		play.setAttribute(DAY_PRIMARY_ACTION_ATTR, '')
		await React.act(async () => {
			document.body.append(play)
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(observed.has(play)).toBe(true)
		await React.act(async () => {
			reportIntersection([{ target: play, isIntersecting: true }])
		})
		expect(container.querySelector('output')).toBeNull()
		// Prove the offer was actually eligible and ready, not hidden for another reason.
		await React.act(async () => {
			reportIntersection([{ target: play, isIntersecting: false }])
		})
		expect(container.querySelector('output')).not.toBeNull()
		play.remove()
	} finally {
		await React.act(async () => root.unmount())
		container.remove()
	}
})

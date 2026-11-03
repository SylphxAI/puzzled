import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { observeDayPrimaryActions } from './observe-day-primary-actions'
import { DAY_PRIMARY_ACTION_ATTR, shouldShowInstallOffer } from './pwa-install-policy'

// Control browser delivery, including delayed/partial IntersectionObserver batches.
// Install the observer before inserting the streamed action, as the root prompt does.
let nodes: Element[]
let mutate: () => void
let intersect: (entries: { target: Element; isIntersecting: boolean }[]) => void
let observed: Set<Element>
let mutationDisconnected: boolean
let intersectionDisconnected: boolean
let originalGlobals: Map<string, PropertyDescriptor | undefined>

beforeEach(() => {
	nodes = []
	observed = new Set()
	mutationDisconnected = false
	intersectionDisconnected = false
	const replacements = {
		document: {
			body: {},
			querySelectorAll: (selector: string) => {
				expect(selector).toBe(`[${DAY_PRIMARY_ACTION_ATTR}]`)
				return nodes
			},
		},
		MutationObserver: class {
			constructor(callback: () => void) {
				mutate = callback
			}
			observe(_target: unknown, options: MutationObserverInit) {
				expect(options).toEqual({
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: [DAY_PRIMARY_ACTION_ATTR],
				})
			}
			disconnect() {
				mutationDisconnected = true
			}
		},
		IntersectionObserver: class {
			constructor(callback: typeof intersect) {
				intersect = callback
			}
			observe(target: Element) {
				observed.add(target)
			}
			unobserve(target: Element) {
				observed.delete(target)
			}
			disconnect() {
				intersectionDisconnected = true
			}
		},
	}
	originalGlobals = new Map()
	for (const [key, value] of Object.entries(replacements)) {
		originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
	}
})

afterEach(() => {
	for (const [key, descriptor] of originalGlobals) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor)
		else Reflect.deleteProperty(globalThis, key)
	}
})

function action(): Element {
	return {} as Element
}

function mountPrompt(waitForAction = true) {
	let visible = false
	const unmount = observeDayPrimaryActions((next) => {
		visible = next
	}, waitForAction)
	return {
		offerVisible: () =>
			shouldShowInstallOffer({
				eligible: true,
				standalone: false,
				requested: true,
				primaryActionVisible: visible,
			}),
		unmount,
	}
}

describe('install offer follows streamed primary actions', () => {
	test('mounted prompt waits for the streamed home action without navigation', () => {
		const prompt = mountPrompt()
		expect(prompt.offerVisible()).toBe(false)
		const play = action()
		nodes.push(play)
		mutate()
		expect(observed.has(play)).toBe(true)
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: play, isIntersecting: true }])
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: play, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(true)
		prompt.unmount()
	})

	test('ORs all actions across partial intersection batches, not the last entry', () => {
		const first = action()
		const second = action()
		nodes.push(first, second)
		const prompt = mountPrompt()
		intersect([{ target: first, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: second, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(true)
		intersect([{ target: first, isIntersecting: true }])
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: second, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(false)
		prompt.unmount()
	})

	test('follows replacement/removal and ignores late entries for detached actions', () => {
		const first = action()
		nodes.push(first)
		const prompt = mountPrompt()
		intersect([{ target: first, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(true)
		const replacement = action()
		nodes = [replacement]
		mutate()
		expect(observed.has(first)).toBe(false)
		expect(observed.has(replacement)).toBe(true)
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: first, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(false)
		intersect([{ target: replacement, isIntersecting: false }])
		expect(prompt.offerVisible()).toBe(true)
		nodes = []
		mutate()
		expect(prompt.offerVisible()).toBe(false)
		prompt.unmount()
	})

	test('a non-home page with no primary action can offer installation', () => {
		const prompt = mountPrompt(false)
		expect(prompt.offerVisible()).toBe(true)
		prompt.unmount()
	})

	test('without IntersectionObserver, conservatively keeps an action unobscured', () => {
		Reflect.deleteProperty(globalThis, 'IntersectionObserver')
		nodes.push(action())
		const prompt = mountPrompt(false)
		expect(prompt.offerVisible()).toBe(false)
		prompt.unmount()
	})

	test('navigation/unmount disconnects both observers', () => {
		const prompt = mountPrompt()
		prompt.unmount()
		expect(mutationDisconnected).toBe(true)
		expect(intersectionDisconnected).toBe(true)
	})
})

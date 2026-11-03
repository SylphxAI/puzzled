import { DAY_PRIMARY_ACTION_ATTR } from './pwa-install-policy'

/** Follow streamed/replaced actions, not only those present at hydration. */
export function observeDayPrimaryActions(
	onVisibility: (visible: boolean) => void,
	waitForAction: boolean,
): () => void {
	const actions = new Map<Element, boolean>()
	const publish = () =>
		onVisibility((actions.size === 0 && waitForAction) || [...actions.values()].some(Boolean))
	const intersections =
		typeof IntersectionObserver === 'undefined'
			? null
			: new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (actions.has(entry.target)) actions.set(entry.target, entry.isIntersecting)
					}
					publish()
				})
	const sync = () => {
		const current = new Set(document.querySelectorAll(`[${DAY_PRIMARY_ACTION_ATTR}]`))
		for (const action of actions.keys()) {
			if (current.has(action)) continue
			intersections?.unobserve(action)
			actions.delete(action)
		}
		for (const action of current) {
			if (actions.has(action)) continue
			// Unknown geometry is held visible until IntersectionObserver reports it.
			actions.set(action, true)
			intersections?.observe(action)
		}
		publish()
	}
	const mutations = new MutationObserver(sync)
	mutations.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [DAY_PRIMARY_ACTION_ATTR],
	})
	sync()
	return () => {
		mutations.disconnect()
		intersections?.disconnect()
	}
}

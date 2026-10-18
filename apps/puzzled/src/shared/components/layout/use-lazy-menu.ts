'use client'

import { useState } from 'react'

/**
 * Intent-driven loading for a dropdown menu.
 *
 * The menu runtime (Base UI, floating-ui, motion) is over 90 KB compressed and
 * is not needed until someone reaches for a menu, so the page ships a plain
 * trigger and fetches the menu on first hover, focus, touch or press. A press
 * opens it: the real menu mounts already open once its module has arrived.
 *
 * `load` must be a stable module-level function (an `import()` thunk): the
 * module is fetched once and every later call resolves from the cache.
 */
export function useLazyMenu(load: () => Promise<unknown>) {
	const [opened, setOpened] = useState(false)
	const fetchMenu = () => void load().catch(() => undefined)
	return {
		opened,
		/** Spread on the plain trigger shown until the menu is requested. */
		triggerProps: {
			'aria-haspopup': 'menu' as const,
			'aria-expanded': false,
			onPointerEnter: fetchMenu,
			onFocus: fetchMenu,
			onTouchStart: fetchMenu,
			onClick: () => {
				fetchMenu()
				setOpened(true)
			},
		},
	}
}

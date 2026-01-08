import { useEffect, useState } from 'react'

/**
 * Hook to detect if the component has mounted (client-side).
 * Use this to prevent hydration mismatches for client-only content.
 */
export function useMounted() {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	return mounted
}

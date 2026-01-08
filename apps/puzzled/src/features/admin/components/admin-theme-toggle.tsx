'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

/**
 * Admin-styled theme toggle that cycles through system/light/dark
 */
export function AdminThemeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<button type="button" className="admin-btn admin-btn-ghost p-2" disabled>
				<Sun className="h-4 w-4" />
			</button>
		)
	}

	const cycleTheme = () => {
		const current = theme || 'system'
		const order = ['system', 'light', 'dark'] as const
		const currentIndex = order.indexOf(current as (typeof order)[number])
		const nextIndex = (currentIndex + 1) % order.length
		setTheme(order[nextIndex])
	}

	const Icon = resolvedTheme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun
	const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'

	return (
		<button
			type="button"
			onClick={cycleTheme}
			className="admin-btn admin-btn-ghost p-2"
			title={`Theme: ${label}`}
		>
			<Icon className="h-4 w-4" />
		</button>
	)
}

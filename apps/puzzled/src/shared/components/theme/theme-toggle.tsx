'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
	className?: string
	showLabel?: boolean
}

const themes = [
	{ value: 'system', icon: Monitor, label: 'System' },
	{ value: 'light', icon: Sun, label: 'Light' },
	{ value: 'dark', icon: Moon, label: 'Dark' },
] as const

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
	const { theme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	// Prevent hydration mismatch
	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<div className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}>
				{themes.map(({ value, icon: Icon }) => (
					<button
						type="button"
						key={value}
						className="flex h-8 w-8 items-center justify-center rounded-md"
						disabled
					>
						<Icon className="h-4 w-4" />
					</button>
				))}
			</div>
		)
	}

	return (
		<div className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}>
			{themes.map(({ value, icon: Icon, label }) => {
				const isActive = theme === value
				return (
					<button
						type="button"
						key={value}
						onClick={() => setTheme(value)}
						className={cn(
							'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 transition-colors',
							isActive
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground',
						)}
						title={label}
					>
						<Icon className="h-4 w-4" />
						{showLabel && <span className="text-sm">{label}</span>}
					</button>
				)
			})}
		</div>
	)
}

// Compact version for header
export function ThemeToggleCompact({ className }: { className?: string }) {
	const { theme, setTheme, resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<button
				type="button"
				className={cn('flex h-10 w-10 items-center justify-center rounded-full', className)}
				disabled
			>
				<Sun className="h-5 w-5" />
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

	return (
		<button
			type="button"
			onClick={cycleTheme}
			className={cn(
				'flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted',
				className,
			)}
			title={`Theme: ${theme}`}
		>
			<Icon className="h-5 w-5" />
		</button>
	)
}

'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
	className?: string
	showLabel?: boolean
}

/** Theme keys; labels come from `common.theme` in every locale. */
const themes = [
	{ value: 'system', icon: Monitor, key: 'system' },
	{ value: 'light', icon: Sun, key: 'light' },
	{ value: 'dark', icon: Moon, key: 'dark' },
] as const

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
	const t = useTranslations('common.theme')
	const { theme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	// Prevent hydration mismatch
	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<fieldset
				className={cn('flex gap-1 rounded-lg bg-muted p-1 border-0', className)}
				aria-label={t('title')}
			>
				{themes.map(({ value, icon: Icon, key }) => (
					<button
						type="button"
						key={value}
						className="flex h-11 min-w-11 items-center justify-center rounded-md"
						disabled
						aria-label={t('selectionLoading', { theme: t(key) })}
					>
						<Icon className="h-4 w-4" aria-hidden="true" />
					</button>
				))}
			</fieldset>
		)
	}

	return (
		<fieldset
			className={cn('flex gap-1 rounded-lg bg-muted p-1 border-0', className)}
			aria-label={t('title')}
		>
			{themes.map(({ value, icon: Icon, key }) => {
				const isActive = theme === value
				return (
					<button
						type="button"
						key={value}
						onClick={() => setTheme(value)}
						className={cn(
							// 44px targets: the segmented control sits in a padded track.
							'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 transition-colors',
							isActive
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground',
						)}
						aria-label={t('setTo', { theme: t(key) })}
						aria-pressed={isActive}
					>
						<Icon className="h-4 w-4" aria-hidden="true" />
						{showLabel && <span className="text-sm">{t(key)}</span>}
					</button>
				)
			})}
		</fieldset>
	)
}

// Compact version for header
export function ThemeToggleCompact({ className }: { className?: string }) {
	const t = useTranslations('common.theme')
	const { theme, setTheme, resolvedTheme } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted) {
		return (
			<button
				type="button"
				className={cn('flex h-11 w-11 items-center justify-center rounded-full', className)}
				disabled
				aria-label={t('loading')}
			>
				<Sun className="h-5 w-5" aria-hidden="true" />
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

	const currentLabel = theme === 'dark' ? t('dark') : theme === 'light' ? t('light') : t('system')

	return (
		<button
			type="button"
			onClick={cycleTheme}
			className={cn(
				'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted',
				className,
			)}
			aria-label={t('toggle', { theme: currentLabel })}
		>
			<Icon className="h-5 w-5" aria-hidden="true" />
			<span className="sr-only">{t('current', { theme: currentLabel })}</span>
		</button>
	)
}

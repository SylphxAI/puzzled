'use client'

import { Calendar, Lock, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'

type ModeSelectorProps = {
	currentMode: GameMode
	onModeChange: (mode: GameMode) => void
	hasPremium: boolean
	hasCompletedDaily: boolean
	className?: string
}

export function ModeSelector({
	currentMode,
	onModeChange,
	hasPremium,
	hasCompletedDaily,
	className,
}: ModeSelectorProps) {
	const t = useTranslations('modes')

	const modes = [
		{
			id: 'daily' as GameMode,
			label: t('daily'),
			icon: Target,
			description: t('dailyDesc'),
			locked: false,
			disabled: hasCompletedDaily,
		},
		{
			id: 'archive' as GameMode,
			label: t('archive'),
			icon: Calendar,
			description: t('archiveDesc'),
			locked: !hasPremium,
			disabled: false,
		},
	]

	return (
		<div className={cn('flex flex-col gap-2', className)}>
			<div className="flex items-center justify-center gap-1 rounded-lg bg-muted/50 p-1">
				{modes.map((mode) => {
					const isActive = currentMode === mode.id
					const isDisabled = mode.disabled || (mode.locked && !hasPremium)
					const Icon = mode.icon

					return (
						<button
							type="button"
							key={mode.id}
							onClick={() => !isDisabled && onModeChange(mode.id)}
							disabled={isDisabled}
							className={cn(
								'relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all',
								isActive
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground',
								isDisabled && 'cursor-not-allowed opacity-50',
							)}
						>
							<Icon className="h-4 w-4" />
							<span>{mode.label}</span>
							{mode.locked && <Lock className="absolute -right-1 -top-1 h-3 w-3 text-primary" />}
						</button>
					)
				})}
			</div>

			{/* Show upgrade prompt for locked modes */}
			{currentMode === 'archive' && !hasPremium && (
				<div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
					<Lock className="h-4 w-4 text-primary" />
					<span className="text-sm text-muted-foreground">{t('premiumRequired')}</span>
					<Link href="/pricing">
						<Button size="sm" variant="outline" className="h-7 gap-1">
							{t('upgrade')}
						</Button>
					</Link>
				</div>
			)}
		</div>
	)
}

/**
 * Compact mode indicator for showing current mode in game header
 */
type ModeIndicatorProps = {
	mode: GameMode
	className?: string
}

export function ModeIndicator({ mode, className }: ModeIndicatorProps) {
	const t = useTranslations('modes')

	const modeConfig = {
		daily: {
			label: t('daily'),
			icon: Target,
			color: 'text-emerald-600 bg-emerald-500/10',
		},
		archive: {
			label: t('archive'),
			icon: Calendar,
			color: 'text-blue-600 bg-blue-500/10',
		},
	}

	const config = modeConfig[mode]
	const Icon = config.icon

	return (
		<div
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				config.color,
				className,
			)}
		>
			<Icon className="h-3 w-3" />
			<span>{config.label}</span>
		</div>
	)
}

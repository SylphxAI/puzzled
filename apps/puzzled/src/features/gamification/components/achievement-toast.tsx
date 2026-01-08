'use client'

import { Award, Share2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/shared/components/ui'

type AchievementToastProps = {
	achievement: {
		id: string
		name: string
		description: string
		icon?: string
	}
	open?: boolean
	onClose: () => void
	onShare?: () => void
	duration?: number
	className?: string
}

/**
 * AchievementToast - Celebratory notification for unlocked achievements
 *
 * Features:
 * - Animated entry with achievement-unlock animation
 * - Auto-dismiss after duration
 * - Achievement icon and details
 * - Shine effect overlay
 */
export function AchievementToast({
	achievement,
	open = true,
	onClose,
	onShare,
	duration = 5000,
	className,
}: AchievementToastProps) {
	const t = useTranslations('achievements')
	const tCommon = useTranslations('common')
	const [isVisible, setIsVisible] = useState(open)

	useEffect(() => {
		setIsVisible(open)
	}, [open])

	useEffect(() => {
		if (!isVisible) return

		const timer = setTimeout(() => {
			setIsVisible(false)
			setTimeout(onClose, 300) // Wait for exit animation
		}, duration)

		return () => clearTimeout(timer)
	}, [duration, onClose, isVisible])

	return (
		<div
			className={cn(
				'fixed bottom-24 left-1/2 z-toast -translate-x-1/2',
				'w-[calc(100%-2rem)] max-w-sm',
				isVisible ? 'animate-slide-up-fade' : 'animate-fade-out opacity-0',
				className,
			)}
		>
			<div className="relative overflow-hidden rounded-xl border bg-card shadow-lg">
				{/* Shine effect */}
				<div className="absolute inset-0 animate-achievement-shine pointer-events-none" />

				<div className="relative flex items-center gap-3 p-4">
					{/* Achievement icon */}
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 animate-achievement-unlock">
						{achievement.icon ? (
							<span className="text-2xl">{achievement.icon}</span>
						) : (
							<Award className="h-6 w-6 text-yellow-500" />
						)}
					</div>

					{/* Content */}
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="text-xs font-medium uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
								{t('unlocked')}
							</span>
						</div>
						<h3 className="font-semibold">{achievement.name}</h3>
						<p className="text-xs text-muted-foreground">{achievement.description}</p>
					</div>

					{/* Close button */}
					<button
						type="button"
						onClick={() => {
							setIsVisible(false)
							setTimeout(onClose, 300)
						}}
						className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Actions */}
				{onShare && (
					<div className="flex gap-2 border-t px-4 pb-3 pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								onShare()
								setIsVisible(false)
								setTimeout(onClose, 300)
							}}
							className="flex-1"
						>
							<Share2 className="mr-1.5 h-3.5 w-3.5" />
							{tCommon('share')}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setIsVisible(false)
								setTimeout(onClose, 300)
							}}
							className="flex-1"
						>
							{tCommon('dismiss')}
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}

'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSound } from '@/shared/hooks'

type SoundToggleProps = {
	className?: string
	showLabel?: boolean
}

/**
 * Sound Toggle Button
 * Allows users to enable/disable game sound effects.
 * State is persisted to localStorage.
 */
function _SoundToggle({ className, showLabel = false }: SoundToggleProps) {
	const t = useTranslations('common')
	const { isMuted, toggleSound, isSupported } = useSound()
	const [mounted, setMounted] = useState(false)

	// Prevent hydration mismatch
	useEffect(() => {
		setMounted(true)
	}, [])

	// Don't render on server or if not supported
	if (!mounted) {
		return (
			<button
				type="button"
				className={cn(
					'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 transition-colors',
					className,
				)}
				disabled
				aria-label={showLabel ? t('sound') : t('soundToggleLoading')}
			>
				<Volume2 className="h-5 w-5" aria-hidden="true" />
				{showLabel && <span className="text-sm">{t('sound')}</span>}
			</button>
		)
	}

	if (!isSupported) {
		return null
	}

	const Icon = isMuted ? VolumeX : Volume2
	const label = isMuted ? t('soundOff') : t('soundOn')

	return (
		<button
			type="button"
			onClick={toggleSound}
			className={cn(
				'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 transition-colors hover:bg-muted',
				className,
			)}
			title={label}
			aria-label={label}
			aria-pressed={!isMuted}
		>
			<Icon className={cn('h-5 w-5', isMuted && 'text-muted-foreground')} aria-hidden="true" />
			{showLabel && <span className="text-sm">{isMuted ? 'Off' : 'On'}</span>}
		</button>
	)
}

/**
 * Compact version for header - just the icon
 */
export function SoundToggleCompact({ className }: { className?: string }) {
	const t = useTranslations('common')
	const { isMuted, toggleSound, isSupported } = useSound()
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
				aria-label={t('soundToggleLoading')}
			>
				<Volume2 className="h-5 w-5" aria-hidden="true" />
			</button>
		)
	}

	if (!isSupported) {
		return null
	}

	const Icon = isMuted ? VolumeX : Volume2
	const label = isMuted ? t('soundOff') : t('soundOn')

	return (
		<button
			type="button"
			onClick={toggleSound}
			className={cn(
				'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted',
				className,
			)}
			title={label}
			aria-label={label}
			aria-pressed={!isMuted}
		>
			<Icon className={cn('h-5 w-5', isMuted && 'text-muted-foreground')} aria-hidden="true" />
		</button>
	)
}

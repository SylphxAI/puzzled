'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSound } from '@/shared/hooks'

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

'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { resolveModuleDisplayName } from '@/features/daily/lib/result-share'
import { getTomorrowsFreeGame } from '@/lib/free-rotation'
import { cn } from '@/lib/utils'

/**
 * "Tomorrow: Sudoku is free": the next product day's free module, read from
 * the same rotation that serves it (lib/free-rotation.ts), never a made-up
 * preview. It is computed after mount so the server clock cannot disagree
 * with the player's; a calm line, no pressure.
 */
export function TomorrowGameLine({ className }: { className?: string }) {
	const t = useTranslations('daily')
	const tGames = useTranslations('games')
	const [slug, setSlug] = useState<string | null>(null)

	useEffect(() => {
		setSlug(getTomorrowsFreeGame())
	}, [])

	return (
		<p className={cn('min-h-5 text-center text-sm text-muted-foreground', className)}>
			{slug ? t('tomorrowsFreeGame', { game: resolveModuleDisplayName(tGames, slug) }) : null}
		</p>
	)
}

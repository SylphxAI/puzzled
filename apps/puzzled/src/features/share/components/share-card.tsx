'use client'

import { Check, Copy, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { APP_DOMAIN, APP_NAME } from '@/lib/config/app'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'

type ShareCardType = 'daily-result' | 'streak-milestone' | 'achievement'

type ShareCardProps = {
	type: ShareCardType
	data: DailyResultData | StreakMilestoneData | AchievementData
	onShare?: () => void
}

type DailyResultData = {
	game: string
	/** Puzzle date in YYYY-MM-DD format */
	puzzleDate?: string
	attempts: number
	maxAttempts: number
	won: boolean
	streak?: number
	grid?: string[][] // Emoji grid for Wordle/Connections
}

type StreakMilestoneData = {
	streak: number
	userName?: string
	game?: string
}

type AchievementData = {
	name: string
	description: string
	tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
}

// Emoji squares for sharing - Distinctive Puzzled palette
const SHARE_SQUARES = {
	correct: '🟪', // Purple - Puzzled brand (differentiated from NYT green)
	present: '🟧', // Orange - warm, friendly (differentiated from NYT yellow)
	absent: '⬛',
	empty: '⬜',
	// Connections colors - Rose, Teal, Amber, Fuchsia
	rose: '🟥',
	teal: '🩵',
	amber: '🟨',
	fuchsia: '🟪',
}

export function ShareCard({ type, data, onShare }: ShareCardProps) {
	const t = useTranslations('share')
	const [copied, setCopied] = useState(false)
	const cardRef = useRef<HTMLDivElement>(null)

	const generateShareText = useCallback(() => {
		const baseUrl = APP_DOMAIN

		switch (type) {
			case 'daily-result': {
				const d = data as DailyResultData
				// Format date for share text (e.g., "Dec 18, 2024")
				const dateText = d.puzzleDate
					? new Intl.DateTimeFormat('en', {
							month: 'short',
							day: 'numeric',
							year: 'numeric',
						}).format(new Date(`${d.puzzleDate}T00:00:00Z`))
					: ''
				const header = `${APP_NAME} • ${d.game}${dateText ? ` • ${dateText}` : ''}`
				const result = d.won ? `${d.attempts}/${d.maxAttempts}` : `X/${d.maxAttempts}`
				const grid = d.grid ? `\n\n${d.grid.map((row) => row.join('')).join('\n')}` : ''
				const streak = d.streak ? `\n🔥 ${d.streak}-day streak` : ''

				return `${header}\n\nSolved in ${result} tries${grid}${streak}\n\n${baseUrl}`
			}

			case 'streak-milestone': {
				const d = data as StreakMilestoneData
				const emoji = d.streak >= 365 ? '🏆' : d.streak >= 100 ? '💎' : d.streak >= 30 ? '🌟' : '🔥'
				return `${emoji} STREAK MILESTONE ${emoji}\n\n${d.userName || 'I'} achieved a\n${d.streak}-DAY STREAK${d.game ? `\nin ${d.game}` : ''}!\n\nCan you beat it?\n${baseUrl}`
			}

			case 'achievement': {
				const d = data as AchievementData
				return `✨ ACHIEVEMENT UNLOCKED ✨\n\n🏅 "${d.name}"\n${d.description}\n\n@puzzledgg\n${baseUrl}`
			}

			default:
				return ''
		}
	}, [type, data])

	const handleCopy = async () => {
		const text = generateShareText()
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
			onShare?.()
		} catch {
			// Clipboard API failed - silent fallback (navigator.share available as alternative)
		}
	}

	const handleShare = async () => {
		const text = generateShareText()

		if (navigator.share) {
			try {
				await navigator.share({
					title: APP_NAME,
					text,
				})
				onShare?.()
			} catch (err) {
				// User cancelled or error
				if ((err as Error).name !== 'AbortError') {
					handleCopy() // Fallback to copy
				}
			}
		} else {
			handleCopy()
		}
	}

	return (
		<div className="space-y-4">
			{/* Preview Card */}
			<div
				ref={cardRef}
				className="rounded-xl border bg-card p-4 font-mono text-sm whitespace-pre-wrap"
			>
				{generateShareText()}
			</div>

			{/* Actions */}
			<div className="flex gap-2">
				<Button onClick={handleShare} className="flex-1 gap-2">
					<Share2 className="h-4 w-4" />
					{t('share')}
				</Button>
				<Button onClick={handleCopy} variant="outline" className="gap-2">
					{copied ? (
						<Check className="h-4 w-4 text-[var(--color-success)]" />
					) : (
						<Copy className="h-4 w-4" />
					)}
					{copied ? t('copied') : t('copy')}
				</Button>
			</div>
		</div>
	)
}

// Generate emoji grid for game results
export function generateWordleGrid(
	guesses: Array<{ letters: string[]; results: ('correct' | 'present' | 'absent')[] }>,
): string[][] {
	return guesses.map((guess) => guess.results.map((result) => SHARE_SQUARES[result]))
}

export function generateConnectionsGrid(
	solvedGroups: Array<{ difficulty: 0 | 1 | 2 | 3; mistakes: number }>,
): string[][] {
	// Puzzled palette: Rose, Teal, Amber, Fuchsia (differentiated from NYT)
	const colors = ['🟥', '🩵', '🟨', '🟪']
	return solvedGroups.map((group) => Array(4).fill(colors[group.difficulty]))
}

// Quick share button for inline use
export function QuickShareButton({ text, className }: { text: string; className?: string }) {
	const [copied, setCopied] = useState(false)

	const handleShare = async () => {
		if (navigator.share) {
			try {
				await navigator.share({ title: APP_NAME, text })
			} catch {
				// Fallback to copy
				await navigator.clipboard.writeText(text)
				setCopied(true)
				setTimeout(() => setCopied(false), 2000)
			}
		} else {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<button
			type="button"
			onClick={handleShare}
			className={cn(
				'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
				className,
			)}
		>
			{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
			{copied ? 'Copied!' : 'Share'}
		</button>
	)
}

'use client'

import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	Gamepad2,
	Loader2,
	RefreshCw,
	Sparkles,
	TrendingUp,
	Users,
	Wand2,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { trpc } from '@/trpc/client'

type GameCategory = 'word' | 'logic' | 'math' | 'spatial'

const categoryColors: Record<GameCategory, string> = {
	word: 'var(--admin-info)',
	logic: 'var(--admin-accent)',
	math: 'var(--admin-warning)',
	spatial: '#a855f7', // purple
}

const categoryLabels: Record<GameCategory, string> = {
	word: 'Word',
	logic: 'Logic',
	math: 'Math',
	spatial: 'Spatial',
}

export function GamesOverview() {
	const t = useTranslations('admin.games')
	const [generateStatus, setGenerateStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')

	const { data, isLoading, refetch, isRefetching } = trpc.admin.getGamesOverview.useQuery(undefined, {
		refetchInterval: 60000, // Refresh every minute
	})

	const generateMutation = trpc.admin.triggerPuzzleGeneration.useMutation({
		onMutate: () => setGenerateStatus('pending'),
		onSuccess: () => {
			setGenerateStatus('success')
			// Refetch after a delay to allow workflow to complete
			setTimeout(() => {
				refetch()
				setGenerateStatus('idle')
			}, 5000)
		},
		onError: () => setGenerateStatus('error'),
	})

	const handleGeneratePuzzles = () => {
		const today = new Date().toISOString().split('T')[0]
		generateMutation.mutate({ targetDate: today })
	}

	if (isLoading) {
		return <GamesOverviewSkeleton />
	}

	if (!data) {
		return (
			<div className="admin-card p-8 text-center">
				<AlertCircle className="mx-auto h-8 w-8 text-[var(--admin-error)]" />
				<p className="mt-2 text-[var(--admin-text-secondary)]">Failed to load games data</p>
			</div>
		)
	}

	const { games } = data

	// Group by puzzle status
	const withPuzzle = games.filter((g) => g.hasTodayPuzzle)
	const withoutPuzzle = games.filter((g) => !g.hasTodayPuzzle)

	// Stats summary
	const totalPlays7d = games.reduce((sum, g) => sum + g.plays7d, 0)
	const totalPlaysToday = games.reduce((sum, g) => sum + g.playsToday, 0)
	const avgCompletionRate = games.length > 0
		? Math.round(games.reduce((sum, g) => sum + g.completionRate, 0) / games.length)
		: 0

	return (
		<div className="space-y-6">
			{/* Header with refresh */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-[var(--admin-text-muted)]">
					{t('totalGames', { count: games.length })}
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					disabled={isRefetching}
					className="admin-btn admin-btn-ghost"
				>
					<RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
					{t('refresh')}
				</button>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<SummaryCard
					icon={<Gamepad2 className="h-5 w-5" />}
					label="Total Games"
					value={games.length}
				/>
				<SummaryCard
					icon={<TrendingUp className="h-5 w-5" />}
					label="Plays (7d)"
					value={totalPlays7d.toLocaleString()}
				/>
				<SummaryCard
					icon={<Users className="h-5 w-5" />}
					label="Plays Today"
					value={totalPlaysToday.toLocaleString()}
				/>
				<SummaryCard
					icon={<CheckCircle2 className="h-5 w-5" />}
					label="Avg Completion"
					value={`${avgCompletionRate}%`}
				/>
			</div>

			{/* Puzzle Status Alert */}
			{withoutPuzzle.length > 0 && (
				<div className="admin-card border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/5 p-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="flex items-start gap-3">
							<AlertCircle className="h-5 w-5 shrink-0 text-[var(--admin-warning)]" />
							<div>
								<h4 className="font-medium text-[var(--admin-warning)]">
									{withoutPuzzle.length} game{withoutPuzzle.length > 1 ? 's' : ''} missing today&apos;s puzzle
								</h4>
								<p className="mt-1 text-sm text-[var(--admin-warning)]/80">
									{withoutPuzzle.map((g) => g.name).join(', ')}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={handleGeneratePuzzles}
							disabled={generateStatus === 'pending'}
							className="admin-btn admin-btn-warning shrink-0"
						>
							{generateStatus === 'pending' ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Generating...
								</>
							) : generateStatus === 'success' ? (
								<>
									<CheckCircle2 className="h-4 w-4" />
									Triggered!
								</>
							) : (
								<>
									<Wand2 className="h-4 w-4" />
									Generate Now
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Games Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{games.map((game, index) => (
					<GameCard key={game.slug} game={game} delay={index} />
				))}
			</div>
		</div>
	)
}

function SummaryCard({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode
	label: string
	value: string | number
}) {
	return (
		<div className="admin-card p-4">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-accent-subtle)] text-[var(--admin-accent)]">
					{icon}
				</div>
				<div>
					<p className="text-2xl font-semibold text-[var(--admin-text-primary)]">{value}</p>
					<p className="text-xs text-[var(--admin-text-muted)]">{label}</p>
				</div>
			</div>
		</div>
	)
}

type GameData = {
	slug: string
	name: string
	category: GameCategory
	generationStrategy: 'seed' | 'llm'
	hasTodayPuzzle: boolean
	puzzleGeneratedAt: string | null
	plays7d: number
	completionRate: number
	uniquePlayers7d: number
	playsToday: number
}

function GameCard({ game, delay = 0 }: { game: GameData; delay?: number }) {
	const categoryColor = categoryColors[game.category] || 'var(--admin-text-muted)'

	return (
		<Link
			href={`/admin/games/${game.slug}`}
			className="admin-card admin-animate-in group block p-5 transition-all hover:border-[var(--admin-border-subtle)] hover:shadow-[var(--admin-shadow)]"
			style={{ animationDelay: `${delay * 0.03}s` }}
		>
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-bg-surface)]">
						<GameIcon slug={game.slug} size={24} className="text-[var(--admin-text-secondary)]" />
					</div>
					<div>
						<h3 className="font-semibold text-[var(--admin-text-primary)] group-hover:text-[var(--admin-accent)]">
							{game.name}
						</h3>
						<div className="mt-1 flex items-center gap-2">
							<span
								className="text-xs font-medium"
								style={{ color: categoryColor }}
							>
								{categoryLabels[game.category]}
							</span>
							{game.generationStrategy === 'llm' && (
								<span className="flex items-center gap-1 text-xs text-purple-400">
									<Sparkles className="h-3 w-3" />
									AI
								</span>
							)}
						</div>
					</div>
				</div>
				<ArrowRight className="h-4 w-4 text-[var(--admin-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
			</div>

			{/* Puzzle Status */}
			<div className="mt-4 flex items-center gap-2">
				{game.hasTodayPuzzle ? (
					<>
						<CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" />
						<span className="text-sm text-[var(--admin-success)]">Today&apos;s puzzle ready</span>
					</>
				) : (
					<>
						<AlertCircle className="h-4 w-4 text-[var(--admin-warning)]" />
						<span className="text-sm text-[var(--admin-warning)]">No puzzle for today</span>
					</>
				)}
			</div>

			{/* Stats */}
			<div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--admin-border)] pt-4">
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{game.plays7d.toLocaleString()}
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">Plays (7d)</p>
				</div>
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{game.completionRate}%
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">Win Rate</p>
				</div>
				<div>
					<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{game.playsToday.toLocaleString()}
					</p>
					<p className="text-xs text-[var(--admin-text-muted)]">Today</p>
				</div>
			</div>
		</Link>
	)
}

function GamesOverviewSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div className="h-5 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
				<div className="h-9 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
			</div>

			{/* Summary stats skeleton */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="admin-card p-4">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--admin-bg-surface)]" />
							<div className="space-y-2">
								<div className="h-6 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								<div className="h-3 w-20 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Cards skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<div key={i} className="admin-card p-5">
						<div className="flex items-center gap-3">
							<div className="h-12 w-12 animate-pulse rounded-xl bg-[var(--admin-bg-surface)]" />
							<div className="space-y-2">
								<div className="h-5 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								<div className="h-3 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
							</div>
						</div>
						<div className="mt-4 h-5 w-40 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--admin-border)] pt-4">
							{[1, 2, 3].map((j) => (
								<div key={j} className="space-y-1">
									<div className="h-6 w-12 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
									<div className="h-3 w-16 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

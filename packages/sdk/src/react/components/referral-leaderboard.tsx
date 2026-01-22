/**
 * ReferralLeaderboard Component
 *
 * Displays a leaderboard of top referrers with gamification elements.
 * Privacy-safe: Only shows masked names for other users.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeUser } from '../hooks'
import { useReferral, type LeaderboardEntry, type ReferralLeaderboardResult } from '../platform-hooks'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'
import type { LeaderboardPeriod } from '../../types'

export interface ReferralLeaderboardProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Initial period filter */
	defaultPeriod?: LeaderboardPeriod
	/** Show period selector tabs */
	showPeriodSelector?: boolean
	/** Maximum entries to display */
	limit?: number
	/** Title text */
	title?: string
	/** Show user's personal stats */
	showPersonalStats?: boolean
	/** Custom class name */
	className?: string
	/** Compact mode */
	compact?: boolean
	/** Callback when entry is clicked */
	onEntryClick?: (entry: LeaderboardEntry) => void
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
	all: 'All Time',
	month: 'This Month',
	week: 'This Week',
}

/**
 * ReferralLeaderboard component for displaying top referrers
 *
 * @example
 * ```tsx
 * <ReferralLeaderboard
 *   showPeriodSelector
 *   limit={10}
 *   showPersonalStats
 * />
 * ```
 */
export function ReferralLeaderboard({
	theme = defaultTheme,
	defaultPeriod = 'all',
	showPeriodSelector = true,
	limit = 10,
	title = 'Top Referrers',
	showPersonalStats = true,
	className,
	compact = false,
	onEntryClick,
}: ReferralLeaderboardProps) {
	const { user, isConfigured: userConfigured } = useSafeUser()
	const { stats, code, getLeaderboard } = useReferral()
	const queryClient = useQueryClient()
	const styles = baseStyles(theme)

	const [period, setPeriod] = useState<LeaderboardPeriod>(defaultPeriod)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// React Query for leaderboard data
	const leaderboardQuery = useQuery({
		queryKey: ['sylphx', 'referral', 'leaderboard', limit, period],
		queryFn: () => getLeaderboard({ limit, period }),
		staleTime: 60 * 1000, // 1 min - leaderboard may change
	})

	const leaderboard = leaderboardQuery.data ?? null
	const isLoading = leaderboardQuery.isLoading
	const error = leaderboardQuery.error instanceof Error
		? leaderboardQuery.error.message
		: leaderboardQuery.error ? 'Failed to load leaderboard' : null

	// Derive personal stats from hook data (memoized)
	const personalStats = useMemo(() => {
		if (!showPersonalStats || !user || !stats) return null
		return {
			totalReferrals: stats.totalReferrals,
			completedReferrals: stats.completedReferrals ?? stats.successfulReferrals,
			code: code ?? null,
		}
	}, [showPersonalStats, user, stats, code])

	// Retry handler via React Query
	const handleRetry = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['sylphx', 'referral', 'leaderboard'] })
	}, [queryClient])

	// Rank badge color
	const getRankColor = (rank: number) => {
		if (rank === 1) return '#FFD700' // Gold
		if (rank === 2) return '#C0C0C0' // Silver
		if (rank === 3) return '#CD7F32' // Bronze
		return theme.colorMutedForeground
	}

	// Rank badge styles
	const rankBadgeStyles = (rank: number): React.CSSProperties => ({
		width: compact ? '1.5rem' : '2rem',
		height: compact ? '1.5rem' : '2rem',
		borderRadius: '50%',
		backgroundColor: rank <= 3 ? `${getRankColor(rank)}20` : theme.colorMuted,
		color: getRankColor(rank),
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: compact ? theme.fontSizeXs : theme.fontSizeSm,
		fontWeight: 700,
		flexShrink: 0,
	})

	const avatarStyles: React.CSSProperties = {
		width: compact ? '2rem' : '2.5rem',
		height: compact ? '2rem' : '2.5rem',
		borderRadius: '50%',
		backgroundColor: theme.colorPrimary,
		color: theme.colorPrimaryForeground,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: compact ? theme.fontSizeSm : theme.fontSizeBase,
		fontWeight: 600,
		flexShrink: 0,
	}

	const entryStyles = (isCurrentUser: boolean): React.CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
		padding: compact ? '0.5rem 0.75rem' : '0.75rem 1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
		backgroundColor: isCurrentUser ? `${theme.colorPrimary}08` : 'transparent',
		cursor: onEntryClick ? 'pointer' : 'default',
		transition: 'background-color 0.15s ease',
	})

	if (isLoading) {
		return (
			<div className={className} style={mergeStyles(styles.flexCenter, { padding: '2rem' })}>
				<span style={mergeStyles(styles.spinner, { width: '1.5rem', height: '1.5rem' })} />
			</div>
		)
	}

	if (error) {
		return (
			<div className={className}>
				<div style={mergeStyles(styles.alert, styles.alertError)}>
					<div style={{ marginBottom: '0.75rem' }}>{error}</div>
					<button
						type="button"
						onClick={handleRetry}
						style={mergeStyles(styles.button, styles.buttonOutline, {
							padding: '0.5rem 1rem',
							fontSize: theme.fontSizeSm,
						})}
					>
						<RefreshIcon size={14} color={theme.colorForeground} />
						Try Again
					</button>
				</div>
			</div>
		)
	}

	const entries = leaderboard?.entries ?? []

	return (
		<div className={className}>
			{/* Header */}
			<div
				style={mergeStyles(styles.flexBetween, {
					marginBottom: '1rem',
					flexWrap: 'wrap',
					gap: '0.75rem',
				})}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
					<TrophyIcon size={compact ? 18 : 20} color={theme.colorWarning} />
					<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>
						{title}
					</h3>
				</div>

				{/* Period selector */}
				{showPeriodSelector && (
					<div
						style={{
							display: 'flex',
							gap: '0.25rem',
							backgroundColor: theme.colorMuted,
							borderRadius: theme.borderRadius,
							padding: '0.25rem',
						}}
					>
						{(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => setPeriod(p)}
								style={{
									padding: '0.25rem 0.75rem',
									fontSize: theme.fontSizeXs,
									fontWeight: period === p ? 600 : 400,
									backgroundColor: period === p ? theme.colorBackground : 'transparent',
									color: period === p ? theme.colorForeground : theme.colorMutedForeground,
									border: 'none',
									borderRadius: theme.borderRadiusSm,
									cursor: 'pointer',
									transition: 'all 0.15s ease',
								}}
							>
								{PERIOD_LABELS[p]}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Personal stats card */}
			{showPersonalStats && personalStats && (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, 1fr)',
						gap: '0.5rem',
						marginBottom: '1rem',
						padding: '0.75rem',
						backgroundColor: `${theme.colorPrimary}08`,
						borderRadius: theme.borderRadius,
						border: `1px solid ${theme.colorPrimary}20`,
					}}
				>
					<div style={{ textAlign: 'center' }}>
						<div style={{ fontSize: theme.fontSizeLg, fontWeight: 700, color: theme.colorPrimary }}>
							{leaderboard?.currentUserRank ?? '-'}
						</div>
						<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
							Your Rank
						</div>
					</div>
					<div style={{ textAlign: 'center' }}>
						<div style={{ fontSize: theme.fontSizeLg, fontWeight: 700, color: theme.colorSuccess }}>
							{personalStats.completedReferrals}
						</div>
						<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
							Completed
						</div>
					</div>
					<div style={{ textAlign: 'center' }}>
						<div style={{ fontSize: theme.fontSizeLg, fontWeight: 700, color: theme.colorMutedForeground }}>
							{personalStats.totalReferrals}
						</div>
						<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
							Total
						</div>
					</div>
				</div>
			)}

			{/* Leaderboard */}
			{entries.length === 0 ? (
				<div
					style={mergeStyles(styles.textCenter, styles.textMuted, {
						padding: '2rem',
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
					})}
				>
					<UserGroupIcon size={32} color={theme.colorMutedForeground} />
					<p style={{ margin: '0.5rem 0 0' }}>No referrals yet</p>
					<p style={{ fontSize: theme.fontSizeXs, margin: '0.25rem 0 0' }}>
						Be the first to climb the leaderboard!
					</p>
				</div>
			) : (
				<div
					style={{
						border: `1px solid ${theme.colorBorder}`,
						borderRadius: theme.borderRadius,
						overflow: 'hidden',
					}}
				>
					{entries.map((entry) => (
						<div
							key={`${entry.rank}-${entry.displayName}`}
							style={entryStyles(entry.isCurrentUser)}
							onClick={() => onEntryClick?.(entry)}
							onKeyDown={(e) => e.key === 'Enter' && onEntryClick?.(entry)}
							tabIndex={onEntryClick ? 0 : undefined}
							role={onEntryClick ? 'button' : undefined}
						>
							{/* Rank badge */}
							<div style={rankBadgeStyles(entry.rank)}>
								{entry.rank <= 3 ? (
									<MedalIcon rank={entry.rank} size={compact ? 12 : 14} />
								) : (
									entry.rank
								)}
							</div>

							{/* Avatar */}
							{entry.avatarUrl ? (
								<img
									src={entry.avatarUrl}
									alt={entry.displayName}
									style={{ ...avatarStyles, objectFit: 'cover' }}
								/>
							) : (
								<div style={avatarStyles}>
									{entry.displayName.charAt(0).toUpperCase()}
								</div>
							)}

							{/* Info */}
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', alignItems: 'center' })}>
									<span
										style={{
											fontWeight: 500,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{entry.displayName}
									</span>
									{entry.isCurrentUser && (
										<span
											style={{
												fontSize: theme.fontSizeXs,
												color: theme.colorPrimaryForeground,
												backgroundColor: theme.colorPrimary,
												padding: '0.0625rem 0.375rem',
												borderRadius: '9999px',
												fontWeight: 500,
											}}
										>
											You
										</span>
									)}
								</div>
							</div>

							{/* Stats */}
							<div style={{ textAlign: 'right' }}>
								<div style={{ fontSize: theme.fontSizeLg, fontWeight: 700, color: theme.colorSuccess }}>
									{entry.completedReferrals}
								</div>
								<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
									referrals
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

// Icons
function TrophyIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
			<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
			<path d="M4 22h16" />
			<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
			<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
			<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
		</svg>
	)
}

function UserGroupIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	)
}

function MedalIcon({ rank, size = 16 }: { rank: number; size?: number }) {
	// Medal emoji based on rank
	const medals = ['', '🥇', '🥈', '🥉']
	return (
		<span style={{ fontSize: size, lineHeight: 1 }}>
			{medals[rank] || rank}
		</span>
	)
}

function RefreshIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flexShrink: 0, marginRight: '0.25rem' }}
		>
			<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
			<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
			<path d="M16 16h5v5" />
		</svg>
	)
}

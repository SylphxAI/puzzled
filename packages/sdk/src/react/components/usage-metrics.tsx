/**
 * Usage Metrics Component
 *
 * Displays platform usage breakdown by service.
 * Shows current period usage and costs.
 */

'use client'

import { useEffect, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlatformContext } from '../platform-context'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'

interface UsageData {
	period: {
		type: 'hour' | 'day' | 'month'
		start: string
		end: string
	}
	metrics: {
		aiInputTokens: number
		aiOutputTokens: number
		aiCostMicrodollars: number
		aiImageCount: number
		storageBytesSnapshot: number
		storageUploadCount: number
		storageDownloadCount: number
		storageEgressBytes: number
		dbStorageBytes: number
		dbComputeSeconds: number
		dbWrittenBytes: number
		dbDataTransferBytes: number
		emailSentCount: number
		jobInvocationCount: number
		cronActiveCount: number
		pushSentCount: number
		analyticsEventCount: number
		webhookDeliveryCount: number
		errorEventCount: number
		authMau: number
	} | null
}

interface ServiceMetric {
	name: string
	icon: React.ReactNode
	value: string
	subtext?: string
	color: string
}

export interface UsageMetricsProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Period to show usage for */
	period?: 'hour' | 'day' | 'month'
	/** Services to show (defaults to all) */
	services?: ('ai' | 'storage' | 'database' | 'email' | 'jobs' | 'push' | 'analytics' | 'webhooks' | 'monitoring' | 'auth')[]
	/** Card variant */
	variant?: 'default' | 'compact' | 'grid'
	/** Custom class name */
	className?: string
}

/**
 * Usage metrics card showing platform usage breakdown
 *
 * @example
 * ```tsx
 * <UsageMetrics
 *   period="month"
 *   services={['ai', 'storage', 'email']}
 * />
 * ```
 */
export function UsageMetrics({
	theme = defaultTheme,
	period = 'month',
	services,
	variant = 'default',
	className,
}: UsageMetricsProps) {
	const ctx = useContext(PlatformContext)
	const styles = baseStyles(theme)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Fetch usage data with React Query
	const usageQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'usage', period],
		queryFn: async (): Promise<UsageData> => {
			if (!ctx) throw new Error('Platform context not available')
			// Convert period to month format (YYYY-MM) if needed
			// The new API only supports monthly granularity
			const now = new Date()
			const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
			const data = await ctx.getBillingUsage({ month: monthStr })

			// Map to expected UsageData format
			return {
				period: {
					type: period,
					start: data.period.start,
					end: data.period.end,
				},
				metrics: data.metrics ? {
					aiInputTokens: 0, // Not available in new API
					aiOutputTokens: 0,
					aiCostMicrodollars: data.metrics.aiCostMicrodollars,
					aiImageCount: 0,
					storageBytesSnapshot: data.metrics.storageBytesUsed,
					storageUploadCount: data.metrics.storageUploads,
					storageDownloadCount: 0, // Not available
					storageEgressBytes: data.metrics.storageEgressBytes,
					dbStorageBytes: data.metrics.dbStorageBytes,
					dbComputeSeconds: data.metrics.dbComputeSeconds,
					dbWrittenBytes: 0, // Not available
					dbDataTransferBytes: 0, // Not available
					emailSentCount: data.metrics.emailSentCount,
					jobInvocationCount: data.metrics.jobInvocationCount,
					cronActiveCount: data.metrics.cronActiveCount,
					pushSentCount: data.metrics.pushSentCount ?? 0,
					analyticsEventCount: data.metrics.analyticsEventCount,
					webhookDeliveryCount: data.metrics.webhookDeliveryCount,
					errorEventCount: data.metrics.errorEventCount,
					authMau: data.metrics.authMau,
				} : null,
			}
		},
		enabled: !!ctx,
		staleTime: 5 * 60 * 1000, // 5 min - usage data is relatively stable
	})

	const usage = usageQuery.data ?? null
	const isLoading = usageQuery.isLoading
	const error = usageQuery.error instanceof Error
		? usageQuery.error.message
		: usageQuery.error ? 'Failed to load usage' : null

	// Format helpers
	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B'
		const k = 1024
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
	}

	const formatNumber = (num: number): string => {
		if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
		if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
		return num.toString()
	}

	const formatCost = (microdollars: number): string => {
		return `$${(microdollars / 1_000_000).toFixed(2)}`
	}

	// Build service metrics
	const buildMetrics = (): ServiceMetric[] => {
		if (!usage?.metrics) return []

		const m = usage.metrics
		const allMetrics: Record<string, ServiceMetric> = {
			ai: {
				name: 'AI',
				icon: <SparklesIcon color={theme.colorPrimary} />,
				value: formatNumber(m.aiInputTokens + m.aiOutputTokens),
				subtext: `tokens • ${formatCost(m.aiCostMicrodollars)}`,
				color: theme.colorPrimary,
			},
			storage: {
				name: 'Storage',
				icon: <CloudIcon color="#10b981" />,
				value: formatBytes(m.storageBytesSnapshot),
				subtext: `${formatNumber(m.storageUploadCount)} uploads`,
				color: '#10b981',
			},
			database: {
				name: 'Database',
				icon: <DatabaseIcon color="#6366f1" />,
				value: formatBytes(m.dbStorageBytes),
				subtext: `${(m.dbComputeSeconds / 3600).toFixed(1)}h compute`,
				color: '#6366f1',
			},
			email: {
				name: 'Email',
				icon: <MailIcon color="#f59e0b" />,
				value: formatNumber(m.emailSentCount),
				subtext: 'emails sent',
				color: '#f59e0b',
			},
			jobs: {
				name: 'Jobs',
				icon: <ClockIcon color="#8b5cf6" />,
				value: formatNumber(m.jobInvocationCount),
				subtext: `${m.cronActiveCount} active crons`,
				color: '#8b5cf6',
			},
			push: {
				name: 'Push',
				icon: <BellIcon color="#ec4899" />,
				value: formatNumber(m.pushSentCount),
				subtext: 'notifications',
				color: '#ec4899',
			},
			analytics: {
				name: 'Analytics',
				icon: <ChartIcon color="#14b8a6" />,
				value: formatNumber(m.analyticsEventCount),
				subtext: 'events tracked',
				color: '#14b8a6',
			},
			webhooks: {
				name: 'Webhooks',
				icon: <WebhookIcon color="#64748b" />,
				value: formatNumber(m.webhookDeliveryCount),
				subtext: 'deliveries',
				color: '#64748b',
			},
			monitoring: {
				name: 'Monitoring',
				icon: <AlertIcon color="#ef4444" />,
				value: formatNumber(m.errorEventCount),
				subtext: 'errors tracked',
				color: '#ef4444',
			},
			auth: {
				name: 'Auth',
				icon: <UserIcon color="#3b82f6" />,
				value: formatNumber(m.authMau),
				subtext: 'monthly active users',
				color: '#3b82f6',
			},
		}

		const selectedServices = services || Object.keys(allMetrics)
		return selectedServices
			.filter((s) => s in allMetrics)
			.map((s) => allMetrics[s])
			.filter((m) => m.value !== '0' && m.value !== '0 B') // Hide zero values
	}

	if (isLoading) {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, styles.flexCenter, { padding: '2rem' })}>
					<span style={mergeStyles(styles.spinner, { width: '1.5rem', height: '1.5rem' })} />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, { padding: '1.5rem' })}>
					<div style={mergeStyles(styles.alert, styles.alertError)}>
						{error}
					</div>
				</div>
			</div>
		)
	}

	const metrics = buildMetrics()

	// Format period display
	const periodLabel = period === 'hour' ? 'This Hour' : period === 'day' ? 'Today' : 'This Month'
	const periodDates = usage?.period
		? `${new Date(usage.period.start).toLocaleDateString()} - ${new Date(usage.period.end).toLocaleDateString()}`
		: ''

	// Compact variant
	if (variant === 'compact') {
		return (
			<div style={styles.card} className={className}>
				<div style={mergeStyles(styles.cardContent, { padding: '1rem' })}>
					<div style={mergeStyles(styles.flexBetween, { marginBottom: '0.75rem' })}>
						<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{periodLabel}</span>
						<span style={mergeStyles(styles.textXs, styles.textMuted)}>{periodDates}</span>
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
						{metrics.map((metric) => (
							<div key={metric.name} style={{ minWidth: '80px' }}>
								<div style={{ fontSize: theme.fontSizeLg, fontWeight: 600 }}>{metric.value}</div>
								<div style={mergeStyles(styles.textXs, styles.textMuted)}>{metric.name}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		)
	}

	// Grid variant
	if (variant === 'grid') {
		return (
			<div className={className}>
				<div style={mergeStyles(styles.flexBetween, { marginBottom: '1rem' })}>
					<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>Usage - {periodLabel}</h3>
					<span style={mergeStyles(styles.textSm, styles.textMuted)}>{periodDates}</span>
				</div>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
						gap: '1rem',
					}}
				>
					{metrics.map((metric) => (
						<div
							key={metric.name}
							style={{
								padding: '1rem',
								backgroundColor: theme.colorMuted,
								borderRadius: theme.borderRadius,
								borderLeft: `3px solid ${metric.color}`,
							}}
						>
							<div style={mergeStyles(styles.flexRow, { gap: '0.5rem', marginBottom: '0.5rem' })}>
								{metric.icon}
								<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{metric.name}</span>
							</div>
							<div style={{ fontSize: theme.fontSizeXl, fontWeight: 700 }}>{metric.value}</div>
							{metric.subtext && (
								<div style={mergeStyles(styles.textXs, styles.textMuted, { marginTop: '0.25rem' })}>
									{metric.subtext}
								</div>
							)}
						</div>
					))}
				</div>
				{metrics.length === 0 && (
					<div style={mergeStyles(styles.textCenter, styles.textMuted, { padding: '2rem' })}>
						No usage recorded for this period
					</div>
				)}
			</div>
		)
	}

	// Default variant
	return (
		<div style={styles.card} className={className}>
			<div style={styles.cardContent}>
				<div style={mergeStyles(styles.flexBetween, { marginBottom: '1rem' })}>
					<div>
						<h3 style={mergeStyles(styles.cardTitle, { margin: 0 })}>Usage</h3>
						<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0.125rem 0 0' })}>
							{periodLabel}
						</p>
					</div>
					<span style={mergeStyles(styles.textXs, styles.textMuted)}>{periodDates}</span>
				</div>

				{metrics.length === 0 ? (
					<div style={mergeStyles(styles.textCenter, styles.textMuted, { padding: '2rem' })}>
						No usage recorded for this period
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
						{metrics.map((metric) => (
							<div
								key={metric.name}
								style={mergeStyles(styles.flexBetween, {
									padding: '0.75rem',
									backgroundColor: theme.colorMuted,
									borderRadius: theme.borderRadius,
								})}
							>
								<div style={mergeStyles(styles.flexRow, { gap: '0.75rem' })}>
									{metric.icon}
									<div>
										<div style={{ fontWeight: 500 }}>{metric.name}</div>
										{metric.subtext && (
											<div style={mergeStyles(styles.textXs, styles.textMuted)}>
												{metric.subtext}
											</div>
										)}
									</div>
								</div>
								<div style={{ fontSize: theme.fontSizeLg, fontWeight: 600 }}>{metric.value}</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

// Icons
function SparklesIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
		</svg>
	)
}

function CloudIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
		</svg>
	)
}

function DatabaseIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<ellipse cx="12" cy="5" rx="9" ry="3" />
			<path d="M3 5V19A9 3 0 0 0 21 19V5" />
			<path d="M3 12A9 3 0 0 0 21 12" />
		</svg>
	)
}

function MailIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect width="20" height="16" x="2" y="4" rx="2" />
			<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
		</svg>
	)
}

function ClockIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	)
}

function BellIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
			<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
		</svg>
	)
}

function ChartIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3 3v18h18" />
			<path d="m19 9-5 5-4-4-3 3" />
		</svg>
	)
}

function WebhookIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
			<path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
			<path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
		</svg>
	)
}

function AlertIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" x2="12" y1="8" y2="12" />
			<line x1="12" x2="12.01" y1="16" y2="16" />
		</svg>
	)
}

function UserIcon({ color }: { color: string }) {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	)
}

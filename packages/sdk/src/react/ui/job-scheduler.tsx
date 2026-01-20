/**
 * Job Scheduler UI Components
 *
 * UI for scheduling and managing background jobs.
 */

'use client'

import { useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useJobs, type Job, type JobStatus, type JobStatusFilter } from '../job-hooks'

// ============================================
// Types
// ============================================

export interface JobSchedulerProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Called when job is scheduled */
	onSchedule?: (job: Job) => void
	/** Default callback URL */
	defaultCallbackUrl?: string
	/** Show cron tab */
	showCronTab?: boolean
}

export interface JobListProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Jobs to display */
	jobs?: Job[]
	/** Called when job is cancelled */
	onCancel?: (jobId: string) => void
	/** Called when job is retried */
	onRetry?: (job: Job) => void
	/** Show filters */
	showFilters?: boolean
	/** Auto-refresh interval in ms (0 to disable) */
	refreshInterval?: number
	/** Empty state message */
	emptyMessage?: string
}

export interface CronBuilderProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Called when cron is created */
	onCreate?: (expression: string, callbackUrl: string, name: string) => void
	/** Default callback URL */
	defaultCallbackUrl?: string
}

// ============================================
// JobScheduler
// ============================================

/**
 * Schedule a one-time or cron job
 *
 * @example
 * ```tsx
 * <JobScheduler
 *   onSchedule={(job) => console.log('Scheduled:', job)}
 *   defaultCallbackUrl="https://api.example.com/webhook"
 * />
 * ```
 */
export function JobScheduler({
	theme = defaultTheme,
	className,
	onSchedule,
	defaultCallbackUrl = '',
	showCronTab = true,
}: JobSchedulerProps) {
	const { schedule, createCron, isLoading, error } = useJobs()
	const [activeTab, setActiveTab] = useState<'one-time' | 'cron'>('one-time')
	const [name, setName] = useState('')
	const [callbackUrl, setCallbackUrl] = useState(defaultCallbackUrl)
	const [payload, setPayload] = useState('{}')
	const [delay, setDelay] = useState(60)
	const [delayUnit, setDelayUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds')
	const [cronExpression, setCronExpression] = useState('0 9 * * *')
	const [scheduleSuccess, setScheduleSuccess] = useState(false)

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	useEffect(() => {
		if (scheduleSuccess) {
			const timer = setTimeout(() => setScheduleSuccess(false), 3000)
			return () => clearTimeout(timer)
		}
	}, [scheduleSuccess])

	const handleSchedule = async (e: FormEvent) => {
		e.preventDefault()
		if (!callbackUrl) return

		let parsedPayload = {}
		try {
			parsedPayload = JSON.parse(payload)
		} catch {
			// Keep empty object
		}

		const delaySeconds = delay * (delayUnit === 'minutes' ? 60 : delayUnit === 'hours' ? 3600 : 1)

		const result = await schedule({
			callbackUrl,
			payload: parsedPayload,
			delay: delaySeconds,
			name: name || undefined,
		})

		if (result.jobId) {
			setScheduleSuccess(true)
			onSchedule?.({
				id: result.jobId,
				name: name || null,
				type: 'one-time',
				status: 'pending',
				scheduledFor: result.scheduledFor ?? null,
				callbackUrl,
				retries: 0,
				maxRetries: 3,
				createdAt: new Date(),
			})
		}
	}

	const handleCron = async (e: FormEvent) => {
		e.preventDefault()
		if (!callbackUrl || !cronExpression) return

		let parsedPayload = {}
		try {
			parsedPayload = JSON.parse(payload)
		} catch {
			// Keep empty object
		}

		const result = await createCron({
			callbackUrl,
			cron: cronExpression,
			payload: parsedPayload,
			name: name || `Cron Job ${new Date().getTime()}`,
		})

		if (result.scheduleId) {
			setScheduleSuccess(true)
		}
	}

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		overflow: 'hidden',
	}

	const tabStyle = (isActive: boolean): CSSProperties => ({
		flex: 1,
		padding: '0.75rem',
		border: 'none',
		backgroundColor: isActive ? theme.colorBackground : theme.colorMuted,
		color: isActive ? theme.colorForeground : theme.colorMutedForeground,
		fontWeight: isActive ? 600 : 400,
		fontSize: theme.fontSizeSm,
		cursor: 'pointer',
		transition: 'all 0.15s ease',
	})

	const inputStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	}

	return (
		<div style={containerStyle} className={className}>
			{/* Tabs */}
			{showCronTab && (
				<div style={{ display: 'flex', borderBottom: `1px solid ${theme.colorBorder}` }}>
					<button
						type="button"
						onClick={() => setActiveTab('one-time')}
						style={tabStyle(activeTab === 'one-time')}
					>
						<ClockIcon color={activeTab === 'one-time' ? theme.colorPrimary : theme.colorMutedForeground} />
						{' '}One-time Job
					</button>
					<button
						type="button"
						onClick={() => setActiveTab('cron')}
						style={tabStyle(activeTab === 'cron')}
					>
						<RepeatIcon color={activeTab === 'cron' ? theme.colorPrimary : theme.colorMutedForeground} />
						{' '}Recurring (Cron)
					</button>
				</div>
			)}

			<div style={{ padding: '1.5rem' }}>
				{scheduleSuccess && (
					<div style={mergeStyles(styles.alert, styles.alertSuccess, { marginBottom: '1rem' })}>
						Job scheduled successfully!
					</div>
				)}

				{error && (
					<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>
						{error.message}
					</div>
				)}

				<form onSubmit={activeTab === 'one-time' ? handleSchedule : handleCron}>
					<div style={{ marginBottom: '1rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
							Job Name (optional)
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							style={inputStyle}
							placeholder="send-welcome-email"
						/>
					</div>

					<div style={{ marginBottom: '1rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
							Callback URL *
						</label>
						<input
							type="url"
							value={callbackUrl}
							onChange={(e) => setCallbackUrl(e.target.value)}
							style={inputStyle}
							placeholder="https://api.example.com/jobs/callback"
							required
						/>
						<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
							We'll send a POST request to this URL when the job runs
						</p>
					</div>

					{activeTab === 'one-time' ? (
						<div style={{ marginBottom: '1rem' }}>
							<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
								Delay
							</label>
							<div style={{ display: 'flex', gap: '0.5rem' }}>
								<input
									type="number"
									value={delay}
									onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
									min={0}
									style={{ ...inputStyle, flex: 1 }}
								/>
								<select
									value={delayUnit}
									onChange={(e) => setDelayUnit(e.target.value as 'seconds' | 'minutes' | 'hours')}
									style={{ ...inputStyle, flex: 1 }}
								>
									<option value="seconds">Seconds</option>
									<option value="minutes">Minutes</option>
									<option value="hours">Hours</option>
								</select>
							</div>
						</div>
					) : (
						<div style={{ marginBottom: '1rem' }}>
							<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
								Cron Expression
							</label>
							<input
								type="text"
								value={cronExpression}
								onChange={(e) => setCronExpression(e.target.value)}
								style={inputStyle}
								placeholder="0 9 * * *"
								required
							/>
							<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
								Format: minute hour day month weekday (e.g., "0 9 * * *" = 9:00 AM daily)
							</p>
						</div>
					)}

					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
							Payload (JSON)
						</label>
						<textarea
							value={payload}
							onChange={(e) => setPayload(e.target.value)}
							style={{ ...inputStyle, minHeight: '80px', fontFamily: 'monospace', fontSize: theme.fontSizeXs }}
							placeholder='{"key": "value"}'
						/>
					</div>

					<button
						type="submit"
						disabled={isLoading || !callbackUrl}
						style={mergeStyles(styles.button, styles.buttonPrimary, { width: '100%' })}
					>
						{isLoading ? <span style={styles.spinner} /> : activeTab === 'one-time' ? 'Schedule Job' : 'Create Cron Job'}
					</button>
				</form>
			</div>
		</div>
	)
}

// ============================================
// JobList
// ============================================

/**
 * List of scheduled jobs with status
 *
 * @example
 * ```tsx
 * <JobList
 *   onCancel={(jobId) => cancelJob(jobId)}
 *   showFilters
 *   refreshInterval={5000}
 * />
 * ```
 */
export function JobList({
	theme = defaultTheme,
	className,
	jobs: propJobs,
	onCancel,
	onRetry,
	showFilters = true,
	refreshInterval = 0,
	emptyMessage = 'No jobs scheduled',
}: JobListProps) {
	const { listJobs, cancelJob, isLoading } = useJobs()
	const [jobs, setJobs] = useState<Job[]>(propJobs ?? [])
	// UI filter includes 'cancelled' for display filtering, but API doesn't support it as a filter
	const [filter, setFilter] = useState<JobStatusFilter | 'cancelled' | 'all'>('all')

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Fetch jobs if not provided
	useEffect(() => {
		if (!propJobs) {
			const fetchJobs = async () => {
				// API doesn't support 'cancelled' filter, so fetch all and filter client-side
				const apiStatus = filter === 'all' || filter === 'cancelled' ? undefined : filter
				const result = await listJobs({ status: apiStatus })
				setJobs(result)
			}
			fetchJobs()

			if (refreshInterval > 0) {
				const interval = setInterval(fetchJobs, refreshInterval)
				return () => clearInterval(interval)
			}
		}
	}, [propJobs, filter, listJobs, refreshInterval])

	useEffect(() => {
		if (propJobs) {
			setJobs(propJobs)
		}
	}, [propJobs])

	const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)

	const handleCancel = async (jobId: string) => {
		if (onCancel) {
			onCancel(jobId)
		} else {
			await cancelJob(jobId)
			setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'cancelled' as JobStatus } : j)))
		}
	}

	const statusColors: Record<string, { bg: string; text: string }> = {
		pending: { bg: `${theme.colorWarning}20`, text: theme.colorWarning },
		queued: { bg: `${theme.colorPrimary}20`, text: theme.colorPrimary },
		running: { bg: `${theme.colorPrimary}20`, text: theme.colorPrimary },
		completed: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
		failed: { bg: `${theme.colorDestructive}20`, text: theme.colorDestructive },
		scheduled: { bg: `${theme.colorPrimary}20`, text: theme.colorPrimary },
		paused: { bg: theme.colorMuted, text: theme.colorMutedForeground },
		cancelled: { bg: theme.colorMuted, text: theme.colorMutedForeground },
		deleted: { bg: theme.colorMuted, text: theme.colorMutedForeground },
	}
	const defaultStatusColor = { bg: theme.colorMuted, text: theme.colorMutedForeground }

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
	}

	const jobItemStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
	}

	return (
		<div style={containerStyle} className={className}>
			{showFilters && (
				<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
					{(['all', 'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'] as const).map((status) => (
						<button
							key={status}
							type="button"
							onClick={() => setFilter(status)}
							style={{
								padding: '0.375rem 0.75rem',
								fontSize: theme.fontSizeXs,
								border: `1px solid ${filter === status ? theme.colorPrimary : theme.colorBorder}`,
								borderRadius: theme.borderRadiusSm,
								backgroundColor: filter === status ? `${theme.colorPrimary}10` : 'transparent',
								color: filter === status ? theme.colorPrimary : theme.colorMutedForeground,
								cursor: 'pointer',
								textTransform: 'capitalize',
							}}
						>
							{status}
						</button>
					))}
				</div>
			)}

			<div style={{ border: `1px solid ${theme.colorBorder}`, borderRadius: theme.borderRadius, overflow: 'hidden' }}>
				{isLoading && jobs.length === 0 ? (
					<div style={{ padding: '2rem', textAlign: 'center' }}>
						<span style={styles.spinner} />
					</div>
				) : filteredJobs.length === 0 ? (
					<div style={{ padding: '3rem', textAlign: 'center', color: theme.colorMutedForeground }}>
						<JobIcon color={theme.colorMuted} size={48} />
						<p style={{ margin: '1rem 0 0' }}>{emptyMessage}</p>
					</div>
				) : (
					filteredJobs.map((job, i) => (
						<div key={job.id} style={{ ...jobItemStyle, borderBottom: i === filteredJobs.length - 1 ? 'none' : jobItemStyle.borderBottom }}>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
									<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{job.name || job.id}</span>
									<span
										style={{
											fontSize: theme.fontSizeXs,
											padding: '0.125rem 0.375rem',
											borderRadius: theme.borderRadiusSm,
											backgroundColor: (statusColors[job.status] ?? defaultStatusColor).bg,
											color: (statusColors[job.status] ?? defaultStatusColor).text,
											textTransform: 'capitalize',
										}}
									>
										{job.status}
									</span>
								</div>
								<div style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
									{job.scheduledFor && `Scheduled: ${new Date(job.scheduledFor).toLocaleString()}`}
									{job.completedAt && ` • Completed: ${new Date(job.completedAt).toLocaleString()}`}
								</div>
							</div>
							<div style={{ display: 'flex', gap: '0.5rem' }}>
								{job.status === 'pending' && (
									<button
										type="button"
										onClick={() => handleCancel(job.id)}
										style={{
											padding: '0.25rem 0.5rem',
											fontSize: theme.fontSizeXs,
											border: `1px solid ${theme.colorDestructive}`,
											borderRadius: theme.borderRadiusSm,
											backgroundColor: 'transparent',
											color: theme.colorDestructive,
											cursor: 'pointer',
										}}
									>
										Cancel
									</button>
								)}
								{job.status === 'failed' && onRetry && (
									<button
										type="button"
										onClick={() => onRetry(job)}
										style={mergeStyles(styles.button, styles.buttonOutline, {
											padding: '0.25rem 0.5rem',
											fontSize: theme.fontSizeXs,
										})}
									>
										Retry
									</button>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	)
}

// ============================================
// CronBuilder (Visual Cron Expression Builder)
// ============================================

const CRON_PRESETS = [
	{ label: 'Every minute', value: '* * * * *' },
	{ label: 'Every hour', value: '0 * * * *' },
	{ label: 'Every day at 9am', value: '0 9 * * *' },
	{ label: 'Every Monday at 9am', value: '0 9 * * 1' },
	{ label: 'First of month at 9am', value: '0 9 1 * *' },
]

/**
 * Visual cron expression builder
 *
 * @example
 * ```tsx
 * <CronBuilder
 *   onCreate={(cron, url, name) => createCronJob(cron, url, name)}
 * />
 * ```
 */
export function CronBuilder({
	theme = defaultTheme,
	className,
	onCreate,
	defaultCallbackUrl = '',
}: CronBuilderProps) {
	const [expression, setExpression] = useState('0 9 * * *')
	const [callbackUrl, setCallbackUrl] = useState(defaultCallbackUrl)
	const [name, setName] = useState('')

	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		if (expression && callbackUrl) {
			onCreate?.(expression, callbackUrl, name)
		}
	}

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		padding: '1.5rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
	}

	const inputStyle: CSSProperties = {
		width: '100%',
		padding: '0.75rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		backgroundColor: theme.colorBackground,
		color: theme.colorForeground,
		fontSize: theme.fontSizeSm,
		fontFamily: theme.fontFamily,
	}

	return (
		<div style={containerStyle} className={className}>
			<h3 style={{ margin: '0 0 1rem', fontSize: theme.fontSizeLg, fontWeight: 600 }}>
				Cron Job Builder
			</h3>

			{/* Presets */}
			<div style={{ marginBottom: '1.5rem' }}>
				<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
					Quick Presets
				</label>
				<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
					{CRON_PRESETS.map((preset) => (
						<button
							key={preset.value}
							type="button"
							onClick={() => setExpression(preset.value)}
							style={{
								padding: '0.375rem 0.75rem',
								fontSize: theme.fontSizeXs,
								border: `1px solid ${expression === preset.value ? theme.colorPrimary : theme.colorBorder}`,
								borderRadius: theme.borderRadiusSm,
								backgroundColor: expression === preset.value ? `${theme.colorPrimary}10` : 'transparent',
								color: expression === preset.value ? theme.colorPrimary : theme.colorForeground,
								cursor: 'pointer',
							}}
						>
							{preset.label}
						</button>
					))}
				</div>
			</div>

			<form onSubmit={handleSubmit}>
				<div style={{ marginBottom: '1rem' }}>
					<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
						Cron Expression
					</label>
					<input
						type="text"
						value={expression}
						onChange={(e) => setExpression(e.target.value)}
						style={{ ...inputStyle, fontFamily: 'monospace' }}
						placeholder="* * * * *"
						required
					/>
					<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
						minute (0-59) | hour (0-23) | day (1-31) | month (1-12) | weekday (0-6, Sun=0)
					</p>
				</div>

				<div style={{ marginBottom: '1rem' }}>
					<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
						Name
					</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						style={inputStyle}
						placeholder="daily-report"
					/>
				</div>

				<div style={{ marginBottom: '1.5rem' }}>
					<label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: theme.fontSizeSm }}>
						Callback URL
					</label>
					<input
						type="url"
						value={callbackUrl}
						onChange={(e) => setCallbackUrl(e.target.value)}
						style={inputStyle}
						placeholder="https://api.example.com/cron/daily-report"
						required
					/>
				</div>

				<button
					type="submit"
					disabled={!expression || !callbackUrl}
					style={mergeStyles(styles.button, styles.buttonPrimary, { width: '100%' })}
				>
					Create Cron Job
				</button>
			</form>
		</div>
	)
}

// ============================================
// Icons
// ============================================

function ClockIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
	)
}

function RepeatIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
			<polyline points="17 1 21 5 17 9" />
			<path d="M3 11V9a4 4 0 0 1 4-4h14" />
			<polyline points="7 23 3 19 7 15" />
			<path d="M21 13v2a4 4 0 0 1-4 4H3" />
		</svg>
	)
}

function JobIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
			<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
		</svg>
	)
}

/**
 * Webhook Portal Component
 *
 * A complete, embeddable webhook management portal that combines
 * configuration, delivery logs, and statistics into a unified interface.
 *
 * Features:
 * - Tabbed interface (Configuration, Deliveries, Stats)
 * - Full webhook CRUD operations
 * - Delivery history with replay capability
 * - Real-time statistics dashboard
 * - Themeable with consistent styling
 */

'use client'

import { useState, useEffect, useCallback, type CSSProperties, type FormEvent } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import {
	useWebhooks,
	useWebhookDeliveries,
	useWebhookStats,
	type WebhookStats,
	type WebhookDeliveryStatus,
	type WebhookStatsPeriod,
} from '../webhooks-hooks'
import type { WebhookEnvironment, WebhookDelivery } from '../services-context'

// ============================================
// Types
// ============================================

type PortalTab = 'config' | 'deliveries' | 'stats'

export interface WebhookPortalProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Default tab to show */
	defaultTab?: PortalTab
	/** Hide tabs (show all sections stacked) */
	hideTabs?: boolean
	/** Title for the portal */
	title?: string
	/** Subtitle description */
	subtitle?: string
	/** Maximum deliveries to display */
	maxDeliveries?: number
	/** Stats period */
	statsPeriod?: WebhookStatsPeriod
	/** Auto-refresh deliveries interval in ms (0 = disabled) */
	deliveriesRefreshInterval?: number
	/** Callback when secret is generated */
	onSecretGenerated?: (environmentId: string, secret: string) => void
	/** Callback on errors */
	onError?: (error: Error) => void
}

// ============================================
// WebhookPortal
// ============================================

/**
 * Complete webhook management portal
 *
 * @example
 * ```tsx
 * import { WebhookPortal } from '@sylphx/platform-sdk/react'
 *
 * function DeveloperSettings() {
 *   return (
 *     <WebhookPortal
 *       title="Webhook Settings"
 *       defaultTab="config"
 *       onSecretGenerated={(envId, secret) => {
 *         // Show secret to user once
 *         alert(`Save this secret: ${secret}`)
 *       }}
 *     />
 *   )
 * }
 * ```
 */
export function WebhookPortal({
	theme = defaultTheme,
	className,
	defaultTab = 'config',
	hideTabs = false,
	title = 'Webhooks',
	subtitle = 'Configure webhooks to receive real-time event notifications',
	maxDeliveries = 50,
	statsPeriod = 'week',
	deliveriesRefreshInterval = 0,
	onSecretGenerated,
	onError,
}: WebhookPortalProps) {
	const [activeTab, setActiveTab] = useState<PortalTab>(defaultTab)
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Handle errors from hooks
	const handleError = useCallback(
		(error: Error | null) => {
			if (error && onError) {
				onError(error)
			}
		},
		[onError]
	)

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		backgroundColor: theme.colorBackground,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		overflow: 'hidden',
	}

	const headerStyle: CSSProperties = {
		padding: '1.5rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
	}

	const tabsStyle: CSSProperties = {
		display: 'flex',
		borderBottom: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorMuted,
	}

	const contentStyle: CSSProperties = {
		padding: '1.5rem',
	}

	return (
		<div style={containerStyle} className={className}>
			{/* Header */}
			<div style={headerStyle}>
				<h2 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>{title}</h2>
				{subtitle && (
					<p style={{ margin: '0.5rem 0 0', fontSize: theme.fontSizeSm, color: theme.colorMutedForeground }}>
						{subtitle}
					</p>
				)}
			</div>

			{/* Tabs */}
			{!hideTabs && (
				<div style={tabsStyle}>
					<TabButton
						active={activeTab === 'config'}
						onClick={() => setActiveTab('config')}
						theme={theme}
					>
						<ConfigIcon color={activeTab === 'config' ? theme.colorPrimary : theme.colorMutedForeground} />
						Configuration
					</TabButton>
					<TabButton
						active={activeTab === 'deliveries'}
						onClick={() => setActiveTab('deliveries')}
						theme={theme}
					>
						<DeliveryIcon color={activeTab === 'deliveries' ? theme.colorPrimary : theme.colorMutedForeground} />
						Deliveries
					</TabButton>
					<TabButton
						active={activeTab === 'stats'}
						onClick={() => setActiveTab('stats')}
						theme={theme}
					>
						<StatsIcon color={activeTab === 'stats' ? theme.colorPrimary : theme.colorMutedForeground} />
						Statistics
					</TabButton>
				</div>
			)}

			{/* Content */}
			<div style={contentStyle}>
				{hideTabs ? (
					<>
						<ConfigSection
							theme={theme}
							styles={styles}
							onError={handleError}
							onSecretGenerated={onSecretGenerated}
						/>
						<div style={{ height: '2rem' }} />
						<DeliveriesSection
							theme={theme}
							styles={styles}
							maxDeliveries={maxDeliveries}
							refreshInterval={deliveriesRefreshInterval}
							onError={handleError}
						/>
						<div style={{ height: '2rem' }} />
						<StatsSection theme={theme} period={statsPeriod} onError={handleError} />
					</>
				) : (
					<>
						{activeTab === 'config' && (
							<ConfigSection
								theme={theme}
								styles={styles}
								onError={handleError}
								onSecretGenerated={onSecretGenerated}
							/>
						)}
						{activeTab === 'deliveries' && (
							<DeliveriesSection
								theme={theme}
								styles={styles}
								maxDeliveries={maxDeliveries}
								refreshInterval={deliveriesRefreshInterval}
								onError={handleError}
							/>
						)}
						{activeTab === 'stats' && (
							<StatsSection theme={theme} period={statsPeriod} onError={handleError} />
						)}
					</>
				)}
			</div>
		</div>
	)
}

// ============================================
// Tab Button
// ============================================

interface TabButtonProps {
	active: boolean
	onClick: () => void
	theme: ThemeVariables
	children: React.ReactNode
}

function TabButton({ active, onClick, theme, children }: TabButtonProps) {
	const style: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '0.5rem',
		padding: '0.75rem 1.25rem',
		border: 'none',
		backgroundColor: 'transparent',
		color: active ? theme.colorPrimary : theme.colorMutedForeground,
		fontSize: theme.fontSizeSm,
		fontWeight: active ? 600 : 400,
		cursor: 'pointer',
		borderBottom: active ? `2px solid ${theme.colorPrimary}` : '2px solid transparent',
		marginBottom: '-1px',
	}

	return (
		<button type="button" onClick={onClick} style={style}>
			{children}
		</button>
	)
}

// ============================================
// Configuration Section
// ============================================

interface ConfigSectionProps {
	theme: ThemeVariables
	styles: ReturnType<typeof baseStyles>
	onError: (error: Error | null) => void
	onSecretGenerated?: (environmentId: string, secret: string) => void
}

function ConfigSection({ theme, styles, onError, onSecretGenerated }: ConfigSectionProps) {
	const { environments, supportedEvents, isLoading, error, updateConfig, refresh } = useWebhooks()
	const [editingEnv, setEditingEnv] = useState<string | null>(null)
	const [editUrl, setEditUrl] = useState('')
	const [regenerateSecret, setRegenerateSecret] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [showEvents, setShowEvents] = useState(false)

	useEffect(() => {
		onError(error)
	}, [error, onError])

	const handleEdit = (env: WebhookEnvironment) => {
		setEditingEnv(env.id)
		setEditUrl(env.webhookUrl ?? '')
		setRegenerateSecret(false)
	}

	const handleCancel = () => {
		setEditingEnv(null)
		setEditUrl('')
		setRegenerateSecret(false)
	}

	const handleSave = async (envId: string) => {
		setIsSaving(true)
		try {
			const result = await updateConfig({
				environmentId: envId,
				webhookUrl: editUrl || null,
				regenerateSecret,
			})
			if (result.webhookSecret && onSecretGenerated) {
				onSecretGenerated(envId, result.webhookSecret)
			}
			handleCancel()
		} catch {
			// Error handled by hook
		} finally {
			setIsSaving(false)
		}
	}

	const cardStyle: CSSProperties = {
		padding: '1rem',
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadius,
		marginBottom: '1rem',
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

	if (isLoading) {
		return (
			<div style={{ padding: '2rem', textAlign: 'center' }}>
				<span style={styles.spinner} />
			</div>
		)
	}

	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
				<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>Webhook Endpoints</h3>
				<button type="button" onClick={refresh} style={mergeStyles(styles.button, styles.buttonOutline)}>
					<RefreshIcon color={theme.colorForeground} /> Refresh
				</button>
			</div>

			{environments.length === 0 ? (
				<div style={{ padding: '2rem', textAlign: 'center', color: theme.colorMutedForeground }}>
					No environments configured
				</div>
			) : (
				environments.map((env) => (
					<div key={env.id} style={cardStyle}>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
							<div style={{ flex: 1 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: '50%',
											backgroundColor: env.webhookUrl ? theme.colorSuccess : theme.colorMutedForeground,
										}}
									/>
									<span style={{ fontWeight: 600, fontSize: theme.fontSizeSm }}>{env.name}</span>
									{env.hasSecret && (
										<span
											style={{
												padding: '0.125rem 0.375rem',
												fontSize: '0.625rem',
												backgroundColor: theme.colorMuted,
												borderRadius: theme.borderRadiusSm,
												color: theme.colorMutedForeground,
											}}
										>
											Secret configured
										</span>
									)}
								</div>

								{editingEnv === env.id ? (
									<div>
										<input
											type="url"
											value={editUrl}
											onChange={(e) => setEditUrl(e.target.value)}
											style={{ ...inputStyle, marginBottom: '0.75rem' }}
											placeholder="https://api.example.com/webhooks"
										/>
										<label
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: '0.5rem',
												fontSize: theme.fontSizeXs,
												color: theme.colorMutedForeground,
												cursor: 'pointer',
											}}
										>
											<input
												type="checkbox"
												checked={regenerateSecret}
												onChange={(e) => setRegenerateSecret(e.target.checked)}
											/>
											Generate new signing secret
										</label>
									</div>
								) : (
									<div style={{ fontFamily: 'monospace', fontSize: theme.fontSizeSm, color: theme.colorMutedForeground }}>
										{env.webhookUrl || 'Not configured'}
									</div>
								)}

								<div style={{ marginTop: '0.5rem', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
									Last updated: {env.updatedAt ? new Date(env.updatedAt).toLocaleString() : 'Never'}
								</div>
							</div>

							<div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
								{editingEnv === env.id ? (
									<>
										<button
											type="button"
											onClick={handleCancel}
											style={mergeStyles(styles.button, styles.buttonOutline, {
												padding: '0.25rem 0.75rem',
												fontSize: theme.fontSizeXs,
											})}
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={() => handleSave(env.id)}
											disabled={isSaving}
											style={mergeStyles(styles.button, styles.buttonPrimary, {
												padding: '0.25rem 0.75rem',
												fontSize: theme.fontSizeXs,
											})}
										>
											{isSaving ? <span style={styles.spinner} /> : 'Save'}
										</button>
									</>
								) : (
									<button
										type="button"
										onClick={() => handleEdit(env)}
										style={mergeStyles(styles.button, styles.buttonOutline, {
											padding: '0.25rem 0.75rem',
											fontSize: theme.fontSizeXs,
										})}
									>
										Edit
									</button>
								)}
							</div>
						</div>
					</div>
				))
			)}

			{/* Supported Events */}
			<div style={{ marginTop: '1.5rem' }}>
				<button
					type="button"
					onClick={() => setShowEvents(!showEvents)}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						background: 'none',
						border: 'none',
						padding: 0,
						cursor: 'pointer',
						color: theme.colorForeground,
						fontSize: theme.fontSizeSm,
						fontWeight: 500,
					}}
				>
					<ChevronIcon direction={showEvents ? 'down' : 'right'} color={theme.colorMutedForeground} />
					Supported Events ({supportedEvents.length})
				</button>

				{showEvents && (
					<div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
						{supportedEvents.map((event) => (
							<span
								key={event}
								style={{
									padding: '0.375rem 0.75rem',
									fontSize: theme.fontSizeXs,
									backgroundColor: theme.colorMuted,
									borderRadius: theme.borderRadiusSm,
									color: theme.colorMutedForeground,
									fontFamily: 'monospace',
								}}
							>
								{event}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

// ============================================
// Deliveries Section
// ============================================

interface DeliveriesSectionProps {
	theme: ThemeVariables
	styles: ReturnType<typeof baseStyles>
	maxDeliveries: number
	refreshInterval: number
	onError: (error: Error | null) => void
}

function DeliveriesSection({ theme, styles, maxDeliveries, refreshInterval, onError }: DeliveriesSectionProps) {
	const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | undefined>(undefined)
	const { deliveries, total, isLoading, error, replay, refresh, loadMore, hasMore } = useWebhookDeliveries({
		status: statusFilter,
		limit: maxDeliveries,
		refetchInterval: refreshInterval,
	})
	const [expandedId, setExpandedId] = useState<string | null>(null)
	const [replayingId, setReplayingId] = useState<string | null>(null)

	useEffect(() => {
		onError(error)
	}, [error, onError])

	const handleReplay = async (deliveryId: string) => {
		setReplayingId(deliveryId)
		try {
			await replay(deliveryId)
		} catch {
			// Error handled by hook
		} finally {
			setReplayingId(null)
		}
	}

	const statusColors: Record<string, { bg: string; text: string }> = {
		success: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
		delivered: { bg: `${theme.colorSuccess}20`, text: theme.colorSuccess },
		failed: { bg: `${theme.colorDestructive}20`, text: theme.colorDestructive },
		pending: { bg: `${theme.colorWarning}20`, text: theme.colorWarning },
		queued: { bg: `${theme.colorMuted}`, text: theme.colorMutedForeground },
	}

	const filterStyle: CSSProperties = {
		padding: '0.375rem 0.75rem',
		fontSize: theme.fontSizeXs,
		border: `1px solid ${theme.colorBorder}`,
		borderRadius: theme.borderRadiusSm,
		backgroundColor: 'transparent',
		cursor: 'pointer',
	}

	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>Delivery Log</h3>
					<p style={{ margin: '0.25rem 0 0', fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
						{total} total deliveries
					</p>
				</div>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					{(['all', 'delivered', 'failed', 'pending'] as const).map((status) => (
						<button
							key={status}
							type="button"
							onClick={() => setStatusFilter(status === 'all' ? undefined : status)}
							style={{
								...filterStyle,
								backgroundColor: (status === 'all' && !statusFilter) || statusFilter === status
									? theme.colorMuted
									: 'transparent',
								color: (status === 'all' && !statusFilter) || statusFilter === status
									? theme.colorForeground
									: theme.colorMutedForeground,
							}}
						>
							{status.charAt(0).toUpperCase() + status.slice(1)}
						</button>
					))}
					<button type="button" onClick={refresh} style={mergeStyles(styles.button, styles.buttonOutline, { padding: '0.375rem 0.75rem' })}>
						<RefreshIcon color={theme.colorForeground} />
					</button>
				</div>
			</div>

			<div
				style={{
					border: `1px solid ${theme.colorBorder}`,
					borderRadius: theme.borderRadius,
					overflow: 'hidden',
				}}
			>
				{isLoading && deliveries.length === 0 ? (
					<div style={{ padding: '2rem', textAlign: 'center' }}>
						<span style={styles.spinner} />
					</div>
				) : deliveries.length === 0 ? (
					<div style={{ padding: '3rem', textAlign: 'center', color: theme.colorMutedForeground }}>
						No deliveries yet
					</div>
				) : (
					<div style={{ maxHeight: '400px', overflowY: 'auto' }}>
						{deliveries.map((delivery, i) => (
							<div
								key={delivery.id}
								style={{
									padding: '0.75rem 1rem',
									borderBottom: i === deliveries.length - 1 ? 'none' : `1px solid ${theme.colorBorder}`,
									cursor: 'pointer',
								}}
								onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
							>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
										<span
											style={{
												padding: '0.125rem 0.375rem',
												fontSize: theme.fontSizeXs,
												borderRadius: theme.borderRadiusSm,
												backgroundColor: statusColors[delivery.status]?.bg ?? theme.colorMuted,
												color: statusColors[delivery.status]?.text ?? theme.colorMutedForeground,
												textTransform: 'capitalize',
											}}
										>
											{delivery.status}
										</span>
										<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm, fontFamily: 'monospace' }}>
											{delivery.event}
										</span>
										{delivery.responseStatus && (
											<span style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
												HTTP {delivery.responseStatus}
											</span>
										)}
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
										<span style={{ fontSize: theme.fontSizeXs, color: theme.colorMutedForeground }}>
											{new Date(delivery.createdAt).toLocaleString()}
										</span>
										{delivery.status === 'failed' && (
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													handleReplay(delivery.id)
												}}
												disabled={replayingId === delivery.id}
												style={{
													padding: '0.125rem 0.375rem',
													fontSize: theme.fontSizeXs,
													border: `1px solid ${theme.colorBorder}`,
													borderRadius: theme.borderRadiusSm,
													backgroundColor: 'transparent',
													color: theme.colorForeground,
													cursor: 'pointer',
												}}
											>
												{replayingId === delivery.id ? <span style={styles.spinner} /> : 'Retry'}
											</button>
										)}
									</div>
								</div>

								{expandedId === delivery.id && (
									<DeliveryDetails delivery={delivery} theme={theme} />
								)}
							</div>
						))}

						{hasMore && (
							<div style={{ padding: '0.75rem', textAlign: 'center', borderTop: `1px solid ${theme.colorBorder}` }}>
								<button
									type="button"
									onClick={loadMore}
									disabled={isLoading}
									style={mergeStyles(styles.button, styles.buttonOutline)}
								>
									{isLoading ? <span style={styles.spinner} /> : 'Load More'}
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

// ============================================
// Delivery Details
// ============================================

interface DeliveryDetailsProps {
	delivery: WebhookDelivery
	theme: ThemeVariables
}

function DeliveryDetails({ delivery, theme }: DeliveryDetailsProps) {
	const detailStyle: CSSProperties = {
		marginTop: '0.75rem',
		padding: '0.75rem',
		backgroundColor: theme.colorMuted,
		borderRadius: theme.borderRadiusSm,
	}

	const labelStyle: CSSProperties = {
		fontSize: theme.fontSizeXs,
		fontWeight: 500,
		marginBottom: '0.25rem',
		color: theme.colorMutedForeground,
	}

	const preStyle: CSSProperties = {
		margin: 0,
		fontSize: '0.625rem',
		fontFamily: 'monospace',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-all',
	}

	return (
		<div style={detailStyle}>
			<div style={{ display: 'grid', gap: '0.75rem' }}>
				<div>
					<div style={labelStyle}>Endpoint</div>
					<div style={{ fontSize: theme.fontSizeSm, fontFamily: 'monospace' }}>{delivery.url}</div>
				</div>
				{delivery.responseStatus && (
					<div>
						<div style={labelStyle}>Response Status</div>
						<div style={{ fontSize: theme.fontSizeSm }}>HTTP {delivery.responseStatus}</div>
					</div>
				)}
				{(delivery.retryCount ?? 0) > 0 && (
					<div>
						<div style={labelStyle}>Retry Count</div>
						<div style={{ fontSize: theme.fontSizeSm }}>{delivery.retryCount}</div>
					</div>
				)}
				{delivery.error && (
					<div>
						<div style={{ ...labelStyle, color: theme.colorDestructive }}>Error</div>
						<pre style={{ ...preStyle, color: theme.colorDestructive }}>{delivery.error}</pre>
					</div>
				)}
			</div>
		</div>
	)
}

// ============================================
// Stats Section
// ============================================

interface StatsSectionProps {
	theme: ThemeVariables
	period: WebhookStatsPeriod
	onError: (error: Error | null) => void
}

function StatsSection({ theme, period, onError }: StatsSectionProps) {
	const { stats, isLoading, error, refresh } = useWebhookStats(period)
	const styles = baseStyles(theme)

	useEffect(() => {
		onError(error)
	}, [error, onError])

	const statCardStyle: CSSProperties = {
		padding: '1rem',
		backgroundColor: theme.colorMuted,
		borderRadius: theme.borderRadius,
		textAlign: 'center',
	}

	const statValueStyle: CSSProperties = {
		fontSize: '1.5rem',
		fontWeight: 700,
		color: theme.colorForeground,
	}

	const statLabelStyle: CSSProperties = {
		fontSize: theme.fontSizeXs,
		color: theme.colorMutedForeground,
		marginTop: '0.25rem',
	}

	if (isLoading) {
		return (
			<div style={{ padding: '2rem', textAlign: 'center' }}>
				<span style={styles.spinner} />
			</div>
		)
	}

	if (!stats) {
		return (
			<div style={{ padding: '2rem', textAlign: 'center', color: theme.colorMutedForeground }}>
				No statistics available
			</div>
		)
	}

	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
				<h3 style={{ margin: 0, fontSize: theme.fontSizeLg, fontWeight: 600 }}>
					Statistics ({stats.period})
				</h3>
				<button type="button" onClick={refresh} style={mergeStyles(styles.button, styles.buttonOutline)}>
					<RefreshIcon color={theme.colorForeground} /> Refresh
				</button>
			</div>

			{/* Summary Cards */}
			{stats.totals && (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
					<div style={statCardStyle}>
						<div style={statValueStyle}>{stats.totals.total.toLocaleString()}</div>
						<div style={statLabelStyle}>Total</div>
					</div>
					<div style={statCardStyle}>
						<div style={{ ...statValueStyle, color: theme.colorSuccess }}>
							{stats.totals.delivered.toLocaleString()}
						</div>
						<div style={statLabelStyle}>Delivered</div>
					</div>
					<div style={statCardStyle}>
						<div style={{ ...statValueStyle, color: theme.colorDestructive }}>
							{stats.totals.failed.toLocaleString()}
						</div>
						<div style={statLabelStyle}>Failed</div>
					</div>
					<div style={statCardStyle}>
						<div style={{ ...statValueStyle, color: theme.colorSuccess }}>{stats.totals.deliveryRate}</div>
						<div style={statLabelStyle}>Success Rate</div>
					</div>
				</div>
			)}

			{/* Breakdown by Event */}
			{stats.byEvent && stats.byEvent.length > 0 && (
				<div style={{ marginBottom: '1.5rem' }}>
					<h4 style={{ margin: '0 0 0.75rem', fontSize: theme.fontSizeSm, fontWeight: 600 }}>By Event</h4>
					<div
						style={{
							border: `1px solid ${theme.colorBorder}`,
							borderRadius: theme.borderRadius,
							overflow: 'hidden',
						}}
					>
						{stats.byEvent.map((item, i) => (
							<div
								key={item.event}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									padding: '0.5rem 1rem',
									borderBottom: i === (stats.byEvent?.length ?? 0) - 1 ? 'none' : `1px solid ${theme.colorBorder}`,
								}}
							>
								<span style={{ fontFamily: 'monospace', fontSize: theme.fontSizeSm }}>{item.event}</span>
								<span style={{ fontWeight: 500, fontSize: theme.fontSizeSm }}>{item.count.toLocaleString()}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Breakdown by Status */}
			{stats.byStatus && stats.byStatus.length > 0 && (
				<div>
					<h4 style={{ margin: '0 0 0.75rem', fontSize: theme.fontSizeSm, fontWeight: 600 }}>By Status</h4>
					<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
						{stats.byStatus?.map((item) => (
							<div
								key={item.status}
								style={{
									padding: '0.5rem 1rem',
									backgroundColor: theme.colorMuted,
									borderRadius: theme.borderRadius,
								}}
							>
								<span
									style={{
										fontSize: theme.fontSizeXs,
										textTransform: 'capitalize',
										color: theme.colorMutedForeground,
									}}
								>
									{item.status}
								</span>
								<span style={{ marginLeft: '0.5rem', fontWeight: 600, fontSize: theme.fontSizeSm }}>
									{item.count.toLocaleString()}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// ============================================
// Icons
// ============================================

function ConfigIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
		</svg>
	)
}

function DeliveryIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
		</svg>
	)
}

function StatsIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="18" y1="20" x2="18" y2="10" />
			<line x1="12" y1="20" x2="12" y2="4" />
			<line x1="6" y1="20" x2="6" y2="14" />
		</svg>
	)
}

function RefreshIcon({ color }: { color: string }) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
			<polyline points="23 4 23 10 17 10" />
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
		</svg>
	)
}

function ChevronIcon({ direction, color }: { direction: 'down' | 'right'; color: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ transform: direction === 'down' ? 'rotate(90deg)' : 'none' }}
		>
			<polyline points="9 18 15 12 9 6" />
		</svg>
	)
}

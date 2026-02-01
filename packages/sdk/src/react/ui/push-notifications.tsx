/**
 * Push Notification Components
 *
 * Pre-built components for push notification management.
 * Includes permission prompt, notification bell, and notification list.
 */

'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import type { ThemeVariables } from './styles'
import { defaultTheme, baseStyles, mergeStyles, injectGlobalStyles } from './styles'
import { useNotifications } from '../platform-hooks'
import { UI_PROMPT_DELAY_MS, Z_INDEX_OVERLAY, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '../../constants'

// ============================================
// PushPrompt
// ============================================

export interface PushPromptProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Title text */
	title?: string
	/** Description text */
	description?: string
	/** Enable button text */
	enableText?: string
	/** Maybe later button text */
	laterText?: string
	/** Called when enabled */
	onEnabled?: () => void
	/** Called when dismissed */
	onDismissed?: () => void
	/** Custom class name */
	className?: string
	/** Position */
	position?: 'top' | 'bottom' | 'center'
	/** Variant */
	variant?: 'banner' | 'card' | 'modal'
	/** Auto-show when notifications not enabled */
	autoShow?: boolean
	/** Delay before showing (ms) */
	showDelay?: number
}

/**
 * Push notification permission prompt
 *
 * @example
 * ```tsx
 * // Simple banner
 * <PushPrompt
 *   variant="banner"
 *   position="top"
 *   onEnabled={() => console.log('Notifications enabled!')}
 * />
 *
 * // Card variant
 * <PushPrompt
 *   variant="card"
 *   title="Stay Updated"
 *   description="Get notified when something important happens"
 * />
 * ```
 */
export function PushPrompt({
	theme = defaultTheme,
	title = 'Enable Notifications',
	description = "We'll notify you about important updates and activity.",
	enableText = 'Enable',
	laterText = 'Not Now',
	onEnabled,
	onDismissed,
	className,
	position = 'bottom',
	variant = 'banner',
	autoShow = true,
	showDelay = UI_PROMPT_DELAY_MS,
}: PushPromptProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [isAnimatingOut, setIsAnimatingOut] = useState(false)
	const { isSupported, isSubscribed, subscribe, error } = useNotifications()
	const styles = baseStyles(theme)

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Auto-show logic
	useEffect(() => {
		if (!autoShow || !isSupported || isSubscribed) return

		const timer = setTimeout(() => {
			setIsVisible(true)
		}, showDelay)

		return () => clearTimeout(timer)
	}, [autoShow, isSupported, isSubscribed, showDelay])

	const handleEnable = async () => {
		const success = await subscribe()
		if (success) {
			handleClose()
			onEnabled?.()
		}
	}

	const handleDismiss = () => {
		handleClose()
		onDismissed?.()
	}

	const handleClose = () => {
		setIsAnimatingOut(true)
		setTimeout(() => {
			setIsVisible(false)
			setIsAnimatingOut(false)
		}, 200)
	}

	if (!isSupported || isSubscribed || !isVisible) {
		return null
	}

	const positionStyles: Record<string, CSSProperties> = {
		top: { top: '1rem', left: '50%', transform: 'translateX(-50%)' },
		bottom: { bottom: '1rem', left: '50%', transform: 'translateX(-50%)' },
		center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
	}

	const containerStyle: CSSProperties = mergeStyles(
		{
			position: 'fixed',
			zIndex: Z_INDEX_OVERLAY,
			fontFamily: theme.fontFamily,
			animation: isAnimatingOut ? 'sylphx-fade-out 0.2s ease' : 'sylphx-slide-up 0.3s ease',
		},
		positionStyles[position]
	)

	if (variant === 'banner') {
		const bannerStyle: CSSProperties = mergeStyles(
			{
				display: 'flex',
				alignItems: 'center',
				gap: '1rem',
				padding: '1rem 1.5rem',
				backgroundColor: theme.colorBackground,
				border: `1px solid ${theme.colorBorder}`,
				borderRadius: theme.borderRadiusLg,
				boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
				maxWidth: '480px',
			},
			containerStyle
		)

		return (
			<div style={bannerStyle} className={className}>
				<BellIcon color={theme.colorPrimary} />
				<div style={{ flex: 1 }}>
					<p style={{ margin: 0, fontWeight: 600, fontSize: theme.fontSizeSm }}>{title}</p>
					<p style={mergeStyles(styles.textXs, styles.textMuted, { margin: 0 })}>{description}</p>
				</div>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					<button
						type="button"
						onClick={handleDismiss}
						style={mergeStyles(styles.button, styles.buttonGhost, { fontSize: theme.fontSizeXs })}
					>
						{laterText}
					</button>
					<button
						type="button"
						onClick={handleEnable}
						style={mergeStyles(styles.button, styles.buttonPrimary, { fontSize: theme.fontSizeXs })}
					>
						{enableText}
					</button>
				</div>
			</div>
		)
	}

	// Card variant
	const cardStyle: CSSProperties = mergeStyles(styles.card, containerStyle, {
		padding: '1.5rem',
		textAlign: 'center',
		maxWidth: '320px',
	})

	return (
		<div style={cardStyle} className={className}>
			<div
				style={{
					width: '56px',
					height: '56px',
					borderRadius: '50%',
					backgroundColor: `${theme.colorPrimary}15`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					margin: '0 auto 1rem',
				}}
			>
				<BellIcon color={theme.colorPrimary} size={28} />
			</div>
			<h3 style={{ margin: '0 0 0.5rem', fontSize: theme.fontSizeLg, fontWeight: 600 }}>{title}</h3>
			<p style={mergeStyles(styles.textSm, styles.textMuted, { margin: '0 0 1.5rem' })}>{description}</p>
			{error && (
				<div style={mergeStyles(styles.alert, styles.alertError, { marginBottom: '1rem' })}>{error.message}</div>
			)}
			<div style={{ display: 'flex', gap: '0.75rem' }}>
				<button
					type="button"
					onClick={handleDismiss}
					style={mergeStyles(styles.button, styles.buttonOutline, styles.buttonFullWidth)}
				>
					{laterText}
				</button>
				<button
					type="button"
					onClick={handleEnable}
					style={mergeStyles(styles.button, styles.buttonPrimary, styles.buttonFullWidth)}
				>
					{enableText}
				</button>
			</div>
		</div>
	)
}

// ============================================
// NotificationBell
// ============================================

export interface NotificationBellProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Unread notification count */
	count?: number
	/** Max count to display */
	maxCount?: number
	/** Called when clicked */
	onClick?: () => void
	/** Custom class name */
	className?: string
	/** Size */
	size?: 'sm' | 'md' | 'lg'
	/** Show dot instead of count */
	showDot?: boolean
	/** Custom icon color */
	color?: string
}

/**
 * Notification bell icon with badge
 *
 * @example
 * ```tsx
 * const [showPanel, setShowPanel] = useState(false)
 * const { unreadCount } = useNotifications()
 *
 * <NotificationBell
 *   count={unreadCount}
 *   onClick={() => setShowPanel(true)}
 * />
 * ```
 */
export function NotificationBell({
	theme = defaultTheme,
	count = 0,
	maxCount = 99,
	onClick,
	className,
	size = 'md',
	showDot = false,
	color,
}: NotificationBellProps) {
	const sizes = {
		sm: { button: '32px', icon: 18, badge: '14px', badgeFont: '9px' },
		md: { button: '40px', icon: 22, badge: '18px', badgeFont: '11px' },
		lg: { button: '48px', icon: 26, badge: '22px', badgeFont: '12px' },
	}

	const s = sizes[size]
	const displayCount = count > maxCount ? `${maxCount}+` : count

	const buttonStyle: CSSProperties = {
		position: 'relative',
		width: s.button,
		height: s.button,
		borderRadius: '50%',
		border: 'none',
		backgroundColor: 'transparent',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: 'background-color 0.2s ease',
	}

	const badgeStyle: CSSProperties = {
		position: 'absolute',
		top: '-2px',
		right: '-2px',
		minWidth: s.badge,
		height: s.badge,
		padding: showDot ? 0 : '0 4px',
		borderRadius: '9999px',
		backgroundColor: theme.colorDestructive,
		color: theme.colorDestructiveForeground,
		fontSize: s.badgeFont,
		fontWeight: 600,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
	}

	return (
		<button
			type="button"
			onClick={onClick}
			style={buttonStyle}
			className={className}
			onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colorMuted)}
			onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
		>
			<BellIcon color={color || theme.colorForeground} size={s.icon} />
			{count > 0 && (
				<span style={badgeStyle}>{showDot ? null : displayCount}</span>
			)}
		</button>
	)
}

// ============================================
// NotificationList
// ============================================

export interface Notification {
	id: string
	title: string
	body?: string
	icon?: string
	url?: string
	read: boolean
	createdAt: string | Date
	category?: string
}

export interface NotificationListProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Notifications to display */
	notifications: Notification[]
	/** Called when notification is clicked */
	onNotificationClick?: (notification: Notification) => void
	/** Called when notification is marked as read */
	onMarkAsRead?: (id: string) => void
	/** Called when all notifications are marked as read */
	onMarkAllAsRead?: () => void
	/** Called when notification is deleted */
	onDelete?: (id: string) => void
	/** Called when all notifications are cleared */
	onClearAll?: () => void
	/** Custom class name */
	className?: string
	/** Empty state message */
	emptyMessage?: string
	/** Show mark all as read button */
	showMarkAllAsRead?: boolean
	/** Show clear all button */
	showClearAll?: boolean
	/** Max height */
	maxHeight?: string
}

/**
 * Notification list component
 *
 * @example
 * ```tsx
 * <NotificationList
 *   notifications={notifications}
 *   onNotificationClick={(n) => router.push(n.url)}
 *   onMarkAsRead={(id) => markAsRead(id)}
 *   onMarkAllAsRead={() => markAllAsRead()}
 * />
 * ```
 */
export function NotificationList({
	theme = defaultTheme,
	notifications,
	onNotificationClick,
	onMarkAsRead,
	onMarkAllAsRead,
	onDelete,
	onClearAll,
	className,
	emptyMessage = 'No notifications',
	showMarkAllAsRead = true,
	showClearAll = false,
	maxHeight = '400px',
}: NotificationListProps) {
	const styles = baseStyles(theme)
	const unreadCount = notifications.filter((n) => !n.read).length

	useEffect(() => {
		injectGlobalStyles()
	}, [])

	const containerStyle: CSSProperties = {
		fontFamily: theme.fontFamily,
		backgroundColor: theme.colorBackground,
		borderRadius: theme.borderRadiusLg,
		border: `1px solid ${theme.colorBorder}`,
		overflow: 'hidden',
	}

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorMuted,
	}

	const listStyle: CSSProperties = {
		maxHeight,
		overflowY: 'auto',
	}

	return (
		<div style={containerStyle} className={className}>
			<div style={headerStyle}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
					<span style={{ fontWeight: 600, fontSize: theme.fontSizeSm }}>Notifications</span>
					{unreadCount > 0 && (
						<span
							style={mergeStyles(styles.badge, styles.badgePrimary)}
						>
							{unreadCount} new
						</span>
					)}
				</div>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					{showMarkAllAsRead && unreadCount > 0 && (
						<button
							type="button"
							onClick={onMarkAllAsRead}
							style={mergeStyles(styles.button, styles.buttonGhost, {
								fontSize: theme.fontSizeXs,
								padding: '0.25rem 0.5rem',
							})}
						>
							Mark all read
						</button>
					)}
					{showClearAll && notifications.length > 0 && (
						<button
							type="button"
							onClick={onClearAll}
							style={mergeStyles(styles.button, styles.buttonGhost, {
								fontSize: theme.fontSizeXs,
								padding: '0.25rem 0.5rem',
							})}
						>
							Clear all
						</button>
					)}
				</div>
			</div>

			<div style={listStyle}>
				{notifications.length === 0 ? (
					<div
						style={{
							padding: '3rem 1rem',
							textAlign: 'center',
							color: theme.colorMutedForeground,
						}}
					>
						<BellOffIcon color={theme.colorMutedForeground} />
						<p style={{ marginTop: '0.5rem', fontSize: theme.fontSizeSm }}>{emptyMessage}</p>
					</div>
				) : (
					notifications.map((notification) => (
						<NotificationItem
							key={notification.id}
							notification={notification}
							theme={theme}
							onClick={() => onNotificationClick?.(notification)}
							onMarkAsRead={() => onMarkAsRead?.(notification.id)}
							onDelete={() => onDelete?.(notification.id)}
						/>
					))
				)}
			</div>
		</div>
	)
}

// ============================================
// NotificationItem
// ============================================

interface NotificationItemProps {
	notification: Notification
	theme: ThemeVariables
	onClick?: () => void
	onMarkAsRead?: () => void
	onDelete?: () => void
}

function NotificationItem({ notification, theme, onClick, onMarkAsRead, onDelete }: NotificationItemProps) {
	const styles = baseStyles(theme)
	const [showActions, setShowActions] = useState(false)

	const itemStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'flex-start',
		gap: '0.75rem',
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${theme.colorBorder}`,
		cursor: 'pointer',
		transition: 'background-color 0.15s ease',
		backgroundColor: notification.read ? 'transparent' : `${theme.colorPrimary}08`,
	}

	const formatTime = (date: string | Date) => {
		const d = new Date(date)
		const now = new Date()
		const diff = now.getTime() - d.getTime()
		const minutes = Math.floor(diff / MS_PER_MINUTE)
		const hours = Math.floor(diff / MS_PER_HOUR)
		const days = Math.floor(diff / MS_PER_DAY)

		if (minutes < 1) return 'Just now'
		if (minutes < 60) return `${minutes}m ago`
		if (hours < 24) return `${hours}h ago`
		if (days < 7) return `${days}d ago`
		return d.toLocaleDateString()
	}

	return (
		<div
			style={itemStyle}
			onClick={onClick}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = theme.colorMuted
				setShowActions(true)
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : `${theme.colorPrimary}08`
				setShowActions(false)
			}}
		>
			{/* Icon/Avatar */}
			<div
				style={{
					width: '40px',
					height: '40px',
					borderRadius: '50%',
					backgroundColor: theme.colorMuted,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexShrink: 0,
					overflow: 'hidden',
				}}
			>
				{notification.icon ? (
					<img
						src={notification.icon}
						alt=""
						style={{ width: '100%', height: '100%', objectFit: 'cover' }}
					/>
				) : (
					<BellIcon color={theme.colorMutedForeground} size={20} />
				)}
			</div>

			{/* Content */}
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
					<span
						style={{
							fontWeight: notification.read ? 400 : 600,
							fontSize: theme.fontSizeSm,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{notification.title}
					</span>
					{!notification.read && (
						<span
							style={{
								width: '8px',
								height: '8px',
								borderRadius: '50%',
								backgroundColor: theme.colorPrimary,
								flexShrink: 0,
							}}
						/>
					)}
				</div>
				{notification.body && (
					<p
						style={{
							margin: '0.25rem 0 0',
							fontSize: theme.fontSizeXs,
							color: theme.colorMutedForeground,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{notification.body}
					</p>
				)}
				<p
					style={{
						margin: '0.25rem 0 0',
						fontSize: theme.fontSizeXs,
						color: theme.colorMutedForeground,
					}}
				>
					{formatTime(notification.createdAt)}
				</p>
			</div>

			{/* Actions */}
			{showActions && (
				<div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
					{!notification.read && onMarkAsRead && (
						<button
							type="button"
							onClick={onMarkAsRead}
							style={mergeStyles(styles.button, styles.buttonGhost, { padding: '0.25rem' })}
							title="Mark as read"
						>
							<CheckIcon color={theme.colorMutedForeground} />
						</button>
					)}
					{onDelete && (
						<button
							type="button"
							onClick={onDelete}
							style={mergeStyles(styles.button, styles.buttonGhost, { padding: '0.25rem' })}
							title="Delete"
						>
							<TrashIcon color={theme.colorMutedForeground} />
						</button>
					)}
				</div>
			)}
		</div>
	)
}

// ============================================
// Icons
// ============================================

function BellIcon({ color, size = 24 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
			<path d="M13.73 21a2 2 0 01-3.46 0" />
		</svg>
	)
}

function BellOffIcon({ color, size = 40 }: { color: string; size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
			<path d="M8.56 2.9A7 7 0 0119 9v4m-2 4H2s3-2 3-9a4.67 4.67 0 01.3-1.7" />
			<path d="M13.73 21a2 2 0 01-3.46 0" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	)
}

function CheckIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}

function TrashIcon({ color }: { color: string }) {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
		</svg>
	)
}

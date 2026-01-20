/**
 * Notification Center Component
 *
 * In-app message/notification center for SDK apps.
 * Displays messages from the platform's in-app messaging system.
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useInbox, type InAppMessage, type InAppMessageType } from '../platform-hooks'

// ============================================
// Types
// ============================================

export interface NotificationCenterProps {
	/** Max messages to show (default: 50) */
	maxMessages?: number
	/** Show only unread messages */
	unreadOnly?: boolean
	/** Filter by topic */
	topic?: string
	/** Filter by type */
	type?: InAppMessageType
	/** Custom class for the container */
	className?: string
	/** Custom empty state content */
	emptyContent?: React.ReactNode
	/** Custom loading content */
	loadingContent?: React.ReactNode
	/** Custom message renderer */
	renderMessage?: (message: InAppMessage, actions: MessageActions) => React.ReactNode
	/** Called when a message action is clicked */
	onActionClick?: (message: InAppMessage, action: 'primary' | 'secondary') => void
	/** Called when a message is dismissed */
	onDismiss?: (message: InAppMessage) => void
	/** Show mark all as read button */
	showMarkAllAsRead?: boolean
	/** Group messages by date */
	groupByDate?: boolean
}

export interface MessageActions {
	markAsRead: () => Promise<void>
	dismiss: () => Promise<void>
	recordClick: (action: 'primary' | 'secondary') => Promise<void>
}

export interface NotificationBadgeProps {
	/** Custom class for the badge */
	className?: string
	/** Show badge even when count is 0 */
	showZero?: boolean
	/** Max count to display (e.g., 99+) */
	max?: number
	/** Custom render */
	children?: (count: number) => React.ReactNode
}

// ============================================
// Utility Functions
// ============================================

function formatRelativeTime(date: string | Date): string {
	const now = new Date()
	const then = new Date(date)
	const diff = now.getTime() - then.getTime()

	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (seconds < 60) return 'Just now'
	if (minutes < 60) return `${minutes}m ago`
	if (hours < 24) return `${hours}h ago`
	if (days < 7) return `${days}d ago`

	return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getMessageIcon(type: InAppMessageType): string {
	switch (type) {
		case 'success':
			return '\u2713' // checkmark
		case 'warning':
			return '\u26A0' // warning sign
		case 'error':
			return '\u2717' // X mark
		case 'announcement':
			return '\uD83D\uDCE2' // megaphone
		case 'system':
			return '\u2699' // gear
		case 'action':
			return '\u27A4' // arrow
		case 'info':
		default:
			return '\u2139' // info
	}
}

function getTypeColor(type: InAppMessageType): string {
	switch (type) {
		case 'success':
			return '#10b981'
		case 'warning':
			return '#f59e0b'
		case 'error':
			return '#ef4444'
		case 'announcement':
			return '#8b5cf6'
		case 'system':
			return '#6b7280'
		case 'action':
			return '#3b82f6'
		case 'info':
		default:
			return '#0ea5e9'
	}
}

// ============================================
// NotificationBadge Component
// ============================================

/**
 * Badge showing unread notification count
 *
 * @example
 * ```tsx
 * function NavBar() {
 *   return (
 *     <div className="nav">
 *       <button>
 *         <BellIcon />
 *         <NotificationBadge max={99} />
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function NotificationBadge({
	className = '',
	showZero = false,
	max = 99,
	children,
}: NotificationBadgeProps) {
	const { unreadCount } = useInbox()

	if (!showZero && unreadCount === 0) {
		return null
	}

	const displayCount = unreadCount > max ? `${max}+` : unreadCount.toString()

	if (children) {
		return <>{children(unreadCount)}</>
	}

	return (
		<span
			className={className}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				minWidth: '18px',
				height: '18px',
				padding: '0 5px',
				fontSize: '11px',
				fontWeight: 600,
				lineHeight: 1,
				color: '#fff',
				backgroundColor: '#ef4444',
				borderRadius: '9px',
			}}
		>
			{displayCount}
		</span>
	)
}

// ============================================
// Default Message Renderer
// ============================================

function DefaultMessageCard({
	message,
	actions,
	onActionClick,
	onDismiss,
}: {
	message: InAppMessage
	actions: MessageActions
	onActionClick?: (message: InAppMessage, action: 'primary' | 'secondary') => void
	onDismiss?: (message: InAppMessage) => void
}) {
	const handlePrimaryAction = async () => {
		await actions.recordClick('primary')
		onActionClick?.(message, 'primary')
		if (message.actionUrl) {
			window.open(message.actionUrl, '_blank', 'noopener,noreferrer')
		}
	}

	const handleSecondaryAction = async () => {
		await actions.recordClick('secondary')
		onActionClick?.(message, 'secondary')
		if (message.secondaryActionUrl) {
			window.open(message.secondaryActionUrl, '_blank', 'noopener,noreferrer')
		}
	}

	const handleDismiss = async () => {
		await actions.dismiss()
		onDismiss?.(message)
	}

	const handleClick = async () => {
		if (!message.isRead) {
			await actions.markAsRead()
		}
	}

	const typeColor = getTypeColor(message.type)

	return (
		<div
			onClick={handleClick}
			style={{
				display: 'flex',
				gap: '12px',
				padding: '12px 16px',
				borderBottom: '1px solid #e5e7eb',
				backgroundColor: message.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
				cursor: 'pointer',
				transition: 'background-color 0.15s',
			}}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => e.key === 'Enter' && handleClick()}
		>
			{/* Icon */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '36px',
					height: '36px',
					borderRadius: '50%',
					backgroundColor: `${typeColor}15`,
					color: typeColor,
					fontSize: '16px',
					flexShrink: 0,
				}}
			>
				{message.icon || getMessageIcon(message.type)}
			</div>

			{/* Content */}
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
					<div style={{ flex: 1, minWidth: 0 }}>
						<h4
							style={{
								margin: 0,
								fontSize: '14px',
								fontWeight: message.isRead ? 500 : 600,
								color: '#111827',
								lineHeight: 1.4,
							}}
						>
							{message.title}
						</h4>
						<p
							style={{
								margin: '4px 0 0',
								fontSize: '13px',
								color: '#6b7280',
								lineHeight: 1.5,
								overflow: 'hidden',
								display: '-webkit-box',
								WebkitLineClamp: 2,
								WebkitBoxOrient: 'vertical',
							}}
						>
							{message.body}
						</p>
					</div>

					{/* Dismiss button */}
					<button
						onClick={(e) => {
							e.stopPropagation()
							handleDismiss()
						}}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '24px',
							height: '24px',
							padding: 0,
							border: 'none',
							background: 'transparent',
							color: '#9ca3af',
							cursor: 'pointer',
							borderRadius: '4px',
							transition: 'color 0.15s, background-color 0.15s',
						}}
						onMouseOver={(e) => {
							e.currentTarget.style.color = '#6b7280'
							e.currentTarget.style.backgroundColor = '#f3f4f6'
						}}
						onMouseOut={(e) => {
							e.currentTarget.style.color = '#9ca3af'
							e.currentTarget.style.backgroundColor = 'transparent'
						}}
						aria-label="Dismiss notification"
					>
						\u2715
					</button>
				</div>

				{/* Actions */}
				{(message.actionText || message.secondaryActionText) && (
					<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
						{message.actionText && (
							<button
								onClick={(e) => {
									e.stopPropagation()
									handlePrimaryAction()
								}}
								style={{
									padding: '6px 12px',
									fontSize: '12px',
									fontWeight: 500,
									color: '#fff',
									backgroundColor: typeColor,
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer',
									transition: 'opacity 0.15s',
								}}
								onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
								onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
							>
								{message.actionText}
							</button>
						)}
						{message.secondaryActionText && (
							<button
								onClick={(e) => {
									e.stopPropagation()
									handleSecondaryAction()
								}}
								style={{
									padding: '6px 12px',
									fontSize: '12px',
									fontWeight: 500,
									color: '#374151',
									backgroundColor: 'transparent',
									border: '1px solid #d1d5db',
									borderRadius: '4px',
									cursor: 'pointer',
									transition: 'background-color 0.15s',
								}}
								onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
								onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
							>
								{message.secondaryActionText}
							</button>
						)}
					</div>
				)}

				{/* Timestamp & Topic */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						marginTop: '8px',
						fontSize: '11px',
						color: '#9ca3af',
					}}
				>
					<span>{formatRelativeTime(message.createdAt)}</span>
					{message.topic && (
						<>
							<span>\u2022</span>
							<span>{message.topic}</span>
						</>
					)}
					{!message.isRead && (
						<span
							style={{
								width: '6px',
								height: '6px',
								borderRadius: '50%',
								backgroundColor: '#3b82f6',
								marginLeft: 'auto',
							}}
						/>
					)}
				</div>
			</div>
		</div>
	)
}

// ============================================
// NotificationCenter Component
// ============================================

/**
 * Full notification center component
 *
 * @example Basic usage
 * ```tsx
 * function NotificationsPage() {
 *   return (
 *     <div className="container">
 *       <h1>Notifications</h1>
 *       <NotificationCenter />
 *     </div>
 *   )
 * }
 * ```
 *
 * @example In a dropdown
 * ```tsx
 * function NavBar() {
 *   const [open, setOpen] = useState(false)
 *
 *   return (
 *     <div className="nav">
 *       <button onClick={() => setOpen(!open)}>
 *         <BellIcon />
 *         <NotificationBadge />
 *       </button>
 *       {open && (
 *         <Dropdown>
 *           <NotificationCenter
 *             maxMessages={10}
 *             showMarkAllAsRead
 *             onActionClick={(msg) => setOpen(false)}
 *           />
 *         </Dropdown>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example Custom message renderer
 * ```tsx
 * <NotificationCenter
 *   renderMessage={(message, actions) => (
 *     <MyCustomCard
 *       key={message.id}
 *       title={message.title}
 *       body={message.body}
 *       onRead={() => actions.markAsRead()}
 *     />
 *   )}
 * />
 * ```
 */
export function NotificationCenter({
	maxMessages = 50,
	unreadOnly = false,
	topic,
	type,
	className = '',
	emptyContent,
	loadingContent,
	renderMessage,
	onActionClick,
	onDismiss,
	showMarkAllAsRead = false,
	groupByDate = false,
}: NotificationCenterProps) {
	const {
		messages,
		unreadCount,
		isLoading,
		error,
		markAsRead,
		markAllAsRead,
		dismiss,
		recordClick,
		refresh,
	} = useInbox()

	// Filter messages
	const filteredMessages = useMemo(() => {
		let result = messages

		if (unreadOnly) {
			result = result.filter((m) => !m.isRead && !m.isDismissed)
		}

		if (topic) {
			result = result.filter((m) => m.topic === topic)
		}

		if (type) {
			result = result.filter((m) => m.type === type)
		}

		return result.slice(0, maxMessages)
	}, [messages, unreadOnly, topic, type, maxMessages])

	// Group by date if enabled
	const groupedMessages = useMemo(() => {
		if (!groupByDate) return null

		const groups: Record<string, InAppMessage[]> = {}
		const today = new Date().toDateString()
		const yesterday = new Date(Date.now() - 86400000).toDateString()

		for (const msg of filteredMessages) {
			const msgDate = new Date(msg.createdAt).toDateString()
			let label: string

			if (msgDate === today) {
				label = 'Today'
			} else if (msgDate === yesterday) {
				label = 'Yesterday'
			} else {
				label = new Date(msg.createdAt).toLocaleDateString(undefined, {
					weekday: 'long',
					month: 'short',
					day: 'numeric',
				})
			}

			if (!groups[label]) groups[label] = []
			groups[label].push(msg)
		}

		return groups
	}, [filteredMessages, groupByDate])

	const createActions = useCallback(
		(message: InAppMessage): MessageActions => ({
			markAsRead: () => markAsRead(message.id),
			dismiss: () => dismiss(message.id),
			recordClick: (action) => recordClick(message.id, action),
		}),
		[markAsRead, dismiss, recordClick]
	)

	const handleMarkAllAsRead = async () => {
		await markAllAsRead()
	}

	// Loading state
	if (isLoading) {
		return (
			<div className={className} style={{ padding: '24px', textAlign: 'center' }}>
				{loadingContent || (
					<div style={{ color: '#9ca3af' }}>Loading notifications...</div>
				)}
			</div>
		)
	}

	// Error state
	if (error) {
		return (
			<div className={className} style={{ padding: '24px', textAlign: 'center' }}>
				<div style={{ color: '#ef4444', marginBottom: '12px' }}>
					Failed to load notifications
				</div>
				<button
					onClick={() => refresh()}
					style={{
						padding: '8px 16px',
						fontSize: '13px',
						color: '#3b82f6',
						backgroundColor: 'transparent',
						border: '1px solid #3b82f6',
						borderRadius: '4px',
						cursor: 'pointer',
					}}
				>
					Try Again
				</button>
			</div>
		)
	}

	// Empty state
	if (filteredMessages.length === 0) {
		return (
			<div className={className} style={{ padding: '48px 24px', textAlign: 'center' }}>
				{emptyContent || (
					<>
						<div style={{ fontSize: '32px', marginBottom: '12px' }}>\uD83D\uDD14</div>
						<div style={{ color: '#6b7280', fontSize: '14px' }}>
							{unreadOnly ? 'No unread notifications' : 'No notifications yet'}
						</div>
					</>
				)}
			</div>
		)
	}

	return (
		<div className={className}>
			{/* Header */}
			{showMarkAllAsRead && unreadCount > 0 && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '12px 16px',
						borderBottom: '1px solid #e5e7eb',
					}}
				>
					<span style={{ fontSize: '13px', color: '#6b7280' }}>
						{unreadCount} unread
					</span>
					<button
						onClick={handleMarkAllAsRead}
						style={{
							padding: '4px 8px',
							fontSize: '12px',
							color: '#3b82f6',
							backgroundColor: 'transparent',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						Mark all as read
					</button>
				</div>
			)}

			{/* Messages */}
			{groupByDate && groupedMessages ? (
				Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
					<div key={dateLabel}>
						<div
							style={{
								padding: '8px 16px',
								fontSize: '11px',
								fontWeight: 600,
								color: '#9ca3af',
								textTransform: 'uppercase',
								backgroundColor: '#f9fafb',
								borderBottom: '1px solid #e5e7eb',
							}}
						>
							{dateLabel}
						</div>
						{msgs.map((message) =>
							renderMessage ? (
								renderMessage(message, createActions(message))
							) : (
								<DefaultMessageCard
									key={message.id}
									message={message}
									actions={createActions(message)}
									onActionClick={onActionClick}
									onDismiss={onDismiss}
								/>
							)
						)}
					</div>
				))
			) : (
				filteredMessages.map((message) =>
					renderMessage ? (
						renderMessage(message, createActions(message))
					) : (
						<DefaultMessageCard
							key={message.id}
							message={message}
							actions={createActions(message)}
							onActionClick={onActionClick}
							onDismiss={onDismiss}
						/>
					)
				)
			)}
		</div>
	)
}

// ============================================
// Convenience Hooks
// ============================================

/**
 * Hook for notification bell with dropdown
 *
 * @example
 * ```tsx
 * function NotificationBell() {
 *   const { isOpen, toggle, close, unreadCount } = useNotificationDropdown()
 *
 *   return (
 *     <div style={{ position: 'relative' }}>
 *       <button onClick={toggle}>
 *         <BellIcon />
 *         {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
 *       </button>
 *       {isOpen && (
 *         <div style={{ position: 'absolute', top: '100%', right: 0 }}>
 *           <NotificationCenter onActionClick={close} />
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useNotificationDropdown() {
	const [isOpen, setIsOpen] = useState(false)
	const { unreadCount, refresh } = useInbox()

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev)
	}, [])

	const open = useCallback(() => {
		setIsOpen(true)
		refresh() // Refresh when opening
	}, [refresh])

	const close = useCallback(() => {
		setIsOpen(false)
	}, [])

	return {
		isOpen,
		toggle,
		open,
		close,
		unreadCount,
	}
}

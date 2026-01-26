/**
 * Modal Component
 *
 * Overlay modal for SignIn/SignUp in modal mode.
 * Self-contained with portal rendering.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ThemeVariables } from './styles'
import { defaultTheme, mergeStyles, injectGlobalStyles } from './styles'

export interface ModalProps {
	/** Whether the modal is open */
	open: boolean
	/** Called when the modal should close */
	onClose: () => void
	/** Modal content */
	children: ReactNode
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name for the modal container */
	className?: string
	/** Whether to close on backdrop click (default: true) */
	closeOnBackdropClick?: boolean
	/** Whether to close on Escape key (default: true) */
	closeOnEscape?: boolean
}

/**
 * Modal component with backdrop and portal rendering
 */
export function Modal({
	open,
	onClose,
	children,
	theme = defaultTheme,
	className,
	closeOnBackdropClick = true,
	closeOnEscape = true,
}: ModalProps) {
	const modalRef = useRef<HTMLDivElement>(null)

	// Inject global styles (keyframes)
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Handle escape key
	useEffect(() => {
		if (!open || !closeOnEscape) return

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [open, onClose, closeOnEscape])

	// Lock body scroll when open
	useEffect(() => {
		if (!open) return

		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = originalOverflow
		}
	}, [open])

	// Focus trap with cycling and focus restoration
	useEffect(() => {
		if (!open || !modalRef.current) return

		// Store previously focused element for restoration
		const previousActiveElement = document.activeElement as HTMLElement | null

		const focusableSelector =
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector)

		if (focusableElements.length === 0) return

		const firstElement = focusableElements[0]
		const lastElement = focusableElements[focusableElements.length - 1]

		// Focus first element
		firstElement.focus()

		// Handle Tab key for focus cycling
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key !== 'Tab') return

			// Shift+Tab on first element -> focus last element
			if (e.shiftKey && document.activeElement === firstElement) {
				e.preventDefault()
				lastElement.focus()
			}
			// Tab on last element -> focus first element
			else if (!e.shiftKey && document.activeElement === lastElement) {
				e.preventDefault()
				firstElement.focus()
			}
		}

		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			// Restore focus when modal closes
			previousActiveElement?.focus()
		}
	}, [open])

	if (!open) return null

	// Don't render on server
	if (typeof document === 'undefined') return null

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (closeOnBackdropClick && e.target === e.currentTarget) {
			onClose()
		}
	}

	const backdropStyle: React.CSSProperties = {
		position: 'fixed',
		inset: 0,
		zIndex: 9999,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		backdropFilter: 'blur(4px)',
		animation: 'sylphx-fade-in 0.15s ease-out',
	}

	const contentStyle: React.CSSProperties = {
		position: 'relative',
		maxWidth: '28rem',
		width: '100%',
		maxHeight: '90vh',
		overflow: 'auto',
		margin: '1rem',
		backgroundColor: theme.colorBackground,
		borderRadius: theme.borderRadiusLg,
		boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
		animation: 'sylphx-scale-in 0.2s ease-out',
	}

	const closeButtonStyle: React.CSSProperties = {
		position: 'absolute',
		top: '0.75rem',
		right: '0.75rem',
		width: '2rem',
		height: '2rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'transparent',
		border: 'none',
		borderRadius: theme.borderRadiusSm,
		color: theme.colorMutedForeground,
		cursor: 'pointer',
		transition: 'color 0.15s ease-in-out, background-color 0.15s ease-in-out',
	}

	const modal = (
		<div
			style={backdropStyle}
			onClick={handleBackdropClick}
			role="dialog"
			aria-modal="true"
		>
			<div
				ref={modalRef}
				style={mergeStyles(contentStyle)}
				className={className}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					onClick={onClose}
					style={closeButtonStyle}
					aria-label="Close"
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = theme.colorMuted
						e.currentTarget.style.color = theme.colorForeground
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent'
						e.currentTarget.style.color = theme.colorMutedForeground
					}}
				>
					<CloseIcon />
				</button>
				{children}
			</div>
		</div>
	)

	return createPortal(modal, document.body)
}

/**
 * Close icon SVG
 */
function CloseIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
		>
			<path d="M4 4L12 12M12 4L4 12" />
		</svg>
	)
}

/**
 * Hook to manage modal state
 */
export function useModal(initialOpen = false) {
	const [open, setOpen] = useState(initialOpen)

	const openModal = useCallback(() => setOpen(true), [])
	const closeModal = useCallback(() => setOpen(false), [])
	const toggleModal = useCallback(() => setOpen((prev) => !prev), [])

	return {
		open,
		openModal,
		closeModal,
		toggleModal,
		setOpen,
	}
}

// Import React hooks for useModal
import { useState, useCallback } from 'react'

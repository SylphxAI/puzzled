'use client'

import { Popover as BasePopover } from '@base-ui/react/popover'
import { motion } from 'motion/react'
import { forwardRef } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

// ==================
// Popover Root
// ==================

interface PopoverProps {
	/** Whether the popover is open (controlled) */
	open?: boolean
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void
	/** Children */
	children?: React.ReactNode
}

function Popover({ open, defaultOpen, onOpenChange, children }: PopoverProps) {
	return (
		<BasePopover.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			{children}
		</BasePopover.Root>
	)
}

// ==================
// Popover Trigger
// ==================

interface PopoverTriggerProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to render as child element */
	asChild?: boolean
}

const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
	({ className, children, asChild }, ref) => (
		<BasePopover.Trigger
			ref={ref}
			className={className}
			render={asChild ? (children as React.ReactElement) : undefined}
		>
			{asChild ? undefined : children}
		</BasePopover.Trigger>
	),
)
PopoverTrigger.displayName = 'PopoverTrigger'

// ==================
// Popover Anchor (custom implementation - not in Base UI)
// ==================

interface PopoverAnchorProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const PopoverAnchor = forwardRef<HTMLDivElement, PopoverAnchorProps>(
	({ className, children }, ref) => (
		<div ref={ref} className={className}>
			{children}
		</div>
	),
)
PopoverAnchor.displayName = 'PopoverAnchor'

// ==================
// Popover Close
// ==================

interface PopoverCloseProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const PopoverClose = forwardRef<HTMLButtonElement, PopoverCloseProps>(
	({ className, children }, ref) => (
		<BasePopover.Close ref={ref} className={className}>
			{children}
		</BasePopover.Close>
	),
)
PopoverClose.displayName = 'PopoverClose'

// ==================
// Popover Content
// ==================

const MotionDiv = motion.create('div')

interface PopoverContentProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Alignment relative to trigger */
	align?: 'start' | 'center' | 'end'
	/** Side offset */
	sideOffset?: number
	/** Side */
	side?: 'top' | 'right' | 'bottom' | 'left'
	/** Whether to render as child element (ignored, kept for API compat) */
	asChild?: boolean
	/** Force mount the content (ignored, kept for API compat) */
	forceMount?: boolean
	/** Click handler */
	onClick?: (e: React.MouseEvent) => void
}

const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
	({ className, align = 'center', sideOffset = 4, side = 'bottom', onClick, children }, ref) => (
		<BasePopover.Portal>
			<BasePopover.Positioner sideOffset={sideOffset} side={side} align={align}>
				<BasePopover.Popup
					ref={ref}
					onClick={onClick}
					className={cn('z-popover w-72 rounded-lg border bg-card text-card-foreground shadow-lg outline-none', className)}
				>
					<MotionDiv
						initial={{ opacity: 0, scale: 0.95, y: -4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="p-4"
					>
						{children}
					</MotionDiv>
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	),
)
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose }

export type {
	PopoverProps,
	PopoverTriggerProps,
	PopoverContentProps,
	PopoverAnchorProps,
	PopoverCloseProps,
}

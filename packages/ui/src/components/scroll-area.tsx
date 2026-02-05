'use client'

import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// ScrollArea
// ==================

interface ScrollAreaProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
	({ className, children }, ref) => (
		<BaseScrollArea.Root ref={ref} className={cn('relative overflow-hidden', className)}>
			<BaseScrollArea.Viewport className="h-full w-full rounded-[inherit]">
				{children}
			</BaseScrollArea.Viewport>
			<ScrollBar />
			<BaseScrollArea.Corner />
		</BaseScrollArea.Root>
	),
)
ScrollArea.displayName = 'ScrollArea'

// ==================
// ScrollBar
// ==================

interface ScrollBarProps {
	/** Orientation of the scrollbar */
	orientation?: 'vertical' | 'horizontal'
	/** Additional CSS classes */
	className?: string
}

const ScrollBar = forwardRef<HTMLDivElement, ScrollBarProps>(
	({ className, orientation = 'vertical' }, ref) => (
		<BaseScrollArea.Scrollbar
			ref={ref}
			orientation={orientation}
			className={cn(
				'flex touch-none select-none transition-colors',
				orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
				orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
				className,
			)}
		>
			<BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-border" />
		</BaseScrollArea.Scrollbar>
	),
)
ScrollBar.displayName = 'ScrollBar'

export { ScrollArea, ScrollBar }

export type {
	ScrollAreaProps,
	ScrollBarProps,
}

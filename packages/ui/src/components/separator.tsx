'use client'

import { Separator as BaseSeparator } from '@base-ui/react/separator'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Separator
// ==================

interface SeparatorProps {
	/** Orientation of the separator */
	orientation?: 'horizontal' | 'vertical'
	/** Whether the separator is decorative */
	decorative?: boolean
	/** Additional CSS classes */
	className?: string
}

const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
	({ className, orientation = 'horizontal' }, ref) => (
		<BaseSeparator
			ref={ref}
			orientation={orientation}
			className={cn(
				'shrink-0 bg-border',
				orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
				className,
			)}
		/>
	),
)
Separator.displayName = 'Separator'

export { Separator }

export type { SeparatorProps }

'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { motion } from 'motion/react'
import { forwardRef } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

// Create motion-enhanced div
const MotionDiv = motion.create('div')

const TooltipContent = forwardRef<
	React.ComponentRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn('z-50 overflow-hidden rounded-lg bg-foreground text-sm text-background shadow-md', className)}
			{...props}
		>
			<MotionDiv
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: duration.fast, ease: easing.easeOut }}
				className="px-3 py-1.5"
			>
				{children}
			</MotionDiv>
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Simple tooltip wrapper for common use case
// Self-contained - includes its own TooltipProvider for ease of use
type SimpleTooltipProps = {
	content: React.ReactNode
	children: React.ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	delayDuration?: number
}

function SimpleTooltip({
	content,
	children,
	side = 'top',
	delayDuration = 200,
}: SimpleTooltipProps) {
	return (
		<TooltipProvider delayDuration={delayDuration}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent side={side}>{content}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip }

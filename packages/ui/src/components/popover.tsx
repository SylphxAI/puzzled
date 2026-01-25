'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { motion } from 'motion/react'
import { forwardRef } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverClose = PopoverPrimitive.Close

// Create motion-enhanced div
const MotionDiv = motion.create('div')

const PopoverContent = forwardRef<
	React.ComponentRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, children, ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			ref={ref}
			align={align}
			sideOffset={sideOffset}
			className={cn('z-50 w-72 rounded-lg border bg-card text-card-foreground shadow-lg outline-none', className)}
			{...props}
		>
			<MotionDiv
				initial={{ opacity: 0, scale: 0.95, y: -4 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{ duration: duration.fast, ease: easing.easeOut }}
				className="p-4"
			>
				{children}
			</MotionDiv>
		</PopoverPrimitive.Content>
	</PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose }

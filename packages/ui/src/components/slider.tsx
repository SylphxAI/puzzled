'use client'

import * as SliderPrimitive from '@radix-ui/react-slider'
import { forwardRef } from 'react'
import { cn } from '../utils'

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
	/** Accessible label for the slider thumb */
	'aria-label'?: string
}

const Slider = forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
	({ className, 'aria-label': ariaLabel, ...props }, ref) => (
		<SliderPrimitive.Root
			ref={ref}
			className={cn('relative flex w-full touch-none select-none items-center', className)}
			{...props}
		>
			<SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
				<SliderPrimitive.Range className="absolute h-full bg-primary" />
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				className={cn(
					// h-7 w-7 = 28px visible, with ring offset provides adequate touch area
					'block h-7 w-7 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors',
					'hover:border-primary/80 hover:shadow-md',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					'disabled:pointer-events-none disabled:opacity-50',
				)}
				aria-label={ariaLabel ?? 'Slider'}
			/>
		</SliderPrimitive.Root>
	),
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

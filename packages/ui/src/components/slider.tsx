'use client'

import { Slider as BaseSlider } from '@base-ui/react/slider'
import { forwardRef } from 'react'
import { cn } from '../utils'

interface SliderProps {
	/** Current value (controlled) */
	value?: number | number[]
	/** Default value (uncontrolled) */
	defaultValue?: number | number[]
	/** Minimum value */
	min?: number
	/** Maximum value */
	max?: number
	/** Step increment */
	step?: number
	/** Whether the slider is disabled */
	disabled?: boolean
	/** Orientation */
	orientation?: 'horizontal' | 'vertical'
	/** Accessible label for the slider */
	'aria-label'?: string
	/** Handler fired when value changes */
	onValueChange?: (value: number | number[]) => void
	/** Handler fired when value is committed (on drag end) */
	onValueCommitted?: (value: number | number[]) => void
	/** Additional CSS classes */
	className?: string
}

const Slider = forwardRef<HTMLDivElement, SliderProps>(
	({ className, 'aria-label': ariaLabel, value, defaultValue, min = 0, max = 100, step = 1, disabled, orientation = 'horizontal', onValueChange, onValueCommitted }, ref) => (
		<BaseSlider.Root
			ref={ref}
			value={value}
			defaultValue={defaultValue ?? [min]}
			min={min}
			max={max}
			step={step}
			disabled={disabled}
			orientation={orientation}
			onValueChange={onValueChange}
			onValueCommitted={onValueCommitted}
			aria-label={ariaLabel ?? 'Slider'}
			className={cn('relative flex w-full touch-none select-none items-center', className)}
		>
			<BaseSlider.Control className="relative flex w-full items-center">
				<BaseSlider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
					<BaseSlider.Indicator className="absolute h-full bg-primary" />
				</BaseSlider.Track>
				<BaseSlider.Thumb
					className={cn(
						// h-7 w-7 = 28px visible, with ring offset provides adequate touch area
						'block h-7 w-7 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors',
						'hover:border-primary/80 hover:shadow-md',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
					)}
				/>
			</BaseSlider.Control>
		</BaseSlider.Root>
	),
)
Slider.displayName = 'Slider'

export { Slider }
export type { SliderProps }

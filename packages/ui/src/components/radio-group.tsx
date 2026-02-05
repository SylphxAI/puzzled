'use client'

import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { Circle } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// RadioGroup Root
// ==================

interface RadioGroupProps {
	/** Controlled value */
	value?: string
	/** Default value (uncontrolled) */
	defaultValue?: string
	/** Handler fired when value changes */
	onValueChange?: (value: string) => void
	/** Whether the group is disabled */
	disabled?: boolean
	/** Whether the group is required */
	required?: boolean
	/** Name for form submission */
	name?: string
	/** Orientation */
	orientation?: 'horizontal' | 'vertical'
	/** Additional CSS classes */
	className?: string
	/** Children */
	children?: React.ReactNode
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
	({ className, value, defaultValue, onValueChange, disabled, name, children }, ref) => (
		<BaseRadioGroup
			ref={ref}
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			disabled={disabled}
			name={name}
			className={cn('grid gap-2', className)}
		>
			{children}
		</BaseRadioGroup>
	),
)
RadioGroup.displayName = 'RadioGroup'

// ==================
// RadioGroup Item
// ==================

interface RadioGroupItemProps {
	/** Value of the radio item */
	value: string
	/** Whether the item is disabled */
	disabled?: boolean
	/** Additional CSS classes */
	className?: string
}

const RadioGroupItem = forwardRef<HTMLButtonElement, RadioGroupItemProps>(
	({ className, value, disabled }, ref) => (
		<BaseRadio.Root
			ref={ref}
			value={value}
			disabled={disabled}
			className={cn(
				// h-6 w-6 = 24px visual size, the label alongside provides additional touch area
				'aspect-square h-6 w-6 rounded-full border border-primary text-primary',
				'ring-offset-background transition-colors hover:border-primary/70',
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
		>
			<BaseRadio.Indicator className="flex items-center justify-center">
				<Circle className="h-3 w-3 fill-current text-current" />
			</BaseRadio.Indicator>
		</BaseRadio.Root>
	),
)
RadioGroupItem.displayName = 'RadioGroupItem'

// ==================
// RadioCard (Card-style radio option)
// ==================

interface RadioCardProps {
	/** Value of the radio item */
	value: string
	/** Title text */
	title: string
	/** Description text */
	description?: string
	/** Whether the item is disabled */
	disabled?: boolean
	/** Additional CSS classes */
	className?: string
}

const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(
	({ className, value, title, description, disabled }, ref) => (
		<BaseRadio.Root
			ref={ref}
			value={value}
			disabled={disabled}
			className={cn(
				// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
				'flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-4 min-h-11 cursor-pointer',
				'ring-offset-background transition-all',
				'hover:bg-muted/50',
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
				'data-[checked]:border-primary data-[checked]:bg-primary/5',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
		>
			<div
				className={cn(
					'mt-0.5 aspect-square h-4 w-4 shrink-0 rounded-full border border-primary',
					'transition-colors',
				)}
			>
				<BaseRadio.Indicator className="flex items-center justify-center h-full">
					<Circle className="h-2 w-2 fill-current" />
				</BaseRadio.Indicator>
			</div>
			<div className="flex-1">
				<div className="font-medium text-foreground">{title}</div>
				{description && (
					<div className="text-sm text-muted-foreground mt-0.5">{description}</div>
				)}
			</div>
		</BaseRadio.Root>
	),
)
RadioCard.displayName = 'RadioCard'

export { RadioGroup, RadioGroupItem, RadioCard }

export type {
	RadioGroupProps,
	RadioGroupItemProps,
	RadioCardProps,
}

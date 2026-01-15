'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

const RadioGroup = forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
	return (
		<RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} ref={ref} />
	)
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
	return (
		<RadioGroupPrimitive.Item
			ref={ref}
			className={cn(
				'aspect-square h-4 w-4 rounded-full border border-primary text-primary',
				'ring-offset-background transition-colors',
				'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className,
			)}
			{...props}
		>
			<RadioGroupPrimitive.Indicator className="flex items-center justify-center">
				<Circle className="h-2.5 w-2.5 fill-current text-current" />
			</RadioGroupPrimitive.Indicator>
		</RadioGroupPrimitive.Item>
	)
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

// Card-style radio option for more prominent selections
type RadioCardProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
	title: string
	description?: string
}

const RadioCard = forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Item>, RadioCardProps>(
	({ className, title, description, ...props }, ref) => {
		return (
			<RadioGroupPrimitive.Item
				ref={ref}
				className={cn(
					'flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-4 cursor-pointer',
					'ring-offset-background transition-all',
					'hover:bg-muted/50',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
					'data-[state=checked]:border-primary data-[state=checked]:bg-primary/5',
					'disabled:cursor-not-allowed disabled:opacity-50',
					className,
				)}
				{...props}
			>
				<div
					className={cn(
						'mt-0.5 aspect-square h-4 w-4 shrink-0 rounded-full border border-primary',
						'transition-colors',
						'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
					)}
				>
					<RadioGroupPrimitive.Indicator className="flex items-center justify-center h-full">
						<Circle className="h-2 w-2 fill-current" />
					</RadioGroupPrimitive.Indicator>
				</div>
				<div className="flex-1">
					<div className="font-medium text-foreground">{title}</div>
					{description && (
						<div className="text-sm text-muted-foreground mt-0.5">{description}</div>
					)}
				</div>
			</RadioGroupPrimitive.Item>
		)
	},
)
RadioCard.displayName = 'RadioCard'

export { RadioGroup, RadioGroupItem, RadioCard }

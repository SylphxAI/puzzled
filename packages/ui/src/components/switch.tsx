'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import { forwardRef, useId } from 'react'
import { cn } from '../utils'

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
	label?: string
	description?: string
}

const Switch = forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(
	({ className, label, description, id: providedId, ...props }, ref) => {
		const generatedId = useId()
		const id = providedId || generatedId

		const switchElement = (
			<SwitchPrimitive.Root
				ref={ref}
				id={id}
				className={cn(
					'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
					'disabled:cursor-not-allowed disabled:opacity-50',
					'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
					className,
				)}
				{...props}
			>
				<SwitchPrimitive.Thumb
					className={cn(
						'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
						'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
					)}
				/>
			</SwitchPrimitive.Root>
		)

		if (!label && !description) {
			return switchElement
		}

		return (
			<div className="flex items-center gap-3">
				{switchElement}
				<label htmlFor={id} className="cursor-pointer select-none">
					{label && <span className="text-sm font-medium">{label}</span>}
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</label>
			</div>
		)
	},
)

Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }

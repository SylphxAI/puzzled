/**
 * @sylphx/ui - Switch Component
 *
 * Accessible toggle switch built on Radix UI primitives.
 * Supports optional label and description.
 *
 * @example
 * ```tsx
 * import { Switch } from '@sylphx/ui'
 *
 * // Basic switch
 * <Switch />
 *
 * // Controlled switch
 * const [enabled, setEnabled] = useState(false)
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 *
 * // With label
 * <Switch label="Dark mode" />
 *
 * // With label and description
 * <Switch
 *   label="Email notifications"
 *   description="Receive emails about account activity"
 * />
 * ```
 *
 * @module @sylphx/ui/switch
 */

'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import { forwardRef, useId } from 'react'
import { cn } from '../utils'

/**
 * Props for the Switch component.
 * Extends Radix UI Switch props with optional label and description.
 */
type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
	/** Label text displayed next to the switch */
	label?: string
	/** Description text displayed below the label */
	description?: string
}

/**
 * Toggle switch component for binary on/off settings.
 *
 * Features:
 * - Built on Radix UI for accessibility
 * - Keyboard navigable (Space/Enter to toggle)
 * - Optional label and description
 * - Auto-generated IDs for label association
 * - Focus ring for keyboard navigation
 * - Disabled state styling
 *
 * @example
 * ```tsx
 * // Settings toggle
 * <Switch
 *   label="Push notifications"
 *   description="Get notified when someone mentions you"
 *   checked={notifications}
 *   onCheckedChange={setNotifications}
 * />
 * ```
 */
const Switch = forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(
	({ className, label, description, id: providedId, ...props }, ref) => {
		const generatedId = useId()
		const id = providedId || generatedId

		const switchElement = (
			<SwitchPrimitive.Root
				ref={ref}
				id={id}
				className={cn(
					'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
					'transition-colors duration-200',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
					'disabled:cursor-not-allowed disabled:opacity-50',
					'data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-track',
					'active:scale-[0.98] motion-reduce:active:scale-100',
					className,
				)}
				{...props}
			>
				<SwitchPrimitive.Thumb
					className={cn(
						'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0',
						// Smooth spring-like transition for the thumb
						'transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
						'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
						// Subtle scale on active state
						'data-[state=checked]:scale-100',
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

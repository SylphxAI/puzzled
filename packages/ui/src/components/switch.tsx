/**
 * @sylphx/ui - Switch Component
 *
 * Accessible toggle switch built on Radix UI primitives.
 * Uses inline styles for checked/unchecked states to avoid
 * Tailwind v4 tree-shaking issues with data-[state=*] utilities.
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
 * Uses Radix UI for accessibility (keyboard, ARIA, focus management).
 * Visual states use CSS custom properties + attribute selectors defined
 * in a <style> tag to avoid Tailwind v4/Turbopack tree-shaking issues.
 */
const Switch = forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(
	({ className, label, description, id: providedId, ...props }, ref) => {
		const generatedId = useId()
		const id = providedId || generatedId

		const switchElement = (
			<SwitchPrimitive.Root
				ref={ref}
				id={id}
				className={cn('switch-root', className)}
				{...props}
			>
				<SwitchPrimitive.Thumb className="switch-thumb" />
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

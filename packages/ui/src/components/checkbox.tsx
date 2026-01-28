/**
 * @sylphx/ui - Checkbox Component
 *
 * Accessible checkbox built on Radix UI primitives.
 * Features animated checkmark for satisfying micro-interaction.
 *
 * @example
 * ```tsx
 * import { Checkbox } from '@sylphx/ui'
 *
 * // Basic checkbox
 * <Checkbox />
 *
 * // Controlled checkbox
 * const [checked, setChecked] = useState(false)
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // With label (using separate label element)
 * <div className="flex items-center gap-2">
 *   <Checkbox id="terms" />
 *   <label htmlFor="terms">Accept terms and conditions</label>
 * </div>
 *
 * // Disabled state
 * <Checkbox disabled />
 * ```
 *
 * @module @sylphx/ui/checkbox
 */

'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { forwardRef } from 'react'
import { cn } from '../utils'

/**
 * Animated checkmark icon component.
 * Uses SVG stroke-dashoffset animation for draw effect.
 */
function AnimatedCheck({ className }: { className?: string }) {
	return (
		<svg
			className={cn('h-4 w-4', className)}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path
				d="M5 12l5 5L19 7"
				className="animate-checkmark motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
			/>
		</svg>
	)
}

/**
 * Checkbox component for binary selection in forms.
 *
 * Features:
 * - Built on Radix UI for accessibility
 * - Keyboard navigable (Space to toggle)
 * - Animated checkmark with draw effect
 * - Focus ring for keyboard navigation
 * - Disabled state styling
 * - Compatible with react-hook-form
 * - Respects prefers-reduced-motion
 *
 * @example
 * ```tsx
 * // Form with checkboxes
 * <form>
 *   <div className="flex items-center gap-2">
 *     <Checkbox id="marketing" name="marketing" />
 *     <label htmlFor="marketing">Marketing emails</label>
 *   </div>
 *   <div className="flex items-center gap-2">
 *     <Checkbox id="updates" name="updates" />
 *     <label htmlFor="updates">Product updates</label>
 *   </div>
 * </form>
 * ```
 */
const Checkbox = forwardRef<
	React.ComponentRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			// h-6 w-6 with min-h-11 min-w-11 touch area wrapper effect via padding
			// Actual checkbox is 24px but clickable area extends via focus ring offset
			'peer h-6 w-6 shrink-0 rounded-md border border-primary ring-offset-background',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			'disabled:cursor-not-allowed disabled:opacity-50',
			'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
			'transition-all duration-150 hover:border-primary/70',
			'active:scale-95 motion-reduce:active:scale-100',
			className,
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
			<AnimatedCheck />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

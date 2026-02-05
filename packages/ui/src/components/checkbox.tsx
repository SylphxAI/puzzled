/**
 * @sylphx/ui - Checkbox Component
 *
 * Accessible checkbox built on Base UI primitives.
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

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
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
 * Props for the Checkbox component
 */
interface CheckboxProps {
	/** Whether the checkbox is checked (controlled). Can be boolean or 'indeterminate' */
	checked?: boolean | 'indeterminate'
	/** Default checked state (uncontrolled) */
	defaultChecked?: boolean
	/** Handler fired when the checkbox is toggled */
	onCheckedChange?: (checked: boolean) => void
	/** Whether the checkbox is disabled */
	disabled?: boolean
	/** Whether the checkbox is required */
	required?: boolean
	/** Name for form submission */
	name?: string
	/** Value for form submission */
	value?: string
	/** ID for label association */
	id?: string
	/** Additional CSS classes */
	className?: string
	/** Click handler */
	onClick?: (e: React.MouseEvent) => void
	/** Aria label */
	'aria-label'?: string
}

/**
 * Checkbox component for binary selection in forms.
 *
 * Features:
 * - Built on Base UI for accessibility
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
const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
	({ className, checked, defaultChecked, onCheckedChange, disabled, required, name, value, id, onClick, 'aria-label': ariaLabel }, ref) => {
		// Base UI doesn't support 'indeterminate' string, only boolean
		// Convert 'indeterminate' to true for visual purposes
		const normalizedChecked = checked === 'indeterminate' ? true : checked
		const isIndeterminate = checked === 'indeterminate'

		return (
			<BaseCheckbox.Root
				ref={ref}
				id={id}
				name={name}
				value={value}
				checked={normalizedChecked}
				defaultChecked={defaultChecked}
				onCheckedChange={onCheckedChange}
				disabled={disabled}
				required={required}
				indeterminate={isIndeterminate}
				onClick={onClick}
				aria-label={ariaLabel}
				className={cn(
					// h-6 w-6 with min-h-11 min-w-11 touch area wrapper effect via padding
					// Actual checkbox is 24px but clickable area extends via focus ring offset
					'peer h-6 w-6 shrink-0 rounded-md border border-primary ring-offset-background',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					'disabled:cursor-not-allowed disabled:opacity-50',
					// Base UI uses data-checked instead of data-[state=checked]
					'data-[checked]:bg-primary data-[checked]:text-primary-foreground',
					'data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground',
					'transition-all duration-150 hover:border-primary/70',
					'active:scale-95 motion-reduce:active:scale-100',
					className,
				)}
			>
				<BaseCheckbox.Indicator className={cn('flex items-center justify-center text-current')}>
					{isIndeterminate ? <MinusIcon /> : <AnimatedCheck />}
				</BaseCheckbox.Indicator>
			</BaseCheckbox.Root>
		)
	},
)
Checkbox.displayName = 'Checkbox'

/**
 * Minus icon for indeterminate state
 */
function MinusIcon({ className }: { className?: string }) {
	return (
		<svg
			className={cn('h-4 w-4', className)}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
		>
			<path d="M5 12h14" />
		</svg>
	)
}

export { Checkbox }
export type { CheckboxProps }

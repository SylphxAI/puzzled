/**
 * @sylphx/ui - Button Component
 *
 * A versatile button component with multiple variants and sizes.
 * Fully accessible with proper focus states and touch targets.
 *
 * @example
 * ```tsx
 * import { Button } from '@sylphx/ui'
 *
 * // Basic usage
 * <Button>Click me</Button>
 *
 * // With variant
 * <Button variant="secondary">Secondary</Button>
 * <Button variant="outline">Outline</Button>
 * <Button variant="ghost">Ghost</Button>
 * <Button variant="destructive">Delete</Button>
 *
 * // With size
 * <Button size="sm">Small</Button>
 * <Button size="lg">Large</Button>
 * <Button size="icon"><IconPlus /></Button>
 *
 * // As a link (using asChild)
 * <Button asChild>
 *   <a href="/dashboard">Dashboard</a>
 * </Button>
 * ```
 *
 * @module @sylphx/ui/button
 */

import { Slot } from '@radix-ui/react-slot'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../utils'

/**
 * Props for the Button component.
 *
 * @property variant - Visual style variant (default: 'default')
 * @property size - Size variant (default: 'default')
 * @property asChild - If true, renders as the child element instead of a button
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * Visual style variant.
	 * - `default`: Primary action button with brand color
	 * - `secondary`: Secondary actions with muted background
	 * - `outline`: Bordered button for subtle actions
	 * - `ghost`: Minimal button for navigation/text links
	 * - `destructive`: Red button for dangerous actions
	 */
	variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
	/**
	 * Size variant. All sizes meet 44px+ minimum touch target.
	 * - `default`: Standard size (h-11)
	 * - `sm`: Small size (h-10)
	 * - `lg`: Large size (h-12)
	 * - `icon`: Square button for icons (h-11 w-11)
	 */
	size?: 'default' | 'sm' | 'lg' | 'icon'
	/**
	 * If true, the button will render as the child element (using Radix Slot).
	 * Useful for rendering as a link with proper button styling.
	 */
	asChild?: boolean
}

/**
 * Generates button class names based on variant and size.
 * Can be used independently to style other elements as buttons.
 *
 * @param options - Configuration object with variant, size, and className
 * @returns Combined class string for button styling
 *
 * @example
 * ```tsx
 * // Style a link as a button
 * <a className={buttonVariants({ variant: 'outline' })}>
 *   Learn more
 * </a>
 * ```
 */
export function buttonVariants({
	variant = 'default',
	size = 'default',
	className,
}: {
	variant?: ButtonProps['variant']
	size?: ButtonProps['size']
	className?: string
} = {}) {
	return cn(
		// Base styles - Professional with subtle feedback
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
		// Variants
		variant === 'default' &&
			'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-px',
		variant === 'secondary' &&
			'bg-muted text-foreground hover:bg-muted/80',
		variant === 'outline' &&
			'border border-border bg-background hover:bg-muted hover:border-muted-foreground/30',
		variant === 'ghost' && 'hover:bg-muted',
		variant === 'destructive' &&
			'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		// Sizes - all meet 44px+ minimum touch target
		size === 'default' && 'h-11 px-5 py-2',
		size === 'sm' && 'h-10 px-4 text-sm',
		size === 'lg' && 'h-12 px-6 text-lg',
		size === 'icon' && 'h-11 w-11',
		className,
	)
}

/**
 * Button component with multiple variants and sizes.
 *
 * Features:
 * - Five visual variants for different use cases
 * - Four size options, all meeting accessibility touch targets
 * - Support for rendering as child element (links, etc.)
 * - Proper focus states and disabled styling
 * - Subtle hover/active animations
 *
 * @see {@link ButtonProps} for available props
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return <Comp ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
	},
)

Button.displayName = 'Button'

export { Button }

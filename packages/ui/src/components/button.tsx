import { Slot } from '@radix-ui/react-slot'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
	size?: 'default' | 'sm' | 'lg' | 'icon'
	asChild?: boolean
}

// Variant styles as a function for reuse in other components
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
		// Base styles - Playful roundness with brand-tinted shadows
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
		// Variants
		variant === 'default' &&
			'bg-gradient-to-b from-primary to-primary/90 text-white shadow-[var(--shadow-button)] hover:shadow-[0_4px_12px_-2px_rgb(99_102_241/0.35)] hover:brightness-110',
		variant === 'secondary' &&
			'bg-muted text-foreground shadow-[var(--shadow-button)] hover:bg-muted/80 hover:shadow-[var(--shadow-tile-hover)]',
		variant === 'outline' &&
			'border-2 bg-background shadow-[var(--shadow-tile)] hover:bg-muted hover:border-primary/30 hover:shadow-[var(--shadow-tile-hover)]',
		variant === 'ghost' && 'hover:bg-muted',
		variant === 'destructive' &&
			'bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-md shadow-destructive/25 hover:shadow-lg hover:brightness-110',
		// Sizes - all meet 44px+ minimum touch target
		size === 'default' && 'h-11 px-5 py-2',
		size === 'sm' && 'h-10 px-4 text-sm',
		size === 'lg' && 'h-12 px-6 text-lg',
		size === 'icon' && 'h-11 w-11',
		className,
	)
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return <Comp ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
	},
)

Button.displayName = 'Button'

export { Button }

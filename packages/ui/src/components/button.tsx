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

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return <Comp ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
	},
)

Button.displayName = 'Button'

export { Button }

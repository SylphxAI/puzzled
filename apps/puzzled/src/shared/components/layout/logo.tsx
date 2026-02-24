import { Gamepad2 } from 'lucide-react'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

type LogoProps = {
	showText?: boolean
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const sizeClasses = {
	sm: {
		container: 'h-7 w-7',
		icon: 'h-3.5 w-3.5',
		text: 'text-sm',
	},
	md: {
		container: 'h-8 w-8',
		icon: 'h-4 w-4',
		text: 'text-base',
	},
	lg: {
		container: 'h-10 w-10',
		icon: 'h-5 w-5',
		text: 'text-lg',
	},
}

export function Logo({ showText = true, size = 'md', className }: LogoProps) {
	const sizes = sizeClasses[size]

	return (
		<Link
			href="/"
			className={cn('flex items-center gap-2 font-bold', className)}
			aria-label="Puzzled - Home"
		>
			<div
				className={cn('flex items-center justify-center rounded-lg bg-primary', sizes.container)}
			>
				<Gamepad2 className={cn('text-primary-foreground', sizes.icon)} />
			</div>
			{showText && <span className={cn('font-semibold tracking-tight', sizes.text)}>Puzzled</span>}
		</Link>
	)
}

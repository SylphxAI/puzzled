import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/shared/components/brand/mark'

type LogoProps = {
	showText?: boolean
	size?: 'sm' | 'md' | 'lg'
	className?: string
	/** Wordmark ink for dark bands (footer, auth hero panels). */
	tone?: 'default' | 'inverse'
}

const sizeClasses = {
	sm: {
		mark: 28,
		text: 'text-base',
	},
	md: {
		mark: 34,
		text: 'text-lg',
	},
	lg: {
		mark: 42,
		text: 'text-2xl',
	},
}

export function Logo({ showText = true, size = 'md', className, tone = 'default' }: LogoProps) {
	const sizes = sizeClasses[size]

	return (
		<Link
			href="/"
			className={cn(
				'group flex items-center gap-2.5 rounded-xl font-bold outline-offset-4',
				tone === 'inverse' ? 'text-white' : 'text-foreground',
				className,
			)}
			aria-label="Puzzled - Home"
		>
			<BrandMark
				size={sizes.mark}
				className="transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105"
			/>
			{showText && (
				<span className={cn('font-display font-extrabold tracking-tight', sizes.text)}>
					Puzzled
				</span>
			)}
		</Link>
	)
}

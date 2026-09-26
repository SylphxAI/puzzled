import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { BrandMark, Wordmark } from '@/shared/components/brand/mark'

type LogoProps = {
	showText?: boolean
	size?: 'sm' | 'md' | 'lg'
	className?: string
	/** Wordmark ink for dark bands (footer, auth hero panels). */
	tone?: 'default' | 'inverse'
}

const sizes = {
	sm: { mark: 26, word: 18 },
	md: { mark: 30, word: 21 },
	lg: { mark: 40, word: 28 },
}

export function Logo({ showText = true, size = 'md', className, tone = 'default' }: LogoProps) {
	const s = sizes[size]
	return (
		<Link
			href="/"
			className={cn(
				// min-h-11 keeps the lockup a 44px target in every shell bar.
				'group pressable flex min-h-11 items-center gap-2 rounded-xl outline-offset-4',
				tone === 'inverse' ? 'text-ink-foreground' : 'text-foreground',
				className,
			)}
			aria-label="Puzzled - Home"
		>
			<BrandMark size={s.mark} tone={tone === 'inverse' ? 'inverse' : 'tile'} />
			{showText && <Wordmark height={s.word} className="mt-0.5" />}
		</Link>
	)
}

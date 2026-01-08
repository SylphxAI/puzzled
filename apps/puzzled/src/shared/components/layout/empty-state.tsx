import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@sylphx/ui'

type EmptyStateProps = {
	icon?: React.ReactNode
	title: string
	description?: string
	action?: {
		label: string
		href?: string
		onClick?: () => void
	}
	className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
	return (
		<div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
			{icon && (
				<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
					{icon}
				</div>
			)}
			<h3 className="text-lg font-semibold">{title}</h3>
			{description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
			{action && (
				<div className="mt-4">
					{action.href ? (
						<Button asChild>
							<Link href={action.href}>{action.label}</Link>
						</Button>
					) : (
						<Button onClick={action.onClick}>{action.label}</Button>
					)}
				</div>
			)}
		</div>
	)
}

// Pre-built empty states for common use cases
export function NoGamesPlayed({ onPlay }: { onPlay?: () => void }) {
	return (
		<EmptyState
			icon={
				<svg
					className="h-8 w-8"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
					/>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			}
			title="No games played yet"
			description="Start playing to track your stats and compete on leaderboards!"
			action={onPlay ? { label: 'Play Now', onClick: onPlay } : { label: 'Play Now', href: '/' }}
		/>
	)
}

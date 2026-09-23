import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

/**
 * Shared console chrome.
 *
 * These pieces are deliberately plain functions: the signed-in surfaces mix
 * server pages and client sections, and every one of them needs the same h1,
 * the same sectioned card, and the same honest "we could not read this"
 * language. They import nothing server-only, so a client section can use them.
 */

type ConsoleHeaderProps = {
	title: string
	description?: string
	/** Short line above the title, e.g. the surface name. */
	eyebrow?: string
	/**
	 * Heading level. Section pages inside a console that already renders the
	 * surface h1 (settings) use 2 so the document keeps one top-level heading.
	 */
	headingLevel?: 1 | 2
	/** Identity or status chips rendered under the description. */
	chips?: ReactNode
	actions?: ReactNode
	className?: string
}

export function ConsoleHeader({
	title,
	description,
	eyebrow,
	headingLevel = 1,
	chips,
	actions,
	className,
}: ConsoleHeaderProps) {
	const Heading = headingLevel === 2 ? 'h2' : 'h1'

	return (
		/*
		 * Page-level heading block, not a document banner: the shell already owns
		 * the only `banner` landmark, and a second `<header>` inside `<main>`
		 * would announce a competing one to screen readers.
		 */
		<div className={cn('animate-enter', className)}>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					{eyebrow ? (
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
							{eyebrow}
						</p>
					) : null}
					<Heading className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
						{title}
					</Heading>
					{description ? (
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							{description}
						</p>
					) : null}
					{chips ? <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div> : null}
				</div>
				{actions ? (
					<div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
		</div>
	)
}

type ConsoleCardProps = {
	title: string
	description?: string
	actions?: ReactNode
	children: ReactNode
	className?: string
	/** Padding for the body; tables often want none. */
	bodyClassName?: string
}

export function ConsoleCard({
	title,
	description,
	actions,
	children,
	className,
	bodyClassName,
}: ConsoleCardProps) {
	return (
		<section className={cn('surface-card overflow-hidden', className)}>
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4 md:px-5">
				<div className="min-w-0">
					<h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
					{description ? (
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
					) : null}
				</div>
				{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
			</div>
			<div className={cn('px-4 py-4 md:px-5', bodyClassName)}>{children}</div>
		</section>
	)
}

type ConsoleStatProps = {
	icon: LucideIcon
	label: string
	/** Formatted value. Pass the honest placeholder when the read failed. */
	value: string
	/** Context under the value — a fact, never decoration. */
	hint?: string
	/** Screen-reader text when `value` is a placeholder rather than a number. */
	srValue?: string
	tone?: 'brand' | 'streak' | 'win' | 'best'
}

const STAT_TONES: Record<NonNullable<ConsoleStatProps['tone']>, string> = {
	brand: 'text-primary',
	streak: 'text-accent-warm',
	win: 'text-stat-winrate',
	best: 'text-amber-500',
}

export function ConsoleStat({
	icon: Icon,
	label,
	value,
	hint,
	srValue,
	tone = 'brand',
}: ConsoleStatProps) {
	return (
		<div className="rounded-2xl border border-border/70 bg-surface-muted/60 p-4">
			<div className="flex items-center gap-2">
				<Icon className={cn('h-4 w-4', STAT_TONES[tone])} aria-hidden="true" />
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{label}
				</p>
			</div>
			<p
				className="mt-2 font-display text-2xl font-extrabold tnum numeral"
				aria-hidden={srValue ? 'true' : undefined}
			>
				{value}
			</p>
			{srValue ? <span className="sr-only">{srValue}</span> : null}
			{hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
		</div>
	)
}

type HonestNoticeProps = {
	title: string
	body: string
	icon?: LucideIcon
	tone?: 'attention' | 'quiet'
	/** Recovery affordance: a locale-aware link back into the surface. */
	action?: { href: string; label: string }
	/** Extra line for what happens next. */
	footnote?: string
	className?: string
}

/**
 * The single honest state for a read that did not come back, or for a surface
 * that genuinely has nothing yet. It never renders a zero in place of a
 * missing number and it always offers the next step.
 */
export function HonestNotice({
	title,
	body,
	icon: Icon,
	tone = 'attention',
	action,
	footnote,
	className,
}: HonestNoticeProps) {
	return (
		<div
			className={cn(
				'rounded-2xl border p-4 md:p-5',
				tone === 'attention'
					? 'border-amber-500/30 bg-amber-500/5'
					: 'border-border/70 bg-surface-muted/60',
				className,
			)}
		>
			<div className="flex items-start gap-3">
				{Icon ? (
					<span
						className={cn(
							'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
							tone === 'attention' ? 'bg-amber-500/10' : 'bg-muted',
						)}
					>
						<Icon
							className={cn(
								'h-5 w-5',
								tone === 'attention' ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
							)}
							aria-hidden="true"
						/>
					</span>
				) : null}
				<div className="min-w-0 flex-1">
					<p className="font-semibold">{title}</p>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
					{footnote ? (
						<p className="mt-2 text-xs leading-relaxed text-muted-foreground">{footnote}</p>
					) : null}
					{action ? (
						<Link
							href={action.href}
							className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{action.label}
						</Link>
					) : null}
				</div>
			</div>
		</div>
	)
}

'use client'

import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui'

interface GameSettingsCardProps {
	title: string
	description?: string
	children: ReactNode
	/** Icon component (LucideIcon) - will be rendered with variant styling */
	icon?: LucideIcon
	/** Pre-rendered icon element - use when passing from server components */
	iconElement?: ReactNode
	variant?: 'default' | 'security' | 'premium' | 'danger' | 'success'
	glowOnHover?: boolean
	collapsible?: boolean
	defaultOpen?: boolean
	className?: string
	headerAction?: ReactNode
	badge?: ReactNode
}

/**
 * Game Settings Card
 *
 * A distinctive, game-themed card component for settings pages.
 * Features subtle grid patterns, neon-like accents, and premium feel.
 * Supports progressive disclosure via collapsible content.
 */
export function GameSettingsCard({
	title,
	description,
	children,
	icon: Icon,
	iconElement,
	variant = 'default',
	glowOnHover = true,
	collapsible = false,
	defaultOpen = true,
	className,
	headerAction,
	badge,
}: GameSettingsCardProps) {
	const t = useTranslations('common')
	const [isOpen, setIsOpen] = useState(defaultOpen)

	const variantStyles = {
		default: {
			border: 'border-border/60',
			accent: 'from-primary/60 via-primary to-primary/60',
			iconBg: 'bg-primary/10',
			iconColor: 'text-primary',
			glow: 'group-hover:shadow-primary/10',
		},
		security: {
			border: 'border-emerald-500/30 dark:border-emerald-400/20',
			accent: 'from-emerald-500/80 via-emerald-400 to-teal-500/80',
			iconBg: 'bg-emerald-500/10',
			iconColor: 'text-emerald-500 dark:text-emerald-400',
			glow: 'group-hover:shadow-emerald-500/15',
		},
		premium: {
			border: 'border-amber-500/30 dark:border-amber-400/20',
			accent: 'from-amber-500/80 via-yellow-400 to-orange-500/80',
			iconBg: 'bg-amber-500/10',
			iconColor: 'text-amber-500 dark:text-amber-400',
			glow: 'group-hover:shadow-amber-500/15',
		},
		danger: {
			border: 'border-destructive/30',
			accent: 'from-destructive/80 via-red-500 to-rose-500/80',
			iconBg: 'bg-destructive/10',
			iconColor: 'text-destructive',
			glow: 'group-hover:shadow-destructive/15',
		},
		success: {
			border: 'border-green-500/30 dark:border-green-400/20',
			accent: 'from-green-500/80 via-emerald-400 to-green-500/80',
			iconBg: 'bg-green-500/10',
			iconColor: 'text-green-500 dark:text-green-400',
			glow: 'group-hover:shadow-green-500/15',
		},
	}

	const styles = variantStyles[variant]

	const cardContent = (
		<div
			className={cn(
				'group relative rounded-2xl border bg-card transition-all duration-300',
				styles.border,
				glowOnHover && ['hover:shadow-xl', styles.glow],
				className,
			)}
		>
			{/* Decorative elements container - overflow hidden only here */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
				{/* Subtle grid pattern overlay */}
				<div
					className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(to right, currentColor 1px, transparent 1px),
							linear-gradient(to bottom, currentColor 1px, transparent 1px)
						`,
						backgroundSize: '20px 20px',
					}}
				/>

				{/* Top accent line with gradient */}
				<div
					className={cn(
						'absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r opacity-80',
						styles.accent,
					)}
				/>

				{/* Corner accent */}
				<div
					className={cn(
						'absolute -right-8 -top-8 h-16 w-16 rounded-full bg-gradient-to-br opacity-10 transition-opacity duration-500 group-hover:opacity-20 motion-safe:blur-2xl',
						styles.accent,
					)}
				/>
			</div>

			{/* Header */}
			<div
				className={cn(
					'relative flex items-start justify-between gap-4 p-5',
					!collapsible && 'pb-0',
				)}
			>
				<div className="flex min-w-0 flex-1 items-start gap-4">
					{(Icon || iconElement) && (
						<div
							className={cn(
								'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
								styles.iconBg,
							)}
						>
							{Icon ? <Icon className={cn('h-5 w-5', styles.iconColor)} /> : iconElement}
						</div>
					)}
					<div className="min-w-0 flex-1 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h3>
							{badge && <span className="shrink-0">{badge}</span>}
						</div>
						{description && (
							<p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{headerAction && <div>{headerAction}</div>}
					{collapsible && (
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								aria-label={isOpen ? t('collapseSection') : t('expandSection')}
							>
								<ChevronDown
									className={cn(
										'h-5 w-5 transition-transform duration-200',
										isOpen && 'rotate-180',
									)}
								/>
							</button>
						</CollapsibleTrigger>
					)}
				</div>
			</div>

			{/* Content */}
			{collapsible ? (
				<CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
					<div className="relative p-5 pt-4">{children}</div>
				</CollapsibleContent>
			) : (
				<div className="relative p-5 pt-4">{children}</div>
			)}
		</div>
	)

	if (collapsible) {
		return (
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				{cardContent}
			</Collapsible>
		)
	}

	return cardContent
}

/**
 * Compact Game Card Row
 */
interface GameCardRowProps {
	label: string
	description?: string
	children: ReactNode
	icon?: LucideIcon
	className?: string
}

export function GameCardRow({
	label,
	description,
	children,
	icon: Icon,
	className,
}: GameCardRowProps) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between',
				'border-b border-border/40 last:border-0',
				className,
			)}
		>
			<div className="flex items-center gap-3">
				{Icon && (
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Icon className="h-4 w-4 text-muted-foreground" />
					</div>
				)}
				<div className="space-y-0.5">
					<p className="font-medium">{label}</p>
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
			</div>
			<div className="shrink-0 sm:ml-4">{children}</div>
		</div>
	)
}

/**
 * Status Badge for game cards
 */
interface StatusBadgeProps {
	status: 'active' | 'inactive' | 'warning' | 'premium'
	children: ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
	const statusStyles = {
		active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
		inactive: 'bg-muted text-muted-foreground border-border',
		warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
		premium:
			'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
	}

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
				statusStyles[status],
			)}
		>
			{status === 'active' && (
				<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
			)}
			{children}
		</span>
	)
}

'use client'

import { Button } from '@sylphx/ui'
import { Check, ChevronLeft, ChevronRight, Flame, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type DayStatus = 'played' | 'won' | 'lost' | 'missed' | 'future' | 'today'

type StreakCalendarProps = {
	// Map of date strings (YYYY-MM-DD) to status
	history: Record<string, { status: 'won' | 'lost'; games: number }>
	currentStreak: number
	locale: string
	className?: string
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Get the status of a day
 */
function getDayStatus(
	date: Date,
	today: Date,
	history: Record<string, { status: 'won' | 'lost'; games: number }>,
): DayStatus {
	const dateStr = date.toISOString().split('T')[0]
	const todayStr = today.toISOString().split('T')[0]

	if (dateStr === todayStr) return 'today'
	if (date > today) return 'future'

	const dayData = history[dateStr]
	if (!dayData) return 'missed'
	return dayData.status
}

/**
 * StreakCalendar - Visual calendar showing play history
 *
 * Features:
 * - Month navigation
 * - Color-coded days (won, lost, missed, future)
 * - Current streak indicator
 * - Today highlight
 */
export function StreakCalendar({ history, currentStreak, locale, className }: StreakCalendarProps) {
	const t = useTranslations('calendar')
	const tStreak = useTranslations('streak')

	const [currentMonth, setCurrentMonth] = useState(() => {
		const now = new Date()
		return new Date(now.getFullYear(), now.getMonth(), 1)
	})

	const today = new Date()
	today.setHours(0, 0, 0, 0)

	// Get days in month
	const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()

	// Get first day of month (0 = Sunday)
	const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

	// Generate calendar grid
	const calendarDays: (Date | null)[] = []

	// Add empty cells for days before the 1st
	for (let i = 0; i < firstDayOfMonth; i++) {
		calendarDays.push(null)
	}

	// Add days of the month
	for (let day = 1; day <= daysInMonth; day++) {
		calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
	}

	// Navigation
	const goToPrevMonth = () => {
		setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
	}

	const goToNextMonth = () => {
		setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
	}

	const canGoNext =
		currentMonth.getMonth() < today.getMonth() || currentMonth.getFullYear() < today.getFullYear()

	// Format month name
	const monthName = currentMonth.toLocaleDateString(locale, {
		month: 'long',
		year: 'numeric',
	})

	return (
		<div className={cn('rounded-xl border bg-card p-4', className)}>
			{/* Header with streak */}
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Flame className="h-5 w-5 text-orange-500" />
					<span className="font-semibold">
						{currentStreak} {tStreak('days')}
					</span>
				</div>
				<span className="text-sm text-muted-foreground">{tStreak('currentStreak')}</span>
			</div>

			{/* Month navigation */}
			<div className="mb-4 flex items-center justify-between">
				<Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
					<ChevronLeft className="h-4 w-4" />
					<span className="sr-only">{t('previousMonth')}</span>
				</Button>
				<span className="font-medium">{monthName}</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={goToNextMonth}
					disabled={!canGoNext}
					className="h-8 w-8"
				>
					<ChevronRight className="h-4 w-4" />
					<span className="sr-only">{t('nextMonth')}</span>
				</Button>
			</div>

			{/* Weekday headers */}
			<div className="mb-2 grid grid-cols-7 gap-1">
				{WEEKDAYS.map((day, i) => (
					<div key={i} className="text-center text-xs font-medium text-muted-foreground">
						{day}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div className="grid grid-cols-7 gap-1">
				{calendarDays.map((date, i) => {
					if (!date) {
						return <div key={`empty-${i}`} className="aspect-square" />
					}

					const status = getDayStatus(date, today, history)
					const dayNum = date.getDate()

					return (
						<div
							key={date.toISOString()}
							className={cn(
								'flex aspect-square items-center justify-center rounded-lg text-sm',
								status === 'today' && 'ring-2 ring-primary',
								status === 'won' && 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
								status === 'lost' && 'bg-red-500/20 text-red-600 dark:text-red-400',
								status === 'missed' && 'bg-muted text-muted-foreground',
								status === 'future' && 'text-muted-foreground/50',
							)}
						>
							{status === 'won' ? (
								<Check className="h-4 w-4" />
							) : status === 'lost' ? (
								<X className="h-4 w-4" />
							) : (
								dayNum
							)}
						</div>
					)
				})}
			</div>

			{/* Legend */}
			<div className="mt-4 flex items-center justify-center gap-4 text-xs">
				<div className="flex items-center gap-1">
					<div className="h-3 w-3 rounded bg-emerald-500/20" />
					<span>{t('won')}</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="h-3 w-3 rounded bg-red-500/20" />
					<span>{t('played')}</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="h-3 w-3 rounded bg-muted" />
					<span>{t('missed')}</span>
				</div>
			</div>
		</div>
	)
}

'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type PlayStatus = 'won' | 'lost' | 'played' | 'missed' | 'future'

type PlayCalendarProps = {
	games: Array<{
		date: string // ISO date string (YYYY-MM-DD)
		status: PlayStatus
		gameType?: string
	}>
	onDateSelect?: (date: string) => void
	className?: string
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const statusColors: Record<PlayStatus, string> = {
	won: 'bg-green-500 text-white',
	lost: 'bg-red-500/80 text-white',
	played: 'bg-yellow-500 text-white',
	missed: 'bg-muted text-muted-foreground',
	future: 'bg-transparent text-muted-foreground/50',
}

const statusDots: Record<PlayStatus, string> = {
	won: 'bg-green-500',
	lost: 'bg-red-500',
	played: 'bg-yellow-500',
	missed: 'bg-muted-foreground/30',
	future: 'bg-transparent',
}

export function PlayCalendar({ games, onDateSelect, className }: PlayCalendarProps) {
	const t = useTranslations('calendar')
	const locale = useLocale()
	const [currentMonth, setCurrentMonth] = useState(() => new Date())

	const year = currentMonth.getFullYear()
	const month = currentMonth.getMonth()

	// Get the game status map for quick lookup
	const gameStatusMap = new Map(games.map((g) => [g.date, g.status]))

	// Get calendar days
	const firstDayOfMonth = new Date(year, month, 1)
	const lastDayOfMonth = new Date(year, month + 1, 0)
	const daysInMonth = lastDayOfMonth.getDate()
	const startingDayOfWeek = firstDayOfMonth.getDay()

	// Generate calendar grid
	const calendarDays: Array<{
		date: number | null
		dateStr: string
		status: PlayStatus
		isToday: boolean
	}> = []

	// Empty cells before first day
	for (let i = 0; i < startingDayOfWeek; i++) {
		calendarDays.push({ date: null, dateStr: '', status: 'future', isToday: false })
	}

	const today = new Date()
	const todayStr = formatDateStr(today)

	// Days of the month
	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		const currentDate = new Date(year, month, day)
		const isToday = dateStr === todayStr
		const isFuture = currentDate > today

		let status: PlayStatus = isFuture ? 'future' : 'missed'
		if (gameStatusMap.has(dateStr)) {
			status = gameStatusMap.get(dateStr)!
		}

		calendarDays.push({ date: day, dateStr, status, isToday })
	}

	// Fill remaining cells to complete the grid
	const remainingCells = 7 - (calendarDays.length % 7)
	if (remainingCells < 7) {
		for (let i = 0; i < remainingCells; i++) {
			calendarDays.push({ date: null, dateStr: '', status: 'future', isToday: false })
		}
	}

	const goToPreviousMonth = () => {
		setCurrentMonth(new Date(year, month - 1, 1))
	}

	const goToNextMonth = () => {
		setCurrentMonth(new Date(year, month + 1, 1))
	}

	const monthName = currentMonth.toLocaleString(locale, { month: 'long', year: 'numeric' })

	return (
		<div className={cn('rounded-xl border bg-card p-4', className)}>
			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
				<button
					type="button"
					onClick={goToPreviousMonth}
					className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label={t('previousMonth')}
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<h3 className="font-semibold">{monthName}</h3>
				<button
					type="button"
					onClick={goToNextMonth}
					className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label={t('nextMonth')}
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>

			{/* Day headers */}
			<div className="mb-2 grid grid-cols-7 gap-1">
				{DAYS_OF_WEEK.map((day, i) => (
					<div key={i} className="text-center text-xs font-medium text-muted-foreground">
						{day}
					</div>
				))}
			</div>

			{/* Calendar grid */}
			<div className="grid grid-cols-7 gap-1">
				{calendarDays.map(({ date, dateStr, status, isToday }, i) => (
					<button
						type="button"
						key={i}
						onClick={() => date && onDateSelect?.(dateStr)}
						disabled={!date || status === 'future'}
						className={cn(
							'flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors',
							date && status !== 'future' && 'hover:ring-2 hover:ring-primary/50',
							isToday && 'ring-2 ring-primary',
							!date && 'cursor-default',
						)}
					>
						{date && (
							<span
								className={cn(
									'flex h-7 w-7 items-center justify-center rounded-full',
									status !== 'missed' && status !== 'future' && statusColors[status],
								)}
							>
								{date}
							</span>
						)}
					</button>
				))}
			</div>

			{/* Legend */}
			<div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
				<div className="flex items-center gap-1.5">
					<span className={cn('h-2.5 w-2.5 rounded-full', statusDots.won)} />
					<span className="text-muted-foreground">{t('won')}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className={cn('h-2.5 w-2.5 rounded-full', statusDots.played)} />
					<span className="text-muted-foreground">{t('played')}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className={cn('h-2.5 w-2.5 rounded-full', statusDots.missed)} />
					<span className="text-muted-foreground">{t('missed')}</span>
				</div>
			</div>
		</div>
	)
}

function formatDateStr(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Compact mini calendar for dashboard
export function MiniPlayCalendar({
	games,
	className,
}: {
	games: Array<{ date: string; status: PlayStatus }>
	className?: string
}) {
	// Show last 7 days
	const today = new Date()
	const last7Days = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(today)
		date.setDate(date.getDate() - (6 - i))
		return formatDateStr(date)
	})

	const gameStatusMap = new Map(games.map((g) => [g.date, g.status]))

	return (
		<div className={cn('flex items-center gap-1', className)}>
			{last7Days.map((dateStr, _i) => {
				const status = gameStatusMap.get(dateStr) || 'missed'
				const isToday = dateStr === formatDateStr(today)

				return (
					<div
						key={dateStr}
						className={cn(
							'h-3 w-3 rounded-sm transition-all',
							statusDots[status],
							isToday && 'ring-1 ring-primary',
						)}
						title={dateStr}
					/>
				)
			})}
		</div>
	)
}

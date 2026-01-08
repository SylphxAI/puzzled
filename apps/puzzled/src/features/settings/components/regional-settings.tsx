'use client'

import { Calendar, Check, ChevronDown, Clock, Globe2, Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Icon, Input, Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui'
import { useToast } from '@/shared/components/ui/toast'
import { trpc } from '@/trpc/client'

// Timezone data with regions for grouping
const TIMEZONE_REGIONS = [
	{
		label: 'Americas',
		icon: 'emojione:globe-showing-americas',
		timezones: [
			{ value: 'America/New_York', label: 'New York', offset: 'EST/EDT' },
			{ value: 'America/Chicago', label: 'Chicago', offset: 'CST/CDT' },
			{ value: 'America/Denver', label: 'Denver', offset: 'MST/MDT' },
			{ value: 'America/Los_Angeles', label: 'Los Angeles', offset: 'PST/PDT' },
			{ value: 'America/Anchorage', label: 'Anchorage', offset: 'AKST' },
			{ value: 'Pacific/Honolulu', label: 'Honolulu', offset: 'HST' },
			{ value: 'America/Toronto', label: 'Toronto', offset: 'EST/EDT' },
			{ value: 'America/Vancouver', label: 'Vancouver', offset: 'PST/PDT' },
			{ value: 'America/Mexico_City', label: 'Mexico City', offset: 'CST' },
			{ value: 'America/Sao_Paulo', label: 'São Paulo', offset: 'BRT' },
			{ value: 'America/Buenos_Aires', label: 'Buenos Aires', offset: 'ART' },
		],
	},
	{
		label: 'Europe & Africa',
		icon: 'emojione:globe-showing-europe-africa',
		timezones: [
			{ value: 'UTC', label: 'UTC', offset: 'UTC+0' },
			{ value: 'Europe/London', label: 'London', offset: 'GMT/BST' },
			{ value: 'Europe/Paris', label: 'Paris', offset: 'CET/CEST' },
			{ value: 'Europe/Berlin', label: 'Berlin', offset: 'CET/CEST' },
			{ value: 'Europe/Madrid', label: 'Madrid', offset: 'CET/CEST' },
			{ value: 'Europe/Rome', label: 'Rome', offset: 'CET/CEST' },
			{ value: 'Europe/Amsterdam', label: 'Amsterdam', offset: 'CET/CEST' },
			{ value: 'Europe/Moscow', label: 'Moscow', offset: 'MSK' },
			{ value: 'Europe/Istanbul', label: 'Istanbul', offset: 'TRT' },
		],
	},
	{
		label: 'Asia & Pacific',
		icon: 'emojione:globe-showing-asia-australia',
		timezones: [
			{ value: 'Asia/Dubai', label: 'Dubai', offset: 'GST' },
			{ value: 'Asia/Kolkata', label: 'Mumbai', offset: 'IST' },
			{ value: 'Asia/Bangkok', label: 'Bangkok', offset: 'ICT' },
			{ value: 'Asia/Singapore', label: 'Singapore', offset: 'SGT' },
			{ value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: 'HKT' },
			{ value: 'Asia/Shanghai', label: 'Shanghai', offset: 'CST' },
			{ value: 'Asia/Tokyo', label: 'Tokyo', offset: 'JST' },
			{ value: 'Asia/Seoul', label: 'Seoul', offset: 'KST' },
			{ value: 'Australia/Sydney', label: 'Sydney', offset: 'AEST/AEDT' },
			{ value: 'Australia/Melbourne', label: 'Melbourne', offset: 'AEST/AEDT' },
			{ value: 'Australia/Perth', label: 'Perth', offset: 'AWST' },
			{ value: 'Pacific/Auckland', label: 'Auckland', offset: 'NZST/NZDT' },
		],
	},
]

// Flatten for lookup
const ALL_TIMEZONES = TIMEZONE_REGIONS.flatMap((r) => r.timezones)

// Date format options with examples
const DATE_FORMATS = [
	{ value: 'relative', labelKey: 'relative', example: '2 days ago' },
	{ value: 'absolute', labelKey: 'absolute', example: 'Jan 4, 2026' },
	{ value: 'iso', labelKey: 'iso', example: '2026-01-04' },
] as const

type RegionalSettingsProps = {
	initialTimezone: string | null
	initialDateFormat: string | null
}

export function RegionalSettings({ initialTimezone, initialDateFormat }: RegionalSettingsProps) {
	const t = useTranslations('settings')
	const tCommon = useTranslations('common')
	const toast = useToast()

	const [timezone, setTimezone] = useState(initialTimezone ?? 'UTC')
	const [dateFormat, setDateFormat] = useState(initialDateFormat ?? 'relative')
	const [timezoneOpen, setTimezoneOpen] = useState(false)
	const [dateFormatOpen, setDateFormatOpen] = useState(false)
	const [timezoneSearch, setTimezoneSearch] = useState('')
	const [isPending, startTransition] = useTransition()

	// Track previous values for rollback on error
	const [previousValues, setPreviousValues] = useState<{
		timezone?: string
		dateFormat?: string
	}>({})

	const utils = trpc.useUtils()

	const updatePreferences = trpc.user.updatePreferences.useMutation({
		onError: (err) => {
			toast.error(tCommon('error'), err.message)
			// Rollback to previous values on error
			if (previousValues.timezone !== undefined) {
				setTimezone(previousValues.timezone)
			}
			if (previousValues.dateFormat !== undefined) {
				setDateFormat(previousValues.dateFormat)
			}
			setPreviousValues({})
		},
		onSuccess: () => {
			toast.success(t('preferences.saved'))
			setPreviousValues({})
			// Invalidate user profile cache to sync with other components
			utils.user.getProfile.invalidate()
		},
	})

	const handleTimezoneChange = useCallback(
		(value: string) => {
			// Store previous value for rollback
			setPreviousValues((prev) => ({ ...prev, timezone }))
			setTimezone(value)
			setTimezoneOpen(false)
			setTimezoneSearch('')
			startTransition(() => {
				updatePreferences.mutate({ timezone: value })
			})
		},
		[timezone, updatePreferences],
	)

	const handleDateFormatChange = useCallback(
		(value: string) => {
			// Store previous value for rollback
			setPreviousValues((prev) => ({ ...prev, dateFormat }))
			setDateFormat(value)
			setDateFormatOpen(false)
			startTransition(() => {
				updatePreferences.mutate({ dateFormat: value as 'relative' | 'absolute' | 'iso' })
			})
		},
		[dateFormat, updatePreferences],
	)

	// Filter timezones based on search
	const filteredRegions = useMemo(() => {
		if (!timezoneSearch.trim()) return TIMEZONE_REGIONS
		const search = timezoneSearch.toLowerCase()
		return TIMEZONE_REGIONS.map((region) => ({
			...region,
			timezones: region.timezones.filter(
				(tz) =>
					tz.label.toLowerCase().includes(search) ||
					tz.value.toLowerCase().includes(search) ||
					tz.offset.toLowerCase().includes(search),
			),
		})).filter((region) => region.timezones.length > 0)
	}, [timezoneSearch])

	// Handle timezone not in list gracefully
	const currentTimezone = ALL_TIMEZONES.find((tz) => tz.value === timezone)
	const timezoneDisplay = currentTimezone?.label ?? timezone.split('/').pop() ?? 'UTC'
	const timezoneOffset = currentTimezone?.offset ?? ''

	const currentDateFormat = DATE_FORMATS.find((df) => df.value === dateFormat)

	return (
		<div className="space-y-4">
			{/* Timezone Selector */}
			<div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Globe2 className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="space-y-0.5">
						<p className="font-medium">{t('preferences.language.timezone')}</p>
						<p className="text-sm text-muted-foreground">
							{t('preferences.language.timezoneDescription')}
						</p>
					</div>
				</div>

				<Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							role="combobox"
							aria-expanded={timezoneOpen}
							aria-label={t('preferences.language.timezone')}
							disabled={isPending}
							title={timezone}
							className={cn(
								'group flex h-11 w-full items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 text-left transition-all duration-200 sm:w-auto sm:min-w-[200px]',
								'hover:border-primary/40 hover:bg-muted/50',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
								'disabled:pointer-events-none disabled:opacity-60',
								timezoneOpen && 'border-primary/40 bg-muted/50 ring-2 ring-primary/20',
							)}
						>
							{isPending ? (
								<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
							) : (
								<Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
							)}
							<span className="flex-1 truncate text-sm font-medium">{timezoneDisplay}</span>
							{timezoneOffset && (
								<span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{timezoneOffset}
								</span>
							)}
							<ChevronDown
								className={cn(
									'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
									timezoneOpen && 'rotate-180 text-primary',
								)}
							/>
						</button>
					</PopoverTrigger>

					<PopoverContent
						align="end"
						sideOffset={8}
						className={cn(
							'w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/50 p-0 shadow-xl shadow-black/10',
							'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
						)}
					>
						{/* Header with Search */}
						<div className="border-b border-border/50 bg-muted/30 p-3">
							<div className="flex items-center gap-3 pb-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
									<Globe2 className="h-4 w-4 text-primary" />
								</div>
								<div>
									<p className="text-sm font-semibold">
										{t('preferences.language.selectTimezone')}
									</p>
									<p className="text-xs text-muted-foreground">
										{ALL_TIMEZONES.length} {tCommon('optionsAvailable')}
									</p>
								</div>
							</div>
							{/* Search input */}
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="text"
									placeholder={t('preferences.language.searchTimezone')}
									value={timezoneSearch}
									onChange={(e) => setTimezoneSearch(e.target.value)}
									className="h-9 pl-9 text-sm"
								/>
							</div>
						</div>

						{/* Grouped timezone list */}
						<div
							role="listbox"
							aria-label={t('preferences.language.timezone')}
							className="max-h-[320px] overflow-y-auto overscroll-contain"
						>
							{filteredRegions.length === 0 ? (
								<div className="py-8 text-center text-sm text-muted-foreground">
									{t('preferences.language.noTimezoneFound')}
								</div>
							) : (
								filteredRegions.map((region) => (
									<div key={region.label}>
										{/* Region header */}
										<div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/30 bg-muted/50 px-4 py-2 backdrop-blur-sm">
											<Icon icon={region.icon} aria-hidden="true" className="h-4 w-4" />
											<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
												{region.label}
											</span>
										</div>

										{/* Timezone options */}
										<div className="p-1.5">
											{region.timezones.map((tz) => {
												const isSelected = timezone === tz.value
												return (
													<button
														key={tz.value}
														type="button"
														role="option"
														aria-selected={isSelected}
														onClick={() => handleTimezoneChange(tz.value)}
														className={cn(
															'group/item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150',
															'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
															isSelected && 'bg-primary/5',
														)}
													>
														<span
															className={cn(
																'flex-1 text-sm transition-colors duration-150',
																isSelected ? 'font-semibold text-primary' : 'font-medium',
															)}
														>
															{tz.label}
														</span>
														<span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-xs text-muted-foreground">
															{tz.offset}
														</span>
														<span
															className={cn(
																'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
																isSelected
																	? 'scale-100 bg-primary text-primary-foreground'
																	: 'scale-75 bg-transparent opacity-0 group-hover/item:scale-100 group-hover/item:bg-muted-foreground/10 group-hover/item:opacity-100',
															)}
														>
															<Check className="h-3 w-3" strokeWidth={3} />
														</span>
													</button>
												)
											})}
										</div>
									</div>
								))
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Date Format Selector */}
			<div className="flex flex-col gap-3 border-t border-border/40 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Calendar className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="space-y-0.5">
						<p className="font-medium">{t('preferences.language.dateFormat')}</p>
						<p className="text-sm text-muted-foreground">
							{t('preferences.language.dateFormatDescription')}
						</p>
					</div>
				</div>

				<Popover open={dateFormatOpen} onOpenChange={setDateFormatOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							role="combobox"
							aria-expanded={dateFormatOpen}
							aria-label={t('preferences.language.dateFormat')}
							disabled={isPending}
							className={cn(
								'group flex h-11 w-full items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 text-left transition-all duration-200 sm:w-auto sm:min-w-[180px]',
								'hover:border-primary/40 hover:bg-muted/50',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
								'disabled:pointer-events-none disabled:opacity-60',
								dateFormatOpen && 'border-primary/40 bg-muted/50 ring-2 ring-primary/20',
							)}
						>
							{isPending ? (
								<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
							) : null}
							<span className="flex-1 truncate text-sm font-medium">
								{currentDateFormat?.example ?? 'Relative'}
							</span>
							<ChevronDown
								className={cn(
									'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
									dateFormatOpen && 'rotate-180 text-primary',
								)}
							/>
						</button>
					</PopoverTrigger>

					<PopoverContent
						align="end"
						sideOffset={8}
						className={cn(
							'w-[min(260px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/50 p-0 shadow-xl shadow-black/10',
							'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
						)}
					>
						{/* Header */}
						<div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
								<Calendar className="h-4 w-4 text-primary" />
							</div>
							<div>
								<p className="text-sm font-semibold">{t('preferences.language.dateFormat')}</p>
								<p className="text-xs text-muted-foreground">
									{t('preferences.language.dateFormatHint')}
								</p>
							</div>
						</div>

						{/* Date format options */}
						<div role="listbox" aria-label={t('preferences.language.dateFormat')} className="p-2">
							{DATE_FORMATS.map((format) => {
								const isSelected = dateFormat === format.value
								return (
									<button
										key={format.value}
										type="button"
										role="option"
										aria-selected={isSelected}
										onClick={() => handleDateFormatChange(format.value)}
										className={cn(
											'group/item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-150',
											'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
											isSelected && 'bg-primary/5',
										)}
									>
										<div className="flex-1">
											<p
												className={cn(
													'text-sm transition-colors duration-150',
													isSelected ? 'font-semibold text-primary' : 'font-medium',
												)}
											>
												{t(`preferences.language.dateFormats.${format.labelKey}`)}
											</p>
											<p className="mt-0.5 text-xs text-muted-foreground">e.g. {format.example}</p>
										</div>
										<span
											className={cn(
												'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
												isSelected
													? 'scale-100 bg-primary text-primary-foreground'
													: 'scale-75 bg-transparent opacity-0 group-hover/item:scale-100 group-hover/item:bg-muted-foreground/10 group-hover/item:opacity-100',
											)}
										>
											<Check className="h-3 w-3" strokeWidth={3} />
										</span>
									</button>
								)
							})}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	)
}

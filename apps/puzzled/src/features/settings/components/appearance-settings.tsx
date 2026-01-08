'use client'

import { Eye, Minimize2, Palette } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { ThemeToggle } from '@/shared/components/theme'
import { Switch } from '@/shared/components/ui'
import { useToast } from '@/shared/components/ui/toast'
import { trpc } from '@/trpc/client'

type AppearanceSettingsProps = {
	initialReduceMotion?: boolean
	initialCompactMode?: boolean
}

export function AppearanceSettings({
	initialReduceMotion = false,
	initialCompactMode = false,
}: AppearanceSettingsProps) {
	const t = useTranslations('settings')
	const tCommon = useTranslations('common')
	const toast = useToast()
	const [reduceMotion, setReduceMotion] = useState(initialReduceMotion)
	const [compactMode, setCompactMode] = useState(initialCompactMode)
	const [mounted, setMounted] = useState(false)
	const [isPending, startTransition] = useTransition()
	const [error, setError] = useState<string | null>(null)

	// Track previous values for rollback on error
	const [previousValues, setPreviousValues] = useState<{
		reduceMotion?: boolean
		compactMode?: boolean
	}>({})

	const utils = trpc.useUtils()

	const updatePreferences = trpc.user.updatePreferences.useMutation({
		onError: (err) => {
			setError(err.message)
			toast.error(tCommon('error'), err.message)
			// Rollback to previous values on error
			if (previousValues.reduceMotion !== undefined) {
				setReduceMotion(previousValues.reduceMotion)
				localStorage.setItem('reduceMotion', String(previousValues.reduceMotion))
				applyReduceMotion(previousValues.reduceMotion)
			}
			if (previousValues.compactMode !== undefined) {
				setCompactMode(previousValues.compactMode)
				localStorage.setItem('compactMode', String(previousValues.compactMode))
				applyCompactMode(previousValues.compactMode)
			}
			setPreviousValues({})
		},
		onSuccess: () => {
			setError(null)
			toast.success(t('preferences.saved'))
			setPreviousValues({})
			// Invalidate user profile cache to sync with other components
			utils.user.getProfile.invalidate()
		},
	})

	// Apply preferences on mount and sync localStorage for instant UI updates
	// biome-ignore lint/correctness/useExhaustiveDependencies: applyReduceMotion/applyCompactMode are stable
	useEffect(() => {
		setMounted(true)
		// Apply initial values from database
		applyReduceMotion(initialReduceMotion)
		applyCompactMode(initialCompactMode)
		// Also update localStorage to keep it in sync
		localStorage.setItem('reduceMotion', String(initialReduceMotion))
		localStorage.setItem('compactMode', String(initialCompactMode))
	}, [initialReduceMotion, initialCompactMode])

	const applyReduceMotion = (enabled: boolean) => {
		if (enabled) {
			document.documentElement.classList.add('reduce-motion')
		} else {
			document.documentElement.classList.remove('reduce-motion')
		}
	}

	const applyCompactMode = (enabled: boolean) => {
		if (enabled) {
			document.documentElement.classList.add('compact-mode')
		} else {
			document.documentElement.classList.remove('compact-mode')
		}
	}

	const handleReduceMotionChange = (checked: boolean) => {
		// Store previous value for rollback on error
		setPreviousValues((prev) => ({ ...prev, reduceMotion }))
		setReduceMotion(checked)
		// Update localStorage for instant UI updates across the app
		localStorage.setItem('reduceMotion', String(checked))
		applyReduceMotion(checked)
		// Sync to database
		setError(null)
		startTransition(() => {
			updatePreferences.mutate({ reduceMotion: checked })
		})
	}

	const handleCompactModeChange = (checked: boolean) => {
		// Store previous value for rollback on error
		setPreviousValues((prev) => ({ ...prev, compactMode }))
		setCompactMode(checked)
		// Update localStorage for instant UI updates across the app
		localStorage.setItem('compactMode', String(checked))
		applyCompactMode(checked)
		// Sync to database
		setError(null)
		startTransition(() => {
			updatePreferences.mutate({ compactMode: checked })
		})
	}

	if (!mounted) {
		return null
	}

	return (
		<div className="space-y-4">
			{/* Theme */}
			<div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Palette className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="space-y-0.5">
						<p className="font-medium">{t('theme')}</p>
						<p className="text-sm text-muted-foreground">{t('themeDescription')}</p>
					</div>
				</div>
				<ThemeToggle />
			</div>

			{/* Reduce Motion */}
			<div className="flex flex-col gap-3 border-t border-border/40 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Eye className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="space-y-0.5">
						<p className="font-medium">{t('reduceMotion')}</p>
						<p className="text-sm text-muted-foreground">{t('reduceMotionDescription')}</p>
					</div>
				</div>
				<Switch
					checked={reduceMotion}
					onCheckedChange={handleReduceMotionChange}
					disabled={isPending}
					aria-label={t('reduceMotion')}
				/>
			</div>

			{/* Compact Mode */}
			<div className="flex flex-col gap-3 border-t border-border/40 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
						<Minimize2 className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="space-y-0.5">
						<p className="font-medium">{t('compactMode')}</p>
						<p className="text-sm text-muted-foreground">{t('compactModeDescription')}</p>
					</div>
				</div>
				<Switch
					checked={compactMode}
					onCheckedChange={handleCompactModeChange}
					disabled={isPending}
					aria-label={t('compactMode')}
				/>
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	)
}

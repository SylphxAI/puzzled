'use client'

import { useState, useEffect } from 'react'
import { PushPrompt } from '@sylphx/sdk/react'
import { usePuzzledPush } from '../hooks/use-puzzled-push'

interface DailyReminderPromptProps {
	/** Delay before showing (ms) */
	showDelay?: number
	/** Show after user wins a game */
	showAfterWin?: boolean
	/** Custom title */
	title?: string
	/** Custom description */
	description?: string
	/** Callback when enabled */
	onEnabled?: () => void
	/** Callback when dismissed */
	onDismissed?: () => void
}

/**
 * Daily puzzle reminder prompt
 *
 * Encourages users to enable push notifications for daily puzzle reminders.
 * Shows as a card/banner after user completes a game or after a delay.
 *
 * @example
 * ```tsx
 * // Show after 5 seconds
 * <DailyReminderPrompt showDelay={5000} />
 *
 * // Show after winning a game
 * <DailyReminderPrompt showAfterWin />
 * ```
 */
export function DailyReminderPrompt({
	showDelay = 5000,
	showAfterWin = false,
	title = 'Never miss a puzzle!',
	description = "Get notified when the daily puzzle is ready. Keep your streak going strong! 🔥",
	onEnabled,
	onDismissed,
}: DailyReminderPromptProps) {
	const { isSupported, isEnabled } = usePuzzledPush()
	const [shouldRender, setShouldRender] = useState(false)
	const [dismissed, setDismissed] = useState(false)

	// Check if user has already dismissed this prompt
	useEffect(() => {
		const hasDismissed = localStorage.getItem('puzzled_push_prompt_dismissed')
		if (hasDismissed) {
			setDismissed(true)
		}
	}, [])

	// Don't show if not supported, already enabled, or dismissed
	if (!isSupported || isEnabled || dismissed) {
		return null
	}

	// If showAfterWin, component controls visibility externally
	if (showAfterWin && !shouldRender) {
		return null
	}

	const handleDismissed = () => {
		localStorage.setItem('puzzled_push_prompt_dismissed', 'true')
		setDismissed(true)
		onDismissed?.()
	}

	const handleEnabled = () => {
		// Clear dismissed flag since they enabled
		localStorage.removeItem('puzzled_push_prompt_dismissed')
		onEnabled?.()
	}

	return (
		<PushPrompt
			variant="card"
			position="bottom"
			title={title}
			description={description}
			enableText="Enable Reminders"
			laterText="Maybe Later"
			onEnabled={handleEnabled}
			onDismissed={handleDismissed}
			autoShow={!showAfterWin}
			showDelay={showDelay}
		/>
	)
}

/**
 * Trigger function to show prompt after winning
 * Use with the showAfterWin prop
 */
export function useShowPromptAfterWin() {
	const [show, setShow] = useState(false)

	const trigger = () => {
		// Small delay to not interrupt the win celebration
		setTimeout(() => setShow(true), 2000)
	}

	const hide = () => setShow(false)

	return { show, trigger, hide }
}

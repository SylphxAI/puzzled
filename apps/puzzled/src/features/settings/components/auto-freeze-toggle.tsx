'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { requestAutoFreeze } from '@/lib/auto-freeze'
import { setAutoFreeze } from '@/lib/connect/gamification-client'

const HEADING_ID = 'auto-freeze-heading'
const DESCRIPTION_ID = 'auto-freeze-description'

type Props = {
	/** The state the server reported when the page rendered; null when it could not be read. */
	initialEnabled: boolean | null
	/** Injected in tests; defaults to the generated Connect client. */
	save?: (enabled: boolean) => Promise<boolean>
}

/**
 * Streak auto-freeze switch.
 *
 * The shown state only ever comes from the server: a click sends the opposite
 * value and the switch moves to what the server answers. If the call fails the
 * switch stays where it was and says the change was not saved.
 */
export function AutoFreezeToggle({ initialEnabled, save = setAutoFreeze }: Props) {
	const t = useTranslations('settings')
	const [enabled, setEnabled] = useState<boolean | null>(initialEnabled)
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)

	if (enabled === null) {
		return (
			<p role="alert" className="text-sm text-muted-foreground">
				{t('preferences.streakFreeze.unavailable')}
			</p>
		)
	}

	const onClick = async () => {
		if (pending) return
		setPending(true)
		setFailed(false)
		const outcome = await requestAutoFreeze(enabled, save)
		setEnabled(outcome.enabled)
		setFailed(outcome.failed)
		setPending(false)
	}

	return (
		<div>
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0">
					<p id={HEADING_ID} className="text-sm font-semibold">
						{t('streakFreeze.autoFreeze')}
					</p>
					<p id={DESCRIPTION_ID} className="text-xs leading-relaxed text-muted-foreground">
						{t('streakFreeze.autoFreezeDesc')}
					</p>
					<p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
						{enabled ? t('streakFreeze.autoFreezeEnabled') : t('streakFreeze.autoFreezeDisabled')}
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={enabled}
					aria-labelledby={HEADING_ID}
					aria-describedby={DESCRIPTION_ID}
					disabled={pending}
					onClick={onClick}
					className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
						enabled ? 'bg-primary' : 'bg-muted'
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							enabled ? 'translate-x-6' : 'translate-x-1'
						}`}
					/>
				</button>
			</div>
			{failed ? (
				<p role="alert" className="mt-3 text-sm text-destructive">
					{t('preferences.streakFreeze.saveFailed')}
				</p>
			) : null}
		</div>
	)
}

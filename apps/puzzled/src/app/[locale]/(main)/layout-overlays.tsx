'use client'

import { DeferredOverlays } from '@/shared/components/deferred-shell'

/**
 * Achievement toasts, the PWA install prompt and the consent banner.
 *
 * All three are off the first paint: they mount after load on an idle frame and
 * their modules are imported on demand (see `shared/components/deferred-shell`).
 * Consent still gates analytics from the send site, so nothing is reported
 * before an explicit opt-in.
 */
export function LayoutOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return <DeferredOverlays maxStreak={maxStreak} />
}

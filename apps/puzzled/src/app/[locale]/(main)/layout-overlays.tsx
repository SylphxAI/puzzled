'use client'

import { DeferredOverlays } from '@/shared/components/deferred-shell'

/**
 * Achievement toasts and the PWA install prompt.
 *
 * Both are off the first paint: they mount after load on an idle frame and
 * their modules are imported on demand (see `shared/components/deferred-shell`).
 * The consent banner is NOT part of this chunk - it is the largest paint on
 * mobile, so the (main) layout renders it in the first frame; consent still
 * gates analytics from the send site, so nothing is reported before an
 * explicit opt-in.
 */
export function LayoutOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return <DeferredOverlays maxStreak={maxStreak} />
}

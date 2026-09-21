'use client'

/**
 * Browser identity chrome - product and observability hooks (TD-11 split of react.tsx).
 *
 * Referral, analytics/consent, notifications, achievements, the global error
 * handler and session replay; each reads the contexts it needs and never
 * resolves a second entitlement copy.
 */

import { useCallback, useEffect, useState } from 'react'
import { DEST_CONSENT_PURPOSES } from '../dest'
import { useSafeUser } from './auth'
import { readJson } from './context'

/**
 * Referral figures the commerce authority actually returns.
 *
 * `GetReferralStats` answers with an active code and a redemption count, so
 * those are the only two numbers this hook can report. The former
 * `completedReferrals` / `pendingReferrals` pair was a copy of the redemption
 * count with a hard-coded zero, which read as live data on the settings page;
 * they are gone rather than faked.
 */
export type ReferralStats = {
	/** Redemptions the commerce authority reported, or null when unread. */
	redemptions: number | null
}

export function useReferral() {
	const { user } = useSafeUser()
	const [code, setCode] = useState<string | null>(null)
	// null means "the read did not report a count" — never rendered as a zero.
	const [stats, setStats] = useState<ReferralStats>({ redemptions: null })
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<{ message?: string } | null>(null)

	const applyStats = useCallback((body: Record<string, unknown>) => {
		const record =
			body.stats && typeof body.stats === 'object' ? (body.stats as Record<string, unknown>) : body
		const nextCode =
			(typeof record.active_code === 'string' && record.active_code.trim()) ||
			(typeof record.code === 'string' && record.code.trim()) ||
			null
		const redemptions = typeof record.redemption_count === 'number' ? record.redemption_count : null
		setCode(nextCode)
		setStats({ redemptions })
	}, [])

	useEffect(() => {
		if (!user) {
			setIsLoading(false)
			return
		}
		let cancelled = false
		fetch('/api/commerce/referrals', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				if (cancelled) return
				if (!response.ok) {
					setError({
						message: typeof body.error === 'string' ? body.error : 'commerce_referrals_failed',
					})
					setIsLoading(false)
					return
				}
				applyStats(body)
				setError(null)
				setIsLoading(false)
			})
			.catch((caught) => {
				if (cancelled) return
				setError({
					message: caught instanceof Error ? caught.message : 'commerce_referrals_failed',
				})
				setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [applyStats, user])

	const link = code ? `/signup?ref=${encodeURIComponent(code)}` : ''
	const copy = async (value: string) => {
		if (!value) return
		await navigator.clipboard.writeText(value)
	}
	return {
		code,
		stats,
		link,
		isLoading,
		error,
		copyCode: async () => copy(code ?? ''),
		copyLink: async () => copy(link),
		regenerateCode: async () => {
			const response = await fetch('/api/commerce/referrals', {
				method: 'POST',
				credentials: 'same-origin',
			})
			const body = await readJson(response)
			if (!response.ok) {
				setError({
					message: typeof body.error === 'string' ? body.error : 'commerce_referrals_failed',
				})
				return
			}
			const next = typeof body.code === 'string' ? body.code.trim() : ''
			if (next) setCode(next)
			setError(null)
		},
	}
}
export function useAnalytics() {
	return {
		track: async (event?: string, props?: Record<string, unknown>) => {
			if (!event?.trim()) return
			await fetch('/api/observability/analytics', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ event, properties: props }),
			})
		},
	}
}
export function useSafeAnalytics() {
	return useAnalytics()
}
export function useSafeConsent() {
	const [consent, setConsent] = useState<Record<string, boolean>>({})
	const [hasConsented, setHasConsented] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	useEffect(() => {
		const stored =
			typeof window === 'undefined' ? null : window.localStorage.getItem('puzzled-consent')
		if (stored) {
			try {
				setConsent(JSON.parse(stored) as Record<string, boolean>)
				setHasConsented(true)
			} catch {
				setConsent({})
			}
		}
		setIsLoading(false)
	}, [])
	return {
		consent,
		hasConsent: (kind?: string) => (kind ? consent[kind] === true : hasConsented),
		hasConsented,
		isLoading,
		isConfigured: true,
		setConsent: async (next: Record<string, boolean>) => {
			setConsent(next)
			setHasConsented(true)
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('puzzled-consent', JSON.stringify(next))
			}
			await Promise.all(
				DEST_CONSENT_PURPOSES.filter((purpose) => purpose !== 'necessary').map((purpose) =>
					fetch('/api/identity/consent', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({
							purpose,
							state: next[purpose] ? 'granted' : 'denied',
						}),
					}),
				),
			)
		},
	}
}
export function useNotifications() {
	const [permission, setPermission] = useState<NotificationPermission>(
		typeof Notification === 'undefined' ? 'denied' : Notification.permission,
	)
	const [deviceId, setDeviceId] = useState<string | null>(null)
	const [error, setError] = useState<{ message?: string } | null>(null)
	const [preferences, setPreferences] = useState<Record<string, unknown>>({})
	useEffect(() => {
		fetch('/api/events/inbox', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				setPreferences({ messages: body.messages ?? [] })
			})
			.catch(() => undefined)
	}, [])
	return {
		permission,
		isSupported: typeof Notification !== 'undefined',
		isSubscribed: Boolean(deviceId),
		subscribe: async () => {
			if (typeof Notification === 'undefined') return false
			const next = await Notification.requestPermission()
			setPermission(next)
			if (next !== 'granted') return false
			const registration = await navigator.serviceWorker?.ready.catch(() => undefined)
			const push = await registration?.pushManager
				.subscribe({ userVisibleOnly: true })
				.catch(() => undefined)
			const response = await fetch('/api/events/devices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					token: push?.endpoint ?? `web-push-${crypto.randomUUID()}`,
					p256dh: push ? arrayBufferToB64(push.getKey('p256dh')) : '',
					auth: push ? arrayBufferToB64(push.getKey('auth')) : '',
				}),
			})
			const body = await readJson(response)
			if (!response.ok) {
				setError({ message: typeof body.error === 'string' ? body.error : 'subscribe_failed' })
				return false
			}
			setDeviceId(typeof body.deviceId === 'string' ? body.deviceId : 'events-device')
			setError(null)
			return true
		},
		unsubscribe: async () => {
			if (!deviceId) return
			await fetch('/api/events/devices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ unregister: true, deviceId }),
			})
			setDeviceId(null)
		},
		error,
		preferences,
	}
}

function arrayBufferToB64(value: ArrayBuffer | null): string {
	if (!value) return ''
	return btoa(String.fromCharCode(...new Uint8Array(value)))
}
type DestAchievement = {
	unlocked: boolean
	achievementId: string
	achievement: { id: string }
}

function destUnlocks(raw: unknown): DestAchievement[] {
	if (!Array.isArray(raw)) return []
	return raw.flatMap((entry) => {
		if (!entry || typeof entry !== 'object') return []
		const record = entry as Record<string, unknown>
		const id =
			(typeof record.achievement_id === 'string' && record.achievement_id.trim()) ||
			(typeof record.achievement_code === 'string' && record.achievement_code.trim()) ||
			(typeof record.achievementId === 'string' && record.achievementId.trim()) ||
			''
		if (!id) return []
		return [{ unlocked: true, achievementId: id, achievement: { id } }]
	})
}

export function useSafeAchievements() {
	const { user } = useSafeUser()
	const [achievements, setAchievements] = useState<DestAchievement[]>([])
	const [recentUnlock, setRecentUnlock] = useState<{ achievement: { id: string } } | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		if (!user) {
			setAchievements([])
			setIsLoading(false)
			return
		}
		let cancelled = false
		fetch('/api/commerce/achievements', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				if (cancelled) return
				setAchievements(destUnlocks(body.unlocks))
				setIsLoading(false)
			})
			.catch(() => {
				if (!cancelled) setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [user])

	return {
		achievements,
		unlock: async (id?: string, _meta?: unknown) => {
			const activityKind = id?.trim()
			if (!activityKind) return
			const response = await fetch('/api/commerce/achievements', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ activityKind }),
			})
			const body = await readJson(response)
			if (!response.ok) return
			const next = destUnlocks(body.unlocks)
			if (next.length > 0) {
				setAchievements((current) => {
					const seen = new Set(current.map((item) => item.achievementId))
					return [...current, ...next.filter((item) => !seen.has(item.achievementId))]
				})
				setRecentUnlock({ achievement: { id: next[0]?.achievementId ?? activityKind } })
			}
		},
		recentUnlock,
		dismissRecentUnlock: () => setRecentUnlock(null),
		isLoading,
		isConfigured: true,
	}
}
export function useGlobalErrorHandler(opts?: {
	handleErrors?: boolean
	handleRejections?: boolean
	onCapture?: (eventId?: string) => void
}) {
	useEffect(() => {
		if (opts?.handleErrors === false && opts.handleRejections === false) return
		const capture = (message: string) => {
			void fetch('/api/observability/error-events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ message, service: 'puzzled-web' }),
			})
				.then(async (response) => {
					const body = await readJson(response)
					opts?.onCapture?.(typeof body.eventId === 'string' ? body.eventId : undefined)
				})
				.catch(() => undefined)
		}
		const onError = (event: ErrorEvent) => capture(event.message)
		const onRejection = (event: PromiseRejectionEvent) =>
			capture(event.reason instanceof Error ? event.reason.message : String(event.reason))
		if (opts?.handleErrors !== false) window.addEventListener('error', onError)
		if (opts?.handleRejections !== false) window.addEventListener('unhandledrejection', onRejection)
		return () => {
			window.removeEventListener('error', onError)
			window.removeEventListener('unhandledrejection', onRejection)
		}
	}, [opts])
}
export function useSessionReplay(opts?: {
	onError?: (error: { message: string }) => void
	autoStart?: boolean
	userId?: string
	[key: string]: unknown
}) {
	const [sessionId, setSessionId] = useState<string | null>(null)
	const [isRecording, setIsRecording] = useState(false)
	const start = useCallback(async () => {
		const nextId = sessionId ?? crypto.randomUUID()
		const response = await fetch('/api/observability/session-replays', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ sessionId: nextId, consent: true, masked: true }),
		})
		if (!response.ok) {
			opts?.onError?.({ message: 'observability_replay_failed' })
			return
		}
		setSessionId(nextId)
		setIsRecording(true)
	}, [opts, sessionId])
	const stop = useCallback(() => {
		setIsRecording(false)
	}, [])
	useEffect(() => {
		if (opts?.autoStart) void start()
	}, [opts?.autoStart, start])
	const mark = useCallback(
		async (kind: string, payload?: unknown) => {
			if (!sessionId) return
			await fetch('/api/observability/session-replays', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					sessionId,
					chunk: { sequence: Date.now(), payload: JSON.stringify({ kind, payload }) },
				}),
			}).catch((error) => {
				opts?.onError?.({
					message: error instanceof Error ? error.message : 'observability_replay_failed',
				})
			})
		},
		[opts, sessionId],
	)
	return {
		start,
		stop,
		sessionId,
		isRecording,
		markError: (...args: unknown[]) => void mark('error', args),
		markNavigation: (...args: unknown[]) => void mark('navigation', args),
		markConversion: (...args: unknown[]) => void mark('conversion', args),
	}
}

export type PrivacyMode = string
export type SessionReplayConfig = {
	sampling?: { rate?: number; alwaysRecordErrors?: boolean }
	privacyMode?: PrivacyMode
	maskSelectors?: string[]
	blockSelectors?: string[]
	autoStart?: boolean
	stopOnUnmount?: boolean
	uploadEndpoint?: string
	userId?: string
	enabled?: boolean
	errorCorrelation?: unknown
	rageClickDetection?: boolean
	deadClickDetection?: boolean
	networkCapture?: boolean
	consoleCapture?: boolean
	maxDuration?: number
	compress?: boolean
	batchSize?: number
	uploadInterval?: number
	onError?: (error: { message: string }) => void
}

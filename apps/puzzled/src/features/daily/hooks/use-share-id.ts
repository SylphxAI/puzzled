'use client'

import { useEffect } from 'react'
import { shareResult } from '@/lib/connect'
import { productDayKey } from '@/lib/product-day'

/**
 * The share id a link carries as `ref`, held in memory per module and day.
 *
 * A finished result screen creates it as soon as it shows (`useWarmShareId`),
 * so a share tap already holds the id and can call navigator.share inside the
 * tap, which iOS requires. The tap is counted afterwards (`countShareTap`),
 * never awaited. When no id is known (archive day, offline, api down) the tap
 * shares the plain module link: sharing never depends on the count.
 */
const known = new Map<string, string>()
const inflight = new Set<string>()

const keyOf = (gameSlug: string, day: string) => `${gameSlug}|${day}`

/** The id for this finish if the api has already issued it. */
export function knownShareId(gameSlug: string, puzzleDate?: string): string | undefined {
	return known.get(keyOf(gameSlug, puzzleDate ?? productDayKey()))
}

function request(gameSlug: string, day: string, tap: boolean): void {
	const key = keyOf(gameSlug, day)
	if (!tap && (known.has(key) || inflight.has(key))) return
	inflight.add(key)
	shareResult({ gameSlug, puzzleDate: day, tap })
		.then((id) => {
			if (id) known.set(key, id)
		})
		.catch(() => {})
		.finally(() => inflight.delete(key))
}

/** Count one share tap (and create the share if it does not exist yet). Fire and forget. */
export function countShareTap(gameSlug: string, puzzleDate?: string): void {
	request(gameSlug, puzzleDate ?? productDayKey(), true)
}

/** Create the share for a finished result when the screen shows. */
export function useWarmShareId(gameSlug: string, puzzleDate: string | undefined, enabled: boolean) {
	useEffect(() => {
		if (enabled) request(gameSlug, puzzleDate ?? productDayKey(), false)
	}, [gameSlug, puzzleDate, enabled])
}

/**
 * Game page resolution (presentation layer).
 *
 * A module page is only reachable through the registry: `resolveGamePage`
 * canonicalises inbound aliases and returns `null` for anything unregistered,
 * and `requireGamePage` turns that `null` into a real 404 during metadata
 * resolution, before any content is rendered.
 */

import { notFound } from 'next/navigation'
import { type GameMetadata, type GameSlug, getGameMetadata } from '@/games/registry'

export type ResolvedGamePage = {
	/** Canonical registry slug: inbound aliases resolve to their module. */
	slug: GameSlug
	metadata: GameMetadata
}

export function resolveGamePage(slug: string): ResolvedGamePage | null {
	const metadata = getGameMetadata(slug)
	if (!metadata) return null
	// The registry maps the canonical slug to this config, so the config's own
	// slug is the registered key.
	return { slug: metadata.slug as GameSlug, metadata }
}

export function requireGamePage(slug: string): ResolvedGamePage {
	const resolved = resolveGamePage(slug)
	if (!resolved) notFound()
	return resolved
}

export type GameFaqItem = {
	question: string
	answer: string
}

/**
 * Per-module FAQ copy. Malformed or blank entries are dropped rather than
 * rendered as an empty question, so a copy mistake can never ship a hollow
 * heading into the FAQPage structured data.
 */
export function parseGameFaq(raw: unknown): GameFaqItem[] {
	if (!Array.isArray(raw)) return []
	return raw.flatMap((entry) => {
		if (!entry || typeof entry !== 'object') return []
		const { question, answer } = entry as { question?: unknown; answer?: unknown }
		if (typeof question !== 'string' || typeof answer !== 'string') return []
		const trimmedQuestion = question.trim()
		const trimmedAnswer = answer.trim()
		if (!trimmedQuestion || !trimmedAnswer) return []
		return [{ question: trimmedQuestion, answer: trimmedAnswer }]
	})
}

/** Per-module strategy tips; blank entries are dropped. */
export function parseGameTips(raw: unknown): string[] {
	if (!Array.isArray(raw)) return []
	return raw.flatMap((entry) => {
		if (typeof entry !== 'string') return []
		const tip = entry.trim()
		return tip ? [tip] : []
	})
}

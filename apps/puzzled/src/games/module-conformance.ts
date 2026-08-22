/**
 * Shared module conformance oracle (PZL-110).
 *
 * A customer-facing slug is reachable only when every protocol surface is
 * present. Server validator / canonical record / re-entry are proven in
 * puzzled-core; this module evaluates presentation evidence and the gate.
 */

import { formatRitualShareText, shareTextLooksNonSpoiler } from '@/features/daily/lib/share-text'
import { canonicalizeGameSlug } from '@/lib/game-slug'
import { hasPlayableInteraction } from './interaction-slugs'
import { getGameConfig, getGameMetadata, isValidGameSlug } from './registry'

export const MODULE_SURFACES = [
	'metadata',
	'content_source',
	'interaction',
	'terminal_contract',
	'server_validator',
	'canonical_record',
	'reentry',
	'non_spoiler_result',
] as const

export type ModuleSurface = (typeof MODULE_SURFACES)[number]

export type ModuleSurfaceEvidence = Record<ModuleSurface, boolean>

export function missingModuleSurfaces(evidence: ModuleSurfaceEvidence): ModuleSurface[] {
	return MODULE_SURFACES.filter((surface) => !evidence[surface])
}

export function isProtocolComplete(evidence: ModuleSurfaceEvidence): boolean {
	return missingModuleSurfaces(evidence).length === 0
}

/** Registered + protocol-complete. Unknown slugs fail even with complete-looking evidence. */
export function isCustomerReachable(slug: string, evidence: ModuleSurfaceEvidence): boolean {
	return isValidGameSlug(slug) && isProtocolComplete(evidence)
}

export type ConformanceFailure = {
	slug: string
	missing: ModuleSurface[]
}

export function catalogAdmissionFailures(
	customerSlugs: readonly string[],
	evidenceFor: (slug: string) => ModuleSurfaceEvidence,
): ConformanceFailure[] {
	const failures: ConformanceFailure[] = []
	for (const slug of customerSlugs) {
		const evidence = evidenceFor(slug)
		if (isCustomerReachable(slug, evidence)) continue
		const missing = missingModuleSurfaces(evidence)
		if (!isValidGameSlug(slug) && !missing.includes('metadata')) {
			missing.unshift('metadata')
		}
		failures.push({ slug, missing })
	}
	return failures
}

function nonSpoilerResultMaps(slug: string): boolean {
	const canonical = canonicalizeGameSlug(slug)
	const name = getGameMetadata(canonical)?.name ?? canonical
	const text = formatRitualShareText({
		origin: 'https://puzzled.gg',
		gameSlug: canonical,
		gameName: name,
		puzzleDate: '2026-08-22',
		status: 'won',
		attempts: 1,
	})
	return (
		shareTextLooksNonSpoiler(text) &&
		text.includes(`/games/${canonical}?date=2026-08-22`) &&
		!/solution|answer is|the word was/i.test(text)
	)
}

/**
 * Presentation + catalog evidence. `serverValidator` is the puzzled-core
 * catalog/validator pin supplied by the test (not a second validator).
 */
export function collectClientModuleEvidence(
	slug: string,
	serverValidator: boolean,
): ModuleSurfaceEvidence {
	const config = getGameConfig(slug)
	const metadata = getGameMetadata(slug)
	const registered = isValidGameSlug(slug)
	return {
		metadata: Boolean(metadata?.slug && metadata.name && metadata.description),
		content_source: typeof config?.generatePuzzle === 'function',
		interaction: hasPlayableInteraction(slug),
		terminal_contract: typeof config?.validateAndScore === 'function',
		server_validator: serverValidator,
		canonical_record: registered,
		reentry: registered,
		non_spoiler_result: nonSpoilerResultMaps(slug),
	}
}

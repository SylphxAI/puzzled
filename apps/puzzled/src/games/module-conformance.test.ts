import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hasPlayableInteraction, INTERACTION_SLUGS } from './interaction-slugs'
import {
	catalogAdmissionFailures,
	collectClientModuleEvidence,
	isCustomerReachable,
	isProtocolComplete,
	MODULE_SURFACES,
	type ModuleSurfaceEvidence,
	missingModuleSurfaces,
} from './module-conformance'
import { getGameSlugs } from './registry'

function rustCatalogSlugs(): string[] {
	const path = join(
		import.meta.dir,
		'../../../../crates/puzzled-core/src/capabilities/puzzle_play/domain/game_slugs.rs',
	)
	const src = readFileSync(path, 'utf8')
	const block = src.match(/const VALID_SLUGS: &\[&str\] = &\[([\s\S]*?)\];/)
	if (!block) {
		throw new Error('VALID_SLUGS block not found in game_slugs.rs')
	}
	return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

function completeEvidence(): ModuleSurfaceEvidence {
	return {
		metadata: true,
		content_source: true,
		interaction: true,
		terminal_contract: true,
		server_validator: true,
		canonical_record: true,
		reentry: true,
		non_spoiler_result: true,
	}
}

describe('shared module conformance oracle', () => {
	test('required surfaces match the protocol eight', () => {
		expect(MODULE_SURFACES).toEqual([
			'metadata',
			'content_source',
			'interaction',
			'terminal_contract',
			'server_validator',
			'canonical_record',
			'reentry',
			'non_spoiler_result',
		])
	})

	test('missing server validator blocks admission', () => {
		const evidence = { ...completeEvidence(), server_validator: false }
		expect(missingModuleSurfaces(evidence)).toEqual(['server_validator'])
		expect(isProtocolComplete(evidence)).toBe(false)
		expect(isCustomerReachable('sudoku', evidence)).toBe(false)
		expect(catalogAdmissionFailures(['sudoku'], () => evidence)).toEqual([
			{ slug: 'sudoku', missing: ['server_validator'] },
		])
	})

	test('unknown slug is not reachable with complete-looking evidence', () => {
		expect(isCustomerReachable('brand-new-module', completeEvidence())).toBe(false)
		const failures = catalogAdmissionFailures(['brand-new-module'], () => completeEvidence())
		expect(failures).toHaveLength(1)
		expect(failures[0]?.slug).toBe('brand-new-module')
		expect(failures[0]?.missing).toContain('metadata')
	})

	test('customer catalog matches server catalog and interaction registry', () => {
		const customer = [...getGameSlugs()].sort()
		const server = [...rustCatalogSlugs()].sort()
		const interaction = [...INTERACTION_SLUGS].sort()
		expect(customer).toEqual(server)
		expect(customer).toEqual(interaction)
	})

	test('every customer slug is protocol-complete', () => {
		const server = new Set(rustCatalogSlugs())
		const slugs = getGameSlugs()
		const failures = catalogAdmissionFailures(slugs, (slug) =>
			collectClientModuleEvidence(slug, server.has(slug)),
		)
		expect(failures).toEqual([])
		for (const slug of slugs) {
			expect(hasPlayableInteraction(slug)).toBe(true)
			expect(isCustomerReachable(slug, collectClientModuleEvidence(slug, server.has(slug)))).toBe(
				true,
			)
		}
	})

	test('a catalog slug without a server validator is not reachable', () => {
		const slug = getGameSlugs()[0]
		expect(slug).toBeDefined()
		if (!slug) return
		const evidence = collectClientModuleEvidence(slug, false)
		expect(isCustomerReachable(slug, evidence)).toBe(false)
		expect(missingModuleSurfaces(evidence)).toContain('server_validator')
	})
})

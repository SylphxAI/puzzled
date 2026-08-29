import { describe, expect, test } from 'bun:test'
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

	test('customer catalog matches interaction registry', () => {
		const customer = [...getGameSlugs()].sort()
		const interaction = [...INTERACTION_SLUGS].sort()
		expect(customer).toEqual(interaction)
	})

	test('every customer slug is protocol-complete with a server validator', () => {
		const slugs = getGameSlugs()
		const failures = catalogAdmissionFailures(slugs, (slug) =>
			collectClientModuleEvidence(slug, true),
		)
		expect(failures).toEqual([])
		for (const slug of slugs) {
			expect(hasPlayableInteraction(slug)).toBe(true)
			expect(isCustomerReachable(slug, collectClientModuleEvidence(slug, true))).toBe(true)
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

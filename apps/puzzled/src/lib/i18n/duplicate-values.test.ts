/**
 * Duplicate-value guard (TD-24).
 *
 * Intra-locale duplication - one value authored under several keys - is how the
 * message catalogue grew words like Cancel (x8) and Refresh (x5). The guard
 * records every duplicate group the resolved catalogues carry today in
 * `scripts/i18n-dupe-baseline.json` (value -> keys, per locale) and fails when
 * the surface drifts from it:
 *
 *   1. a value duplicated at keys the baseline does not record - the
 *      new-key-with-an-existing-value case this check exists for;
 *   2. a recorded group whose key set changed (a key added or removed);
 *   3. a recorded group that vanished - a stale baseline, regenerated with
 *      `bun run scripts/i18n-report-duplicate-values.ts --update-baseline`.
 *
 * The check itself is `checksAgainstBaseline` in the report script; this file
 * runs it inside the suite so CI enforces it, and proves the diff mechanics on
 * synthetic catalogues so a broken baseline loader cannot pass silently.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
	allResolvedGroups,
	BASELINE_PATH,
	type Baseline,
	classifyGroupReference,
	diffAgainstBaseline,
	diffGroups,
	driftProblems,
	scanSource,
	serializeBaseline,
} from '../../../scripts/i18n-report-duplicate-values'

describe('resolved duplicate-value baseline', () => {
	test('every duplicate group in the resolved catalogues is recorded', () => {
		const drift = diffAgainstBaseline()
		expect(driftProblems(drift)).toEqual([])
	})

	test('the baseline file is exactly what --update-baseline writes', () => {
		const expected = serializeBaseline(allResolvedGroups())
		expect(readFileSync(BASELINE_PATH, 'utf8')).toBe(expected)
	})
})

describe('baseline mechanics', () => {
	const baseline: Baseline = {
		version: 1,
		locales: {
			'en-US': [
				{ value: 'Cancel', keys: ['common.cancel', 'settings.cancel'] },
				{ value: 'Draft', keys: ['a.draft', 'b.draft'] },
			],
		},
	}

	test('a new duplicate value is drift', () => {
		const current = {
			'en-US': [
				{ value: 'Cancel', keys: ['common.cancel', 'settings.cancel'] },
				{ value: 'Draft', keys: ['a.draft', 'b.draft'] },
				{ value: 'Save', keys: ['a.save', 'b.save'] },
			],
		}
		const drift = diffGroups(current, baseline)
		expect(drift.newValues).toEqual([
			{ locale: 'en-US', value: 'Save', keys: ['a.save', 'b.save'] },
		])
		expect(drift.changedGroups).toEqual([])
		expect(drift.missingValues).toEqual([])
	})

	test('a key added under an existing value is a changed group', () => {
		const current = {
			'en-US': [
				{ value: 'Cancel', keys: ['common.cancel', 'extra.cancel', 'settings.cancel'] },
				{ value: 'Draft', keys: ['a.draft', 'b.draft'] },
			],
		}
		const drift = diffGroups(current, baseline)
		expect(drift.changedGroups).toEqual([
			{
				locale: 'en-US',
				value: 'Cancel',
				baselineKeys: ['common.cancel', 'settings.cancel'],
				currentKeys: ['common.cancel', 'extra.cancel', 'settings.cancel'],
			},
		])
		expect(drift.newValues).toEqual([])
		expect(drift.missingValues).toEqual([])
	})

	test('a recorded group that vanished is stale', () => {
		const current = { 'en-US': [{ value: 'Draft', keys: ['a.draft', 'b.draft'] }] }
		const drift = diffGroups(current, baseline)
		expect(drift.missingValues).toEqual([
			{ locale: 'en-US', value: 'Cancel', keys: ['common.cancel', 'settings.cancel'] },
		])
		expect(drift.newValues).toEqual([])
		expect(drift.changedGroups).toEqual([])
	})
})

describe('reference classifier', () => {
	test('resolves t() calls against the namespaces the file binds', () => {
		const source = [
			'export function Panel() {',
			"\tconst t = useTranslations('settings')",
			"\tconst tCommon = useTranslations('common')",
			"\treturn t('security.title') + tCommon('cancel') + t.rich('bold', {}) + t('nested.path')",
			'}',
		].join('\n')
		const { namespaces, calls } = scanSource(source)
		expect(namespaces).toEqual(['settings', 'common'])
		expect(calls.map((call) => call.arg)).toEqual([
			'security.title',
			'cancel',
			'bold',
			'nested.path',
		])

		const referenced = new Map([
			['settings.security.title', [{ file: 'x.tsx', line: 4 }]],
			['common.cancel', [{ file: 'x.tsx', line: 4 }]],
		])
		expect(classifyGroupReference(['settings.security.title', 'common.cancel'], referenced)).toBe(
			'all',
		)
		expect(
			classifyGroupReference(['settings.security.title', 'settings.unknown'], referenced),
		).toBe('some')
		expect(classifyGroupReference(['settings.a', 'settings.b'], referenced)).toBe('none')
	})
})

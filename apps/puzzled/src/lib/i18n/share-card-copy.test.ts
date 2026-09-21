/**
 * Result-card copy oracle (S3 slice 2).
 *
 * Every string the card draws or speaks lives in the share namespace's card
 * block, in all five catalogs. This scan fails when a locale falls behind, when
 * a placeholder a sentence needs goes missing, when a placeholder nobody
 * supplies sneaks in, or when the surface and the catalogs drift apart in
 * either direction (a used key that does not exist; a shipped key nothing uses).
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'

type Json = Record<string, unknown>

const SRC = join(import.meta.dir, '..', '..')

/**
 * Resolved exactly as the runtime assembles them: overlay locales (en-GB over
 * en-US, zh-TW over zh-HK) ship only their deltas over the base.
 */
const CATALOGS: Record<string, Json> = {
	'en-US': resolveLocale('en-US').share as Json,
	'en-GB': resolveLocale('en-GB').share as Json,
	'zh-HK': resolveLocale('zh-HK').share as Json,
	'zh-TW': resolveLocale('zh-TW').share as Json,
	'zh-CN': resolveLocale('zh-CN').share as Json,
}

/** Placeholders each key must keep, or its sentence loses a fact. */
const REQUIRED_PLACEHOLDERS: Record<string, string[]> = {
	attemptsOf: ['attempts', 'max'],
	attemptsCount: ['attempts'],
	scorePoints: ['score'],
	streakDays: ['days'],
	patternSummary: ['hit', 'near', 'miss'],
	altOnDay: ['day'],
	altTemplate: ['game', 'day', 'result'],
	altDetailsTemplate: ['details'],
	altLinkTemplate: ['link'],
}

const ALLOWED_PLACEHOLDERS = new Set([
	'attempts',
	'max',
	'score',
	'days',
	'hit',
	'near',
	'miss',
	'day',
	'game',
	'result',
	'details',
	'link',
])

function cardBlock(catalogue: Json): Record<string, string> {
	const card = catalogue.card
	expect(typeof card).toBe('object')
	return card as Record<string, string>
}

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) {
			if (entry === 'node_modules') continue
			walk(path, out)
		} else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
			out.push(path)
		}
	}
	return out
}

/** Every 'card.*' key the source references through the share namespace. */
function referencedCardKeys(): string[] {
	const pattern = /tShare\('(card\.[A-Za-z0-9_]+)'\)/g
	const keys = new Set<string>()
	for (const file of walk(SRC)) {
		if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
		const source = readFileSync(file, 'utf8')
		for (const match of source.matchAll(pattern)) keys.add(match[1] as string)
	}
	return [...keys].sort()
}

describe('share.card copy', () => {
	const en = cardBlock(CATALOGS['en-US'] as Json)

	test('every locale carries the same card keys, all non-empty', () => {
		const expected = Object.keys(en).sort()
		for (const [locale, catalogue] of Object.entries(CATALOGS)) {
			const card = cardBlock(catalogue)
			expect(locale + ':' + Object.keys(card).sort().join(',')).toBe(
				locale + ':' + expected.join(','),
			)
			for (const [key, value] of Object.entries(card)) {
				const empty = typeof value !== 'string' || value.trim().length === 0
				expect(locale + '.' + key + (empty ? ' IS EMPTY' : '')).toBe(locale + '.' + key)
			}
		}
	})

	test('each sentence keeps the placeholders it needs', () => {
		for (const [locale, catalogue] of Object.entries(CATALOGS)) {
			const card = cardBlock(catalogue)
			for (const [key, placeholders] of Object.entries(REQUIRED_PLACEHOLDERS)) {
				for (const placeholder of placeholders) {
					expect(locale + '.' + key + ' {').toBe(
						locale +
							'.' +
							key +
							' ' +
							(card[key]?.includes('{' + placeholder + '}') ? '{' : 'MISSING'),
					)
				}
			}
		}
	})

	test('no placeholder appears that the model does not supply', () => {
		for (const [locale, catalogue] of Object.entries(CATALOGS)) {
			const card = cardBlock(catalogue)
			for (const [key, value] of Object.entries(card)) {
				const tokens = [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(
					(match) => match[1] as string,
				)
				const unknown = tokens.filter((token) => !ALLOWED_PLACEHOLDERS.has(token))
				expect(locale + '.' + key + ' unknown=' + unknown.join(',')).toBe(
					locale + '.' + key + ' unknown=',
				)
			}
		}
	})

	test('the surface and the catalogs agree in both directions', () => {
		const referenced = referencedCardKeys()
		expect(referenced.length).toBeGreaterThanOrEqual(20)
		const missing = referenced.filter((key) => !(key.slice('card.'.length) in en))
		expect(missing).toEqual([])
		const unused = Object.keys(en)
			.filter((key) => !referenced.includes('card.' + key))
			.sort()
		expect(unused).toEqual([])
	})
})

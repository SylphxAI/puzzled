/**
 * Deterministic guard: no Cantonese particle may appear in any zh-TW locale
 * file. The audit lists every zh-TW file under `src` (messages/zh-TW/*.json
 * plus the per-game translations/zh-TW.json) and asserts the whole set is
 * Cantonese-free, so the Taiwan Traditional Chinese copy never regresses.
 *
 * zh-HK keeps its authentic Cantonese; this guard never inspects it.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Cantonese particles the zh-TW copy must never contain. */
const CANTONESE_PARTICLES_IN_TW = /[咗嘅喺冇唔佢咁啲嚟嘢]/

function listJsonFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return listJsonFiles(path)
		return entry.isFile() && entry.name.endsWith('.json') ? [path] : []
	})
}

function collectZhTwFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) {
			// src/messages/zh-TW holds the locale messages; the per-game
			// src/games/*/translations dirs hold translations/zh-TW.json.
			if (entry.name === 'zh-TW') return listJsonFiles(path)
			return collectZhTwFiles(path)
		}
		return entry.isFile() && entry.name === 'zh-TW.json' ? [path] : []
	})
}

const appRoot = resolve(import.meta.dir, '../../..')
const zhTwFiles = [...new Set(collectZhTwFiles(join(appRoot, 'src')))].sort()

function collectStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value)
	else if (Array.isArray(value)) {
		for (const item of value) collectStrings(item, out)
	} else if (value !== null && typeof value === 'object') {
		for (const item of Object.values(value)) collectStrings(item, out)
	}
	return out
}

describe('zh-TW locale files', () => {
	test('the audit finds zh-TW locale files to guard', () => {
		expect(zhTwFiles.length).toBeGreaterThan(0)
	})

	test('contain zero Cantonese particles across every file', () => {
		const violations: string[] = []
		for (const file of zhTwFiles) {
			const strings = collectStrings(JSON.parse(readFileSync(file, 'utf8')))
			for (const text of strings) {
				if (CANTONESE_PARTICLES_IN_TW.test(text)) violations.push(`${file}: ${text}`)
			}
		}
		expect(violations).toEqual([])
	})
})

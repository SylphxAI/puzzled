import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_COLORS } from './category-colors'

const root = join(import.meta.dir, '../../../../../..')
const globals = readFileSync(join(root, 'apps/puzzled/src/app/globals.css'), 'utf8')
const brand = readFileSync(join(root, 'brand/tokens.css'), 'utf8')

function block(css: string, selector: string): string {
	const out: string[] = []
	const re = new RegExp(`(^|\\n)\\s*${selector.replace('.', '\\.')}\\s*\\{`, 'g')
	for (let m = re.exec(css); m; m = re.exec(css)) {
		let depth = 1
		let i = m.index + m[0].length
		const start = i
		while (depth > 0 && i < css.length) {
			if (css[i] === '{') depth++
			else if (css[i] === '}') depth--
			i++
		}
		out.push(css.slice(start, i - 1))
	}
	return out.join('\n')
}

function vars(css: string): Record<string, string> {
	const o: Record<string, string> = {}
	for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
		o[m[1] as string] = (m[2] as string).trim()
	return o
}

const brandVars = vars(brand)
const light = { ...brandVars, ...vars(block(globals, '@theme')) }
const dark = { ...light, ...vars(block(globals, '.dark')) }

function resolve(v: Record<string, string>, name: string): string {
	let val = v[`--color-${name}`] as string
	for (let n = 0; n < 5 && val?.startsWith('var('); n++) val = v[val.slice(4, -1).trim()] as string
	if (!/^#[0-9a-f]{6}$/i.test(val ?? '')) throw new Error(`token ${name} not a hex: ${val}`)
	return val
}

function luminance(hex: string): number {
	const c = [1, 3, 5].map((i) => {
		const s = Number.parseInt(hex.slice(i, i + 2), 16) / 255
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number)
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
	return (hi + 0.05) / (lo + 0.05)
}

describe('missed-category colours on the loss screen', () => {
	for (const [theme, v] of [
		['light', light],
		['dark', dark],
	] as const) {
		for (const level of [0, 1, 2, 3] as const) {
			test(`${theme} level ${level}: text meets WCAG AA 4.5:1 on its background`, () => {
				const { bg, text } = CATEGORY_COLORS[level]
				expect(text).not.toBe(bg.replace('bg-', 'text-'))
				const ratio = contrast(
					resolve(v, bg.replace('bg-', '')),
					resolve(v, text.replace('text-', '')),
				)
				expect(ratio).toBeGreaterThanOrEqual(4.5)
			})
		}
	}
})

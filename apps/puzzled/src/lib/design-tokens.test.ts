/**
 * Design-token guard.
 *
 * Regression this exists for: `bg-key-bg` was used in the UI while globals.css
 * only declared `--color-key` and `--color-key-text`. Tailwind then emitted no
 * CSS at all and the utility silently did nothing.
 *
 * The guard re-derives the declared design tokens from the Tailwind v4 token
 * layer (`@theme`, `.dark` and `:root` blocks of globals.css) plus Tailwind's
 * own `theme.css` defaults (framework colours/sizes are not project tokens),
 * then checks every colour-like utility class written in the app and ui sources
 * resolves to one of them. Anything else is a dangling class and fails loudly.
 *
 * Deliberate allow list (genuine non-token utilities, so they are not flagged):
 * text alignment/wrapping/colour keywords, bg size/position/repetition/
 * gradient keywords, border width/style/side keywords, ring width/inset/offset
 * keywords, plus CSS classes declared literally in globals.css (e.g.
 * `.bg-aurora`) and fully arbitrary values (`bg-[...]`, skipped because they do
 * not reference a token name).
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const SELF = import.meta.path
const APP_SRC = 'apps/puzzled/src'
const UI_SRC = 'packages/ui/src'
const GLOBALS_CSS = `${APP_SRC}/app/globals.css`

const PREFIXES = [
	'bg',
	'text',
	'border',
	'ring',
	'fill',
	'stroke',
	'outline',
	'divide',
	'from',
	'via',
	'to',
	'caret',
	'accent',
	'decoration',
	'placeholder',
] as const
type UtilityPrefix = (typeof PREFIXES)[number]
const UTILITY_RE = new RegExp(`^(${PREFIXES.join('|')})-(.+)$`)

const TEXT_KEYWORDS = new Set([
	'left',
	'center',
	'right',
	'justify',
	'start',
	'end',
	'wrap',
	'nowrap',
	'balance',
	'pretty',
	'ellipsis',
	'clip',
	'transparent',
	'current',
	'inherit',
])
const BG_KEYWORDS = new Set([
	'none',
	'cover',
	'contain',
	'auto',
	'center',
	'top',
	'bottom',
	'left',
	'right',
	'repeat',
	'fixed',
	'local',
	'scroll',
	'transparent',
	'current',
	'inherit',
])
const BG_PATTERNS = [
	/^gradient-/,
	/^linear-/,
	/^radial-/,
	/^conic-/,
	/^repeat-/,
	/^clip-/,
	/^origin-/,
	/^blend-/,
]
const BORDER_STYLES = new Set([
	'solid',
	'dashed',
	'dotted',
	'double',
	'none',
	'hidden',
	'collapse',
	'separate',
])
const BORDER_SIDES = ['x', 'y', 't', 'b', 'l', 'r', 's', 'e']
const OUTLINE_STYLES = new Set(['none', 'hidden', 'dashed', 'dotted', 'double', 'solid'])
const DECORATION_KEYWORDS = new Set([
	'auto',
	'from-font',
	'solid',
	'dashed',
	'dotted',
	'double',
	'wavy',
])
const COLOR_KEYWORDS = new Set(['transparent', 'current', 'inherit'])
const NUMBER = /^\d+(\.\d+)?$/

function findRepoRoot(start: string): string {
	let dir = start
	for (;;) {
		if (existsSync(join(dir, GLOBALS_CSS)) && existsSync(join(dir, UI_SRC))) return dir
		const parent = dirname(dir)
		if (parent === dir) throw new Error(`design-tokens guard: repo root not found from ${start}`)
		dir = parent
	}
}

function stripComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Bodies of every block whose selector matches, brace-matched so nesting is safe. */
function cssBlocks(css: string, selectorRe: RegExp): string[] {
	const text = stripComments(css)
	const bodies: string[] = []
	for (const match of text.matchAll(selectorRe)) {
		const open = text.indexOf('{', match.index ?? 0)
		let depth = 0
		let end = open
		for (; end < text.length; end++) {
			if (text[end] === '{') depth++
			else if (text[end] === '}') {
				depth--
				if (depth === 0) break
			}
		}
		bodies.push(text.slice(open + 1, end))
	}
	return bodies
}

function findTailwindTheme(root: string): string {
	const candidates = [
		join(root, 'node_modules/tailwindcss/theme.css'),
		join(root, 'apps/puzzled/node_modules/tailwindcss/theme.css'),
		join(root, 'packages/ui/node_modules/tailwindcss/theme.css'),
	]
	const bunStore = join(root, 'node_modules/.bun')
	if (existsSync(bunStore)) {
		for (const entry of readdirSync(bunStore)) {
			if (entry.startsWith('tailwindcss@')) {
				candidates.push(join(bunStore, entry, 'node_modules/tailwindcss/theme.css'))
			}
		}
	}
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate
	}
	throw new Error(
		`design-tokens guard: tailwindcss theme.css not found (checked ${candidates.length} paths)`,
	)
}

type TokenLayer = {
	projectColors: Set<string>
	projectSpacing: Set<string>
	frameworkColors: Set<string>
	frameworkText: Set<string>
	frameworkSpacing: Set<string>
	frameworkRadius: Set<string>
	customClasses: Set<string>
}

function loadTokenLayer() {
	const root = findRepoRoot(import.meta.dir)
	const globalsCss = stripComments(readFileSync(join(root, GLOBALS_CSS), 'utf8'))
	const themeCss = stripComments(readFileSync(findTailwindTheme(root), 'utf8'))

	const projectColors = new Set<string>()
	const projectSpacing = new Set<string>()
	for (const body of cssBlocks(globalsCss, /@theme\b[^{]*\{|\.dark\s*\{|:root\s*\{/g)) {
		for (const decl of body.matchAll(/--(color|spacing)-([\w-]+)\s*:/g)) {
			;(decl[1] === 'color' ? projectColors : projectSpacing).add(decl[2])
		}
	}

	const customClasses = new Set<string>()
	for (const decl of globalsCss.matchAll(/\.([a-zA-Z][\w-]*)/g)) customClasses.add(decl[1])

	const frameworkColors = new Set<string>()
	const frameworkText = new Set<string>()
	const frameworkSpacing = new Set<string>()
	const frameworkRadius = new Set<string>()
	for (const decl of themeCss.matchAll(/--(color|text|spacing|radius)([\w-]*)\s*:/g)) {
		const name = decl[2].replace(/^-/, '')
		if (decl[1] === 'color') frameworkColors.add(name)
		else if (decl[1] === 'text') frameworkText.add(name)
		else if (decl[1] === 'spacing') frameworkSpacing.add(name)
		else frameworkRadius.add(name)
	}

	return {
		root,
		tokens: {
			projectColors,
			projectSpacing,
			frameworkColors,
			frameworkText,
			frameworkSpacing,
			frameworkRadius,
			customClasses,
		} satisfies TokenLayer,
	}
}

const { root, tokens } = loadTokenLayer()

function hasTopLevelColon(value: string): boolean {
	let depth = 0
	for (const char of value) {
		if (char === '[') depth++
		else if (char === ']') depth--
		else if (char === ':' && depth === 0) return true
	}
	return false
}

/** True when the class name is a declared colour (project token or framework default). */
function isColor(name: string, layer: TokenLayer): boolean {
	return (
		COLOR_KEYWORDS.has(name) || layer.projectColors.has(name) || layer.frameworkColors.has(name)
	)
}

/**
 * Resolve one utility (variant prefixes already stripped) against the token
 * layer. Returns false only when the class references a name that is neither a
 * declared token nor a genuine non-token utility keyword.
 */
function resolves(prefix: UtilityPrefix, rest: string, layer: TokenLayer): boolean {
	if (rest.startsWith('[')) return true // fully arbitrary value, does not name a token
	if (hasTopLevelColon(rest)) return false
	const name = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : rest
	if (layer.customClasses.has(`${prefix}-${name}`)) return true

	switch (prefix) {
		case 'bg':
			return (
				BG_KEYWORDS.has(name) ||
				BG_PATTERNS.some((pattern) => pattern.test(name)) ||
				isColor(name, layer)
			)
		case 'text':
			return TEXT_KEYWORDS.has(name) || layer.frameworkText.has(name) || isColor(name, layer)
		case 'border': {
			if (BORDER_STYLES.has(name)) return true
			if (name.startsWith('spacing-')) {
				const inner = name.slice('spacing-'.length)
				if (inner.startsWith('[') || NUMBER.test(inner)) return true
				const axis = inner.replace(/^[xy]-/, '')
				return (
					layer.projectSpacing.has(inner) || layer.frameworkSpacing.has(inner) || NUMBER.test(axis)
				)
			}
			for (const side of BORDER_SIDES) {
				if (name === side) return true
				if (name.startsWith(`${side}-`)) {
					const inner = name.slice(side.length + 1)
					return inner.startsWith('[') || NUMBER.test(inner) || isColor(inner, layer)
				}
			}
			return NUMBER.test(name) || isColor(name, layer)
		}
		case 'ring': {
			if (name === 'inset') return true
			if (name.startsWith('offset-')) {
				const inner = name.slice('offset-'.length)
				return inner.startsWith('[') || NUMBER.test(inner) || isColor(inner, layer)
			}
			return NUMBER.test(name) || isColor(name, layer)
		}
		case 'fill':
		case 'stroke':
			if (name === 'none' || COLOR_KEYWORDS.has(name)) return true
			if (prefix === 'stroke' && NUMBER.test(name)) return true
			return isColor(name, layer)
		case 'outline': {
			if (OUTLINE_STYLES.has(name)) return true
			if (name.startsWith('offset-')) {
				const inner = name.slice('offset-'.length)
				return inner.startsWith('[') || NUMBER.test(inner) || isColor(inner, layer)
			}
			return NUMBER.test(name) || isColor(name, layer)
		}
		case 'divide': {
			if (BORDER_STYLES.has(name)) return true
			for (const side of ['x', 'y']) {
				if (name === side) return true
				if (name.startsWith(`${side}-`)) {
					const inner = name.slice(side.length + 1)
					return (
						inner.startsWith('[') ||
						NUMBER.test(inner) ||
						inner === 'reverse' ||
						isColor(inner, layer)
					)
				}
			}
			return isColor(name, layer)
		}
		case 'from':
		case 'via':
		case 'to':
		case 'caret':
		case 'placeholder':
			return isColor(name, layer)
		case 'accent':
			return name === 'auto' || isColor(name, layer)
		case 'decoration':
			return NUMBER.test(name) || DECORATION_KEYWORDS.has(name) || isColor(name, layer)
	}
}

/**
 * Class-shaped token: variants and an optional utility name / arbitrary value,
 * e.g. `md:hover:bg-primary/50`, `data-[state=open]:border-x-2`, `bg-[var(--x)]`.
 * Used to tell class lists apart from ordinary strings.
 */
function isClassShaped(token: string): boolean {
	let depth = 0
	let current = ''
	const parts: string[] = []
	for (const char of token.replace(/^!/, '')) {
		if (char === '[') {
			depth++
			current += char
		} else if (char === ']') {
			depth--
			if (depth < 0) return false
			current += char
		} else if (char === ':' && depth === 0) {
			parts.push(current)
			current = ''
		} else current += char
	}
	if (depth !== 0) return false
	parts.push(current)
	const utility = parts.pop() ?? ''
	const variantOk = (part: string) => /^(?:[a-z0-9@_.$&|>=~*/-]|\[[^\s]*\])+$/i.test(part)
	if (!parts.every(variantOk)) return false
	return /^-?(?:[a-z][a-z0-9-]*(?:\[[^\]\s]*\])?|\[[^\]\s]+\])(?:\/(?:[a-z0-9.[\]%()-]+))?!?$/i.test(
		utility,
	)
}

/** Utility part of a class token, with variant prefixes and trailing `!` removed. */
function utilityOf(token: string): string | null {
	let lastColon = -1
	let depth = 0
	for (let index = 0; index < token.length; index++) {
		const char = token[index]
		if (char === '[') depth++
		else if (char === ']') depth--
		else if (char === ':' && depth === 0) lastColon = index
	}
	const candidates = lastColon === -1 ? [token] : [token.slice(lastColon + 1), token]
	for (const candidate of candidates) {
		const match = candidate.match(UTILITY_RE)
		if (match && !hasTopLevelColon(match[2])) return candidate
	}
	return null
}

function resolvesClass(token: string, layer: TokenLayer): boolean {
	const utility = utilityOf(token)
	if (!utility) return true // not a class of a guarded family
	const match = utility.match(UTILITY_RE)
	if (!match) return true
	return resolves(match[1] as UtilityPrefix, match[2], layer)
}

/** Unresolved classes from a synthetic class list (used by the meta tests). */
function unresolvedClasses(classNames: string[], layer: TokenLayer): string[] {
	return classNames.filter((name) => !resolvesClass(name, layer))
}

/** Drop `${...}` expressions so template literals can still be read as class lists. */
function stripInterpolations(body: string): string {
	let out = ''
	let depth = 0
	for (let index = 0; index < body.length; index++) {
		const char = body[index]
		if (char === '$' && body[index + 1] === '{') {
			depth++
			index++
			continue
		}
		if (depth > 0) {
			if (char === '{') depth++
			else if (char === '}') depth--
			continue
		}
		out += char
	}
	return out
}

const LITERAL_RE = /(?<![\w$])(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g
const GUARDED_FAMILY_RE =
	/(?:bg|text|border|ring|fill|stroke|outline|divide|from|via|to|caret|accent|decoration|placeholder)-/

/**
 * Unresolved classes inside one blob of source text, as absolute offsets.
 * Only string literals are inspected, and only when every token looks like a
 * class name (so style values such as `stroke-dasharray 600ms` are ignored).
 */
function scanSourceText(
	text: string,
	layer: TokenLayer,
): { unresolved: { cls: string; index: number }[]; checked: number } {
	const unresolved: { cls: string; index: number }[] = []
	let checked = 0
	const walk = (body: string, base: number, depth: number) => {
		if (depth > 2) return
		for (const nested of body.matchAll(LITERAL_RE)) {
			walk(nested[2], base + (nested.index ?? 0) + 1, depth + 1)
		}
		const flat = stripInterpolations(body)
		const tokens = flat.split(/\s+/).filter(Boolean)
		if (tokens.length === 0 || !tokens.every(isClassShaped)) return
		let offset = 0
		for (const token of tokens) {
			const at = flat.indexOf(token, offset)
			offset = at + token.length
			if (utilityOf(token)) checked++
			if (!resolvesClass(token, layer)) unresolved.push({ cls: token, index: base + at })
		}
	}
	for (const match of text.matchAll(LITERAL_RE)) walk(match[2], (match.index ?? 0) + 1, 0)
	return { unresolved, checked }
}

function scanSources() {
	const files: string[] = []
	for (const dir of [join(root, APP_SRC), join(root, UI_SRC)]) {
		for (const file of new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: dir, absolute: true })) {
			if (file !== SELF) files.push(file)
		}
	}
	files.sort()

	const unresolved: { file: string; line: number; cls: string }[] = []
	let checked = 0
	for (const file of files) {
		const text = readFileSync(file, 'utf8')
		if (!GUARDED_FAMILY_RE.test(text)) continue
		const found = scanSourceText(text, tokens)
		checked += found.checked
		for (const entry of found.unresolved) {
			unresolved.push({
				file: relative(root, file),
				line: text.slice(0, entry.index).split('\n').length,
				cls: entry.cls,
			})
		}
	}
	unresolved.sort(
		(a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.cls.localeCompare(b.cls),
	)
	return { files, checked, unresolved }
}

describe('design token layer', () => {
	test('derives project tokens from globals.css and defaults from Tailwind theme.css', () => {
		// the exact tokens of the production regression: key exists, key-bg never did
		expect(tokens.projectColors.has('key')).toBe(true)
		expect(tokens.projectColors.has('key-text')).toBe(true)
		expect(tokens.projectColors.has('primary')).toBe(true)
		expect(tokens.projectColors.size).toBeGreaterThan(20)
		expect(tokens.projectSpacing.has('header-height')).toBe(true)
		// framework defaults come from the installed package, not a hardcoded palette
		expect(tokens.frameworkColors.has('red-500')).toBe(true)
		expect(tokens.frameworkText.has('sm')).toBe(true)
		expect(tokens.frameworkRadius.has('sm')).toBe(true)
		expect(tokens.customClasses.has('text-gradient')).toBe(true)
	})

	test('every token utility class in the app and ui sources resolves to a declared token', () => {
		const { files, checked, unresolved } = scanSources()
		expect(files.length).toBeGreaterThan(100)
		expect(checked).toBeGreaterThan(500)
		expect(unresolved.map((entry) => `${entry.file}:${entry.line} <${entry.cls}>`)).toEqual([])
	})
})

describe('guard teeth', () => {
	test('flags the production regression class bg-key-bg in every form it is written', () => {
		expect(
			unresolvedClasses(['bg-key-bg', 'dark:bg-key-bg/50', 'group-hover:bg-key-bg'], tokens),
		).toEqual(['bg-key-bg', 'dark:bg-key-bg/50', 'group-hover:bg-key-bg'])
	})

	test('accepts declared neighbours and arbitrary values that name no token', () => {
		expect(
			unresolvedClasses(
				[
					'bg-key',
					'text-key-text',
					'hover:bg-key',
					'dark:bg-key/50',
					'bg-[var(--color-key)]',
					'bg-[var(--color-key-bg)]',
					'bg-red-500/20',
				],
				tokens,
			),
		).toEqual([])
	})

	test('reports bg-key-bg from a className string literal, as the file scan does', () => {
		const fixture = '<div className="rounded-lg bg-key-bg text-key-text" />'
		const { unresolved } = scanSourceText(fixture, tokens)
		expect(unresolved.map((entry) => entry.cls)).toEqual(['bg-key-bg'])
	})
})

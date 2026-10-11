/**
 * Element resets stay below the utilities.
 *
 * Regression this exists for: globals.css carried an unlayered
 * `button { border: none }`. Tailwind v4 puts utilities in `@layer utilities`,
 * and unlayered CSS beats every layer, so each `border` class on a <button>
 * computed to 0px. The cookie banner's Decline, Settings and Accept then read
 * as captions instead of buttons, and the Google sign-in button lost its
 * outline.
 *
 * The guard: a top-level (unlayered) rule that targets a bare form or link
 * element may not set a box property a utility class would set. Put such a
 * reset in `@layer base`. Focus rings (outline, box-shadow) are left out:
 * they override utilities on purpose (WCAG 2.4.7).
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'

const GLOBALS_CSS = join(import.meta.dir, '..', 'app', 'globals.css')
const ELEMENT = /(^|[\s>+~,(])(button|input|select|textarea|a|label)(?=$|[\s:[.,>+~)])/
const BOX_PROPERTY = /^(border|background|padding|margin|width|height|min-|max-|display|color$)/

describe('globals.css element resets', () => {
	test('no unlayered element rule overrides a utility-owned property', () => {
		const root = postcss.parse(readFileSync(GLOBALS_CSS, 'utf8'))
		const offenders: string[] = []
		for (const node of root.nodes) {
			if (node.type !== 'rule') continue
			if (!node.selectors.some((selector) => ELEMENT.test(selector))) continue
			node.walkDecls((decl) => {
				if (BOX_PROPERTY.test(decl.prop)) offenders.push(`${node.selector} { ${decl.prop} }`)
			})
		}
		expect(offenders).toEqual([])
	})

	test('the check catches the original defect', () => {
		const root = postcss.parse('button { border: none; cursor: pointer; }')
		const rule = root.nodes[0]
		expect(rule?.type === 'rule' && rule.selectors.some((s) => ELEMENT.test(s))).toBe(true)
	})
})

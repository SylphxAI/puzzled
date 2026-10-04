import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroGuestNote } from './hero-guest-note'

const render = (props: { locked: boolean; isGuest: boolean }) =>
	renderToStaticMarkup(createElement(HeroGuestNote, props, 'No account needed to play.'))

describe('HeroGuestNote', () => {
	test('tells a guest on an open game that no account is needed', () => {
		expect(render({ locked: false, isGuest: true })).toContain('No account needed to play.')
	})

	test('says nothing about playing without an account above the Plus lock', () => {
		expect(render({ locked: true, isGuest: true })).toBe('')
	})

	test('says nothing to a signed-in player', () => {
		expect(render({ locked: false, isGuest: false })).toBe('')
	})
})

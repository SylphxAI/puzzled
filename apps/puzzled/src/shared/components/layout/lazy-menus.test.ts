import { describe, expect, test } from 'bun:test'

/**
 * The first-load JS of every page carries only the plain triggers; the dropdown
 * and dialog runtime (Base UI, floating-ui, motion) arrives on first use. These
 * guards keep a static import from putting it back into the route's first load.
 */
const read = (relative: string) => Bun.file(new URL(relative, import.meta.url)).text()

describe('on-demand menus and dialogs', () => {
	test('the language switcher and user menu import the dropdown runtime lazily', async () => {
		for (const file of ['./language-switcher.tsx', './user-menu.tsx']) {
			const source = await read(file)
			expect(source).not.toMatch(/DropdownMenu/)
			expect(source).toContain('useLazyMenu')
			expect(source).toMatch(/lazy\(/)
		}
		expect(await read('./language-switcher-menu.tsx')).toContain('DropdownMenu')
		expect(await read('./user-menu-dropdown.tsx')).toContain('DropdownMenu')
	})

	test('the help dialog and the streak dialog are not part of the game page first load', async () => {
		const page = await read('../../../app/[locale]/(main)/games/[slug]/game-page-client.tsx')
		expect(page).not.toMatch(/import \{ HowToPlayModal \}/)
		expect(page).toContain("import('@/features/daily/components/how-to-play-modal')")

		const prompt = await read('../../../features/daily/components/save-streak-prompt.tsx')
		expect(prompt).not.toMatch(/import \{ GuestSignupPrompt \}/)
		expect(prompt).toContain("import('./guest-signup-prompt')")
	})

	test('the consent banner stays eager and server-rendered in the (main) layout', async () => {
		const layout = await read('../../../app/[locale]/(main)/layout.tsx')
		expect(layout).toContain(
			"import { ConsentBanner } from '@/shared/components/layout/consent-banner'",
		)
		expect(layout).not.toMatch(/dynamic\([^)]*consent-banner/)
	})
})

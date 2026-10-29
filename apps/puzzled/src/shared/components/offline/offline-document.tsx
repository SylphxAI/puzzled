import { Button } from '@sylphx/ui'
import tokens from '../../../../../../brand/tokens.json'
import { BrandMark, Wordmark } from '../brand/mark'

function color(role: 'paper' | 'ink' | 'muted' | 'border' | 'focus', dark = false) {
	return tokens.color[dark ? (`${role}-dark` as const) : role].$value
}
const css = `
:root { color-scheme: light dark;
 --paper: ${color('paper')}; --ink: ${color('ink')};
 --muted: ${color('muted')}; --border: ${color('border')};
 --focus: ${color('focus')};
}
@media (prefers-color-scheme: dark) { :root {
 --paper: ${color('paper', true)}; --ink: ${color('ink', true)};
 --muted: ${color('muted', true)}; --border: ${color('border', true)};
 --focus: ${color('focus', true)};
} }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink);
 font-family: ${tokens.font.text.$value.join(',')}; line-height: 1.6; }
main { min-height: 100svh; display: grid; place-content: center;
 padding: 32px 24px; max-width: 480px; margin: auto; }
header { display: flex; align-items: center; gap: 12px; padding-bottom: 32px;
 border-bottom: 1px solid var(--border); }
h1 { font-family: ${tokens.font.display.$value.join(',')};
 font-size: clamp(32px, 8vw, 44px); line-height: 1.15; margin: 32px 0 16px; }
p { color: var(--muted); margin: 0 0 24px; }
a { display: inline-flex; justify-content: center; align-items: center;
 min-height: 48px; padding: 12px 24px; border-radius: 999px;
 background: var(--ink); color: var(--paper); text-decoration: none; font-weight: 600; }
a:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; }
a:hover { opacity: .9; }
`

/** Pre-rendered to public/offline.html. No scripts, fonts, or network assets:
 * this document must work when only the navigation fallback is cached.
 */
export function OfflineDocument() {
	return (
		<html lang="en">
			{/* biome-ignore lint/style/noHeadElement: standalone static HTML, not a Next page. */}
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="robots" content="noindex" />
				<title>You're offline · Puzzled</title>
				<style>{css}</style>
			</head>
			<body>
				<main>
					<header>
						<BrandMark size={40} decorative={false} />
						<Wordmark height={24} />
					</header>
					<h1>You're offline</h1>
					<p>
						Puzzled needs an internet connection to load puzzles and save finishes. Reconnect, then
						try again.
					</p>
					<Button asChild size="lg">
						{/* biome-ignore lint/a11y/useValidAnchor: empty reference intentionally reloads the original navigation URL. */}
						<a href="">Try again</a>
					</Button>
				</main>
			</body>
		</html>
	)
}

/** Generate the network-independent recovery document from the real UI and tokens.
 * Run: bun run scripts/generate-offline.tsx [--check]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/postcss'
import postcss, { type AcceptedPlugin } from 'postcss'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultLocale, LOCALE_REGISTRY, locales } from '../src/lib/i18n/config'
import { type OfflineLabels, OfflineView } from '../src/shared/components/offline-view'

const app = resolve(import.meta.dir, '..')
const stylesheet = resolve(app, 'src/app/globals.css')
const source = (await readFile(stylesheet, 'utf8'))
	.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
	.replace(
		'@source "../../../../packages/ui/src";',
		'@source "../shared/components/offline-view.tsx";\n@source "../../../../packages/ui/src/components/button.tsx";',
	)
// Tailwind resolves a different PostCSS 8 patch than the app; their runtime plugin API is identical.
const plugin = tailwindcss({
	base: dirname(stylesheet),
	optimize: true,
}) as unknown as AcceptedPlugin
const result = await postcss([plugin]).process(source, {
	from: stylesheet,
})
// Use the existing dark palette without depending on next-themes or JavaScript.
const dark = postcss
	.parse(source)
	.nodes.filter((node) => node.type === 'rule' && node.selector === '.dark')
	.map((node) => node.toString().replace(/^\.dark/, ':root'))
	.join('\n')
const font = (await readFile(resolve(app, 'src/app/fonts/fraunces-display.woff2'))).toString(
	'base64',
)
const css = `${result.css}\n@font-face{font-family:OfflineFraunces;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:500 700;font-style:normal;font-display:swap;}\n:root{--font-display-family:OfflineFraunces;}\n@media(prefers-color-scheme:dark){${dark}}`
for (const locale of locales) {
	const labels: OfflineLabels = JSON.parse(
		await readFile(resolve(app, `src/messages/${locale}/offline.json`), 'utf8'),
	)
	const homeHref = locale === defaultLocale ? '/' : `/${locale}`
	const title = renderToStaticMarkup(<title>{`${labels.title} · Puzzled`}</title>)
	const html = `<!doctype html>\n<html lang="${LOCALE_REGISTRY[locale].tag}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">${title}<style>${css}</style></head><body>${renderToStaticMarkup(<OfflineView labels={labels} homeHref={homeHref} />)}</body></html>\n`
	const output = resolve(
		app,
		locale === defaultLocale ? 'public/offline.html' : `public/offline/${locale}.html`,
	)
	if (process.argv.includes('--check')) {
		if ((await readFile(output, 'utf8')) !== html) {
			throw new Error(`${output} is stale; run bun run scripts/generate-offline.tsx`)
		}
	} else {
		await mkdir(dirname(output), { recursive: true })
		await writeFile(output, html)
	}
	console.log(
		`Offline ${locale} ${process.argv.includes('--check') ? 'checked' : 'generated'} (${Buffer.byteLength(html)} bytes)`,
	)
}

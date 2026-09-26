import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { inboundModuleRedirects } from './src/lib/module-routes'

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts')
const tracingRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nextConfig: NextConfig = {
	output: 'standalone',
	// Pin monorepo tracing so standalone server.js is apps/puzzled/server.js.
	outputFileTracingRoot: tracingRoot,
	transpilePackages: [],
	// Enable React strict mode for better development experience
	reactStrictMode: true,
	// Maps are moved out of the served static directory in the Dockerfile and
	// uploaded to Sylphx Observability at startup; the site never serves them.
	productionBrowserSourceMaps: true,

	// Redirects: active locale aliases and real game renames only.
	// Removed locales (es/ja/ko/de/fr/pt-BR/it/nl/pl/tr/id/th/vi) and dead
	// slugs (worldle/nerdle) are not redirected — no legacy surface.
	async redirects() {
		return [
			// Old BCP-47 locale aliases -> current regional locales
			{ source: '/zh-Hans', destination: '/zh-CN', permanent: true },
			{ source: '/zh-Hans/:path*', destination: '/zh-CN/:path*', permanent: true },
			{ source: '/zh-Hant', destination: '/zh-HK', permanent: true },
			{ source: '/zh-Hant/:path*', destination: '/zh-HK/:path*', permanent: true },
			{ source: '/en', destination: '/', permanent: true },
			{ source: '/en/:path*', destination: '/:path*', permanent: true },
			// Renamed games
			{
				source: '/games/wordle',
				destination: '/games/word-guess',
				permanent: true,
			},
			{
				source: '/games/connections',
				destination: '/games/word-groups',
				permanent: true,
			},
			{
				source: '/games/spelling-bee',
				destination: '/games/word-hive',
				permanent: true,
			},
			{
				source: '/games/quordle',
				destination: '/games/quad-words',
				permanent: true,
			},
			{
				source: '/games/letter-boxed',
				destination: '/games/word-box',
				permanent: true,
			},
			{
				source: '/:locale/games/wordle',
				destination: '/:locale/games/word-guess',
				permanent: true,
			},
			{
				source: '/:locale/games/connections',
				destination: '/:locale/games/word-groups',
				permanent: true,
			},
			{
				source: '/:locale/games/spelling-bee',
				destination: '/:locale/games/word-hive',
				permanent: true,
			},
			{
				source: '/:locale/games/quordle',
				destination: '/:locale/games/quad-words',
				permanent: true,
			},
			{
				source: '/:locale/games/letter-boxed',
				destination: '/:locale/games/word-box',
				permanent: true,
			},
			{
				source: '/games/queens',
				destination: '/games/crowns',
				permanent: true,
			},
			{
				source: '/:locale/games/queens',
				destination: '/:locale/games/crowns',
				permanent: true,
			},
			{
				source: '/games/tango',
				destination: '/games/duo',
				permanent: true,
			},
			{
				source: '/:locale/games/tango',
				destination: '/:locale/games/duo',
				permanent: true,
			},
			...inboundModuleRedirects(),
		]
	},

	// Image optimization
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
			},
			{
				protocol: 'https',
				hostname: 'avatars.githubusercontent.com',
			},
			{
				// Vercel Blob storage for user avatars
				protocol: 'https',
				hostname: '*.public.blob.vercel-storage.com',
			},
		],
	},

	// Headers for security and PWA
	async headers() {
		return [
			// Cache-Control for sensitive API routes (per spec: no caching of personalized/auth content)
			{
				source: '/api/auth/:path*',
				headers: [
					{
						key: 'Cache-Control',
						value: 'no-store, no-cache, must-revalidate, private',
					},
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			{
				source: '/api/admin/:path*',
				headers: [
					{
						key: 'Cache-Control',
						value: 'no-store, no-cache, must-revalidate, private',
					},
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			{
				source: '/api/webhooks/:path*',
				headers: [
					{
						key: 'Cache-Control',
						value: 'no-store, no-cache, must-revalidate, private',
					},
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			// Global security headers
			{
				source: '/:path*',
				headers: [
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=()',
					},
					{
						// HSTS: Enforce HTTPS for 2 years, include subdomains, allow preload
						key: 'Strict-Transport-Security',
						value: 'max-age=63072000; includeSubDomains; preload',
					},
					{
						// COOP: Isolate browsing context while allowing OAuth popups
						// same-origin-allow-popups allows popups for OAuth (Google sign-in) while protecting
						// against cross-origin attacks like Spectre
						key: 'Cross-Origin-Opener-Policy',
						value: 'same-origin-allow-popups',
					},
					{
						// X-XSS-Protection: Legacy XSS protection for older browsers
						// While modern browsers use CSP, this provides defense-in-depth for IE/Safari
						key: 'X-XSS-Protection',
						value: '1; mode=block',
					},
					// Content-Security-Policy is per request (nonce), set in src/proxy.ts.
				],
			},
		]
	},

	// Experimental features
	experimental: {
		// Enable server actions
		serverActions: {
			bodySizeLimit: '2mb',
		},
		// UI-kit barrel: load only the modules a route imports.
		//
		// Measured on Turbopack 16.2.11: this flag ALONE produced byte-identical
		// chunks for the workspace `@sylphx/ui` source package — it resolves subpaths
		// through the package `exports`, and that package ships `src/*.tsx`, not a
		// `dist` index. What actually removed the barrel closure from every route was
		// `"sideEffects": false` in `packages/ui/package.json`, which lets the bundler
		// drop the 36 `export *` re-exports a route never imports. The flag stays
		// because it is the documented upstream mechanism and becomes the effective
		// lever as soon as the package is consumed from `dist`.
		//
		// Regression guard: the first-load byte inventory in this PR (curl every
		// `<script src>`, sum gzip bytes, fail on a budget). Manual today; the CI step
		// that would make it automatic is proposed in the PR body.
		optimizePackageImports: ['@sylphx/ui', '@base-ui/react'],
	},
}

// Compose all config wrappers
// Note: Error tracking via Sylphx Platform SDK (see src/lib/monitoring.ts)
export default withNextIntl(nextConfig)

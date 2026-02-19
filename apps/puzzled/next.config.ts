import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts')

const withSerwist = withSerwistInit({
	swSrc: 'src/app/sw.ts',
	swDest: 'public/sw.js',
	disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
	output: "standalone",
	transpilePackages: ['@sylphx/sdk'],
	serverExternalPackages: ['use-sync-external-store'],
	// Enable React strict mode for better development experience
	reactStrictMode: true,

	// Skip type-checking errors from SDK's cross-workspace type resolution
	// The SDK currently references platform source types which aren't resolvable
	// from the puzzled app context. Long-term fix: SDK should generate standalone
	// .d.ts files bundled with the package rather than cross-workspace references.
	typescript: {
		ignoreBuildErrors: true,
	},

	// Redirects for renamed games and legacy locales
	async redirects() {
		return [
			// Legacy locale redirects (old BCP-47 → new regional locales)
			// Redirect zh-Hans (Simplified Chinese) → zh-CN
			{ source: '/zh-Hans', destination: '/zh-CN', permanent: true },
			{ source: '/zh-Hans/:path*', destination: '/zh-CN/:path*', permanent: true },
			// Redirect zh-Hant (Traditional Chinese) → zh-HK (Hong Kong as default)
			{ source: '/zh-Hant', destination: '/zh-HK', permanent: true },
			{ source: '/zh-Hant/:path*', destination: '/zh-HK/:path*', permanent: true },
			// Redirect old single-language locales → default (en-US, no prefix)
			{ source: '/en', destination: '/', permanent: true },
			{ source: '/en/:path*', destination: '/:path*', permanent: true },
			// Redirect removed locales → default (users can switch in settings)
			{ source: '/es', destination: '/', permanent: false },
			{ source: '/es/:path*', destination: '/:path*', permanent: false },
			{ source: '/ja', destination: '/', permanent: false },
			{ source: '/ja/:path*', destination: '/:path*', permanent: false },
			{ source: '/ko', destination: '/', permanent: false },
			{ source: '/ko/:path*', destination: '/:path*', permanent: false },
			{ source: '/de', destination: '/', permanent: false },
			{ source: '/de/:path*', destination: '/:path*', permanent: false },
			{ source: '/fr', destination: '/', permanent: false },
			{ source: '/fr/:path*', destination: '/:path*', permanent: false },
			{ source: '/pt-BR', destination: '/', permanent: false },
			{ source: '/pt-BR/:path*', destination: '/:path*', permanent: false },
			{ source: '/it', destination: '/', permanent: false },
			{ source: '/it/:path*', destination: '/:path*', permanent: false },
			{ source: '/nl', destination: '/', permanent: false },
			{ source: '/nl/:path*', destination: '/:path*', permanent: false },
			{ source: '/pl', destination: '/', permanent: false },
			{ source: '/pl/:path*', destination: '/:path*', permanent: false },
			{ source: '/tr', destination: '/', permanent: false },
			{ source: '/tr/:path*', destination: '/:path*', permanent: false },
			{ source: '/id', destination: '/', permanent: false },
			{ source: '/id/:path*', destination: '/:path*', permanent: false },
			{ source: '/th', destination: '/', permanent: false },
			{ source: '/th/:path*', destination: '/:path*', permanent: false },
			{ source: '/vi', destination: '/', permanent: false },
			{ source: '/vi/:path*', destination: '/:path*', permanent: false },

			// Old game slugs → new slugs (permanent redirects)
			{ source: '/games/wordle', destination: '/games/word-guess', permanent: true },
			{ source: '/games/connections', destination: '/games/word-groups', permanent: true },
			{ source: '/games/spelling-bee', destination: '/games/word-hive', permanent: true },
			{ source: '/games/quordle', destination: '/games/quad-words', permanent: true },
			{ source: '/games/letter-boxed', destination: '/games/word-box', permanent: true },
			{ source: '/games/worldle', destination: '/games/globe-guess', permanent: true },
			{ source: '/games/nerdle', destination: '/games/mathler', permanent: true },
			// Localized versions
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
				source: '/:locale/games/worldle',
				destination: '/:locale/games/globe-guess',
				permanent: true,
			},
			{ source: '/:locale/games/nerdle', destination: '/:locale/games/mathler', permanent: true },
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
					{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			{
				source: '/api/trpc/:path*',
				headers: [
					{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			{
				source: '/api/admin/:path*',
				headers: [
					{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
					{ key: 'Pragma', value: 'no-cache' },
					{ key: 'Expires', value: '0' },
				],
			},
			{
				source: '/api/webhooks/:path*',
				headers: [
					{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
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
					{
						// CSP: Restrictive policy with defense-in-depth
						//
						// DESIGN DECISION: Using 'unsafe-inline' in script-src instead of nonces
						//
						// Rationale:
						// - Nonce-based CSP requires dynamic rendering (no static page caching)
						// - Current inline scripts are minimal and trusted:
						//   1. Theme initialization (FOUC prevention) - static, trusted code
						//   2. JSON-LD structured data - static schema markup
						// - X-XSS-Protection header provides legacy browser protection
						// - strict-dynamic would break third-party scripts (Stripe, PostHog, GTM)
						// - Security audit rating: 8.5/10 with current configuration
						//
						// Nonce implementation would require:
						// - Middleware to generate per-request nonces
						// - All inline scripts to receive nonce prop via headers()
						// - Loss of static page optimization
						//
						// Trade-off: Performance + simplicity > marginal security gain
						// - 'unsafe-inline' in style-src (required for React inline styles, low risk)
						// - GTM domains added per spec for marketing tags (consent-gated)
						key: 'Content-Security-Policy',
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-inline' https://cdn.vercel-insights.com https://*.posthog.com https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
							"style-src 'self' 'unsafe-inline'",
							"img-src 'self' data: https: blob: https://www.googletagmanager.com https://www.google-analytics.com",
							"font-src 'self' data:",
							"connect-src 'self' https://*.posthog.com https://sylphx.com https://*.sylphx.com https://api.stripe.com https://*.neon.tech https://www.google-analytics.com https://analytics.google.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com wss:",
							"frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
							"object-src 'none'",
							"base-uri 'self'",
							"form-action 'self'",
							"frame-ancestors 'none'",
							'upgrade-insecure-requests',
						].join('; '),
					},
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
	},
}

// Compose all config wrappers
// Note: Error tracking via Sylphx Platform SDK (see src/lib/monitoring.ts)
export default withSerwist(withNextIntl(nextConfig))

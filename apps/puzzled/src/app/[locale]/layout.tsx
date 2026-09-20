import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { WebVitalsReporter } from '@/features/analytics/components/web-vitals-reporter'
import { ApiProvider } from '@/lib/api/provider'
import { routing } from '@/lib/i18n/routing'
import { getAppConfig } from '@/lib/identity/app-config'
import { EMPTY_APP_CONFIG } from '@/lib/identity/dest'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'
import { DeferredMonitoring, DeferredToaster } from '@/shared/components/deferred-shell'
import { PlatformProvider } from '@/shared/components/platform'
import { ThemeProvider } from '@/shared/components/theme'
import '../globals.css'

const inter = Inter({
	variable: '--font-sans-family',
	subsets: ['latin'],
	display: 'swap',
})

/**
 * Display face for headings, the wordmark and hero copy.
 * Friendlier geometry than the body face without hurting legibility.
 */
const plusJakarta = Plus_Jakarta_Sans({
	variable: '--font-display-family',
	subsets: ['latin'],
	display: 'swap',
	weight: ['600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
	variable: '--font-mono-family',
	subsets: ['latin'],
	display: 'swap',
	// Only game rule snippets use the mono face; never block first paint for it.
	preload: false,
})

const SITE_DESCRIPTION =
	'Daily puzzles to challenge your mind. Play Five, Threads, Crowns, Duo, and more. Free every day.'
const SITE_KEYWORDS = [
	'games',
	'puzzles',
	'daily games',
	'brain games',
	'word puzzles',
	'logic puzzles',
]

/**
 * Metadata is request-scoped: canonical/OG/JSON-LD must use the origin actually
 * serving the player (puzzled.gg in production, preview host on Cloud preview),
 * never the localhost dev fallback.
 */
export async function generateMetadata(): Promise<Metadata> {
	const baseUrl = await getRequestSiteOrigin()
	return {
		title: {
			default: 'Puzzled',
			template: '%s | Puzzled',
		},
		description: SITE_DESCRIPTION,
		keywords: SITE_KEYWORDS,
		authors: [{ name: 'Puzzled' }],
		creator: 'Puzzled',
		publisher: 'Puzzled',
		metadataBase: new URL(baseUrl),
		// Canonical, hreflang and social cards are per page: Next replaces these
		// objects wholesale, so a route that only sets a title would otherwise
		// drop the layout's hreflang cluster. Every page calls
		// `buildPageMetadata` instead.
		applicationName: 'Puzzled',
		manifest: '/manifest.webmanifest',
		appleWebApp: {
			capable: true,
			statusBarStyle: 'default',
			title: 'Puzzled',
		},
		formatDetection: {
			telephone: false,
		},
	}
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover', // Required for safe area insets on iOS PWA
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#ffffff' },
		{ media: '(prefers-color-scheme: dark)', color: '#0f172a' },
	],
}

/**
 * Dynamic rendering required for fresh config.
 *
 * Without this, Next.js would cache the layout at build time,
 * and getAppConfig() would only run once (baking OAuth providers,
 * plans, etc. into static HTML).
 *
 * The proxy.ts handles i18n routing, so generateStaticParams is not needed.
 */
export const dynamic = 'force-dynamic'

type Props = {
	children: React.ReactNode
	params: Promise<{ locale: string }>
}

// JSON-LD structured data for SEO
function JsonLd({ baseUrl }: { baseUrl: string }) {
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'Puzzled',
		url: baseUrl,
		logo: `${baseUrl}/icons/icon-512.png`,
		description: SITE_DESCRIPTION,
	}

	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Puzzled',
		url: baseUrl,
		description: SITE_DESCRIPTION,
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${baseUrl}/games?q={search_term_string}`,
			},
			'query-input': 'required name=search_term_string',
		},
	}

	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema with trusted static data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
			/>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema with trusted static data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
			/>
		</>
	)
}

export default async function LocaleLayout({ children, params }: Props) {
	const { locale } = await params
	const baseUrl = await getRequestSiteOrigin()

	// Validate locale
	if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
		notFound()
	}

	// Enable static rendering
	setRequestLocale(locale)

	const [messages, config] = await Promise.all([
		getMessages(),
		withPresentationDeadline(
			getAppConfig({
				appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID,
				platformUrl: process.env.IDENTITY_API_ORIGIN,
			}),
			EMPTY_APP_CONFIG,
		),
	])

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={`${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
		>
			<head>
				{/* Color scheme for proper dark mode handling */}
				<meta name="color-scheme" content="light dark" />
				{/* Favicon icons */}
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
				<link rel="icon" href="/favicon.ico" sizes="48x48" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				{/*
				 * Fonts are self-hosted by next/font, so no Google Fonts preconnect
				 * is needed. Stripe is only contacted when checkout opens.
				 */}
				<link rel="dns-prefetch" href="https://js.stripe.com" />
				{/* FOUC prevention: Apply theme class before React hydration */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script with trusted static code
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var theme = localStorage.getItem('theme');
									var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
									// Stored value is next-themes' key: 'light' | 'dark' | 'system'.
									// 'system' (the default) must follow the OS preference; treating it
									// as unset is what closes the first-paint theme flash for it.
									if (theme === 'dark' || ((!theme || theme === 'system') && systemDark)) {
										document.documentElement.classList.add('dark');
									} else if (theme === 'light') {
										document.documentElement.classList.add('light');
									}
									// Calculate scrollbar width for modal compensation
									var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
									document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
								} catch (e) {
									// localStorage may be unavailable in incognito or when cookies blocked
									// Gracefully fail - theme will apply via CSS prefers-color-scheme fallback
								}
							})();
						`,
					}}
				/>
				<JsonLd baseUrl={baseUrl} />
				{/* MUTATION (throwaway): blocking main-thread work in head */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: throwaway regression probe
					dangerouslySetInnerHTML={{ __html: 'var t=Date.now();while(Date.now()-t<1200){};' }}
				/>
			</head>
			<body className="antialiased">
				<ThemeProvider>
					<PlatformProvider appId={config.app.id} config={config}>
						<ApiProvider>
							<NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
						</ApiProvider>
						{/*
						 * Attached at first paint, not on idle: Event Timing only reports the
						 * interactions it observed, and INP would be biased by a late mount.
						 * Delivery is still batched and only leaves on page hide.
						 */}
						<WebVitalsReporter />
						{/* Off the first paint: hosted toasts and the observability client */}
						<DeferredToaster />
						<DeferredMonitoring />
					</PlatformProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}

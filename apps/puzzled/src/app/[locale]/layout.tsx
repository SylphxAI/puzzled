import { getAppConfig } from '@sylphx/sdk/server'
import { ToastProvider } from '@sylphx/ui'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { WebVitalsReporter } from '@/features/analytics'
import { GlobalErrorHandler, SessionReplayProvider } from '@/features/monitoring'
import { ApiProvider } from '@/lib/api/provider'
import { routing } from '@/lib/i18n/routing'
import { getServerBaseUrl } from '@/lib/utils'
import { PlatformProvider } from '@/shared/components/platform'
import { ThemeProvider } from '@/shared/components/theme'
import '../globals.css'

const inter = Inter({
	variable: '--font-sans',
	subsets: ['latin'],
	display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
	variable: '--font-mono',
	subsets: ['latin'],
	display: 'swap',
})

const baseUrl = getServerBaseUrl()

export const metadata: Metadata = {
	title: {
		default: 'Puzzled',
		template: '%s | Puzzled',
	},
	description: 'Daily puzzles to challenge your mind. Play Wordle, Connections, and more!',
	keywords: ['games', 'puzzles', 'wordle', 'connections', 'daily games', 'brain games'],
	authors: [{ name: 'Puzzled' }],
	creator: 'Puzzled',
	publisher: 'Puzzled',
	metadataBase: new URL(baseUrl),
	alternates: {
		canonical: baseUrl,
		languages: {
			// en-US is default (no prefix in URL)
			'x-default': baseUrl,
			'en-US': baseUrl,
			'en-GB': `${baseUrl}/en-GB`,
			// Chinese regional variants
			'zh-HK': `${baseUrl}/zh-HK`,
			'zh-TW': `${baseUrl}/zh-TW`,
			'zh-CN': `${baseUrl}/zh-CN`,
		},
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		alternateLocale: ['en_GB', 'zh_HK', 'zh_TW', 'zh_CN'],
		url: baseUrl,
		siteName: 'Puzzled',
		title: 'Puzzled',
		description: 'Daily puzzles to challenge your mind',
		images: [
			{
				url: '/og-image.png',
				width: 1200,
				height: 630,
				alt: 'Puzzled',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Puzzled',
		description: 'Daily puzzles to challenge your mind',
		images: ['/og-image.png'],
	},
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
function JsonLd() {
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'Puzzled',
		url: baseUrl,
		logo: `${baseUrl}/og-image.png`,
		sameAs: [],
	}

	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'Puzzled',
		url: baseUrl,
		description: 'Daily puzzles to challenge your mind. Play Wordle, Connections, and more!',
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

	// Validate locale
	if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
		notFound()
	}

	// Enable static rendering
	setRequestLocale(locale)

	// Fetch platform config and messages in parallel
	const appId = process.env.NEXT_PUBLIC_SYLPHX_APP_ID
	const secretKey = process.env.SYLPHX_SECRET_KEY
	const platformUrl = process.env.NEXT_PUBLIC_SYLPHX_URL

	const [messages, config] = await Promise.all([
		getMessages(),
		// Only fetch config if credentials are configured
		appId && secretKey
			? getAppConfig({ secretKey, appId, platformUrl })
			: Promise.resolve(undefined),
	])

	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				{/* Color scheme for proper dark mode handling */}
				<meta name="color-scheme" content="light dark" />
				{/* Favicon icons */}
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				{/* Preconnect to critical third-party origins for performance */}
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link rel="dns-prefetch" href="https://js.stripe.com" />
				<link rel="dns-prefetch" href="https://api.iconify.design" />
				{/* FOUC prevention: Apply theme class before React hydration */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script with trusted static code
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var theme = localStorage.getItem('theme');
									var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
									if (theme === 'dark' || (!theme && systemDark)) {
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
				<JsonLd />
			</head>
			<body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
				<ThemeProvider>
					{appId && config ? (
						<PlatformProvider appId={appId} config={config} platformUrl={platformUrl}>
							<GlobalErrorHandler>
								<SessionReplayProvider>
									<WebVitalsReporter />
									<ApiProvider>
										<NextIntlClientProvider messages={messages}>
											<ToastProvider>{children}</ToastProvider>
										</NextIntlClientProvider>
									</ApiProvider>
								</SessionReplayProvider>
							</GlobalErrorHandler>
						</PlatformProvider>
					) : (
						<ApiProvider>
							<NextIntlClientProvider messages={messages}>
								<ToastProvider>{children}</ToastProvider>
							</NextIntlClientProvider>
						</ApiProvider>
					)}
				</ThemeProvider>
			</body>
		</html>
	)
}

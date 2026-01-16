import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { WebVitalsReporter } from '@/features/analytics'
import { routing } from '@/lib/i18n/routing'
import { getServerBaseUrl } from '@/lib/utils'
import { ThemeProvider } from '@/shared/components/theme'
import { PlatformProvider } from '@/shared/components/platform'
import { ToastProvider } from '@sylphx/ui'
import { TRPCProvider } from '@/trpc'
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
			// English is default and non-prefixed (no /en path)
			'x-default': baseUrl,
			en: baseUrl,
			// Chinese variants use BCP 47 script subtags
			'zh-Hans': `${baseUrl}/zh-Hans`,
			'zh-Hant': `${baseUrl}/zh-Hant`,
			es: `${baseUrl}/es`,
			ja: `${baseUrl}/ja`,
			ko: `${baseUrl}/ko`,
			de: `${baseUrl}/de`,
			fr: `${baseUrl}/fr`,
			'pt-BR': `${baseUrl}/pt-BR`,
			it: `${baseUrl}/it`,
			nl: `${baseUrl}/nl`,
			pl: `${baseUrl}/pl`,
			tr: `${baseUrl}/tr`,
			id: `${baseUrl}/id`,
			th: `${baseUrl}/th`,
			vi: `${baseUrl}/vi`,
		},
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		alternateLocale: [
			'zh_Hans',
			'zh_Hant',
			'es_ES',
			'ja_JP',
			'ko_KR',
			'de_DE',
			'fr_FR',
			'pt_BR',
			'it_IT',
			'nl_NL',
			'pl_PL',
			'tr_TR',
			'id_ID',
			'th_TH',
			'vi_VN',
		],
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

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }))
}

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

	// Load messages for the locale
	const messages = await getMessages()

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
					<PlatformProvider
						appId={process.env.NEXT_PUBLIC_SYLPHX_APP_ID}
						publishableKey={process.env.NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY}
					>
						<WebVitalsReporter />
						<TRPCProvider>
							<NextIntlClientProvider messages={messages}>
								<ToastProvider>{children}</ToastProvider>
							</NextIntlClientProvider>
						</TRPCProvider>
					</PlatformProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}

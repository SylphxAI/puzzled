import { getAllGameMetadata } from '@/games/registry'
import { CONTACT_EMAIL } from '@/lib/config/app'
import { locales } from '@/lib/i18n/config'
import type { MarketingFaqItem } from './marketing-faq'

export type UseCaseCta = {
	label: string
	href: string
}

export type UseCaseWorkflowStep = {
	title: string
	body: string
	groups?: readonly { heading: string; games: string }[]
}

export type UseCaseComparisonRow = {
	feature: string
	columns: readonly [string, string, string]
}

export type UseCaseOffer = {
	name: string
	price: string
	priceCurrency: 'USD' | 'GBP'
}

export type UseCaseSpec = {
	slug: 'daily-word-and-logic-puzzles-online' | 'family-brain-games-no-ads'
	path: '/use-cases/daily-word-and-logic-puzzles-online' | '/use-cases/family-brain-games-no-ads'
	metaTitle: string
	metaDescription: string
	eyebrow: string
	h1: string
	heroSubhead: string
	facts: readonly string[]
	primaryCta: UseCaseCta
	secondaryCta: UseCaseCta
	workflowTitle: string
	workflowSubtitle: string
	workflows: readonly UseCaseWorkflowStep[]
	comparisonTitle: string
	comparisonSubtitle: string
	comparisonHeaders: readonly [string, string, string, string]
	comparisonRows: readonly UseCaseComparisonRow[]
	faqTitle: string
	faqs: readonly MarketingFaqItem[]
	closingCta: {
		title: string
		body: string
		note: string
	}
	softwareName: string
	softwareDescription: string
	offers: readonly UseCaseOffer[]
}

const TOTAL_GAMES = getAllGameMetadata().length

export const USE_CASE_SPECS = {
	'daily-word-and-logic-puzzles-online': {
		slug: 'daily-word-and-logic-puzzles-online',
		path: '/use-cases/daily-word-and-logic-puzzles-online',
		metaTitle: `${TOTAL_GAMES} Daily Word, Logic, Number & Spatial Puzzles Online`,
		metaDescription: `Play ${TOTAL_GAMES} daily word, logic, number, and spatial puzzles in one clean web suite. Today's featured puzzle is free with no account; unlock all ${TOTAL_GAMES} games and the full archive from $4.99/mo.`,
		eyebrow: `${TOTAL_GAMES} daily puzzles · Fresh set at midnight HKT`,
		h1: 'One daily puzzle habit—word, logic, number, and spatial games under one roof.',
		heroSubhead: `Instead of hopping across five cluttered puzzle sites, play ${TOTAL_GAMES} handcrafted daily games in one fast web app. Everyone gets the same daily puzzle set at midnight Hong Kong time, today's featured pick is free with no account, and every finished solve is server-verified so streaks and leaderboards stay honest.`,
		facts: [
			`${TOTAL_GAMES} handcrafted daily games`,
			'1 free daily puzzle, no account needed',
			'Zero ads on puzzle boards',
			'Midnight UTC+8 global reset',
		],
		primaryCta: {
			label: "Play today's free puzzle",
			href: '/?entry_surface=seo_daily-word-and-logic-puzzles-online',
		},
		secondaryCta: {
			label: `Unlock all ${TOTAL_GAMES} games + archive ($0.99 weekend pass or $4.99/mo)`,
			href: '/pricing?entry_surface=seo_daily-word-and-logic-puzzles-online',
		},
		workflowTitle: 'How the daily suite fits together',
		workflowSubtitle:
			'Start free in your browser, move cleanly between puzzle genres, and catch up on missed days anytime.',
		workflows: [
			{
				title: "Open today's free featured puzzle in one tap—no login wall",
				body: 'Every day features a free game from the 5-day rotation (Five, Threads, Crowns, Sudoku, or Mini Grid) ready to play straight in your browser. Ads are never rendered while playing any puzzle board, and finished solves produce a spoiler-free share card.',
			},
			{
				title: `Switch between ${TOTAL_GAMES} word, logic, number, and spatial challenges`,
				body: 'Every daily drop spans four distinct puzzle families with one global seed:',
				groups: [
					{
						heading: 'Word (9)',
						games: 'Five, Threads, Hive, Mini Grid, Rungs, Frame, Quad, Cipher, Hunt.',
					},
					{
						heading: 'Logic (4)',
						games: 'Sudoku, Paint (nonogram), Crowns, Duo.',
					},
					{
						heading: 'Number (2)',
						games: 'Arithmo, Cage Sudoku.',
					},
					{
						heading: 'Spatial (4)',
						games: 'Match, Slides, Path, Spots.',
					},
				],
			},
			{
				title: 'Play any missed day in the archive and keep verified streaks',
				body: `Grab a 3-Day Weekend Pass ($0.99 / £0.79 one-time, no auto-renewal) to test the whole suite, or join Puzzled Plus ($4.99/mo or $39.99/yr | £3.99/mo or £32.99/yr) to unlock all ${TOTAL_GAMES} daily games, the complete past-day archive, detailed stats, and zero ads anywhere on the site.`,
			},
		],
		comparisonTitle: 'How Puzzled compares',
		comparisonSubtitle: 'Verified differences based on shipped Puzzled plans and board rules.',
		comparisonHeaders: [
			'Feature',
			'Scattered Free Puzzle Sites',
			'Legacy Newspaper Subscriptions',
			'Puzzled (puzzled.gg)',
		],
		comparisonRows: [
			{
				feature: 'Game variety',
				columns: [
					'1 game per tab, clunky clones',
					'Word-heavy; separate paid tiers',
					`${TOTAL_GAMES} daily games across Word, Logic, Number & Spatial in one place`,
				],
			},
			{
				feature: 'Free daily play',
				columns: [
					'Aggressive pop-ups & redirects',
					'Hard paywall after a few puzzles',
					'1 featured game free every day, zero account needed, zero board ads',
				],
			},
			{
				feature: 'Leaderboard integrity',
				columns: [
					'Client-side scores easily faked',
					'Basic completion ticks',
					'Server-verified finishes on a single global daily seed',
				],
			},
			{
				feature: 'Pricing',
				columns: [
					'Cluttered ad trackers',
					'$15–$25/mo bundles',
					'Weekend Pass $0.99 (3 days) · Plus $4.99/mo or $39.99/yr · Family (4 seats) $7.99/mo',
				],
			},
		],
		faqTitle: 'Frequently asked questions',
		faqs: [
			{
				question: 'Which puzzles are free on Puzzled?',
				answer:
					'One featured puzzle rotates free every day across Five, Threads, Crowns, Sudoku, and Mini Grid with no account required.',
			},
			{
				question: 'When do new daily puzzles reset?',
				answer: `All ${TOTAL_GAMES} daily puzzles refresh at midnight Hong Kong time (UTC+8) with the same daily set for players worldwide.`,
			},
			{
				question: 'What does Puzzled Plus unlock?',
				answer: `Puzzled Plus unlocks all ${TOTAL_GAMES} daily games, the full archive of past days, per-game stats and streaks, and ad-free play everywhere for $4.99/month or $39.99/year (£3.99/month or £32.99/year).`,
			},
			{
				question: 'Can I try all 19 games without a recurring subscription?',
				answer:
					'Yes. The 3-Day Weekend Plus & Archive Pass gives 3 days of full access for a one-time payment of $0.99 USD or £0.79 GBP with no renewal.',
			},
		],
		closingCta: {
			title: `Start with today's free puzzle, or unlock all ${TOTAL_GAMES} games`,
			body: 'No pop-ups on the puzzle board, server-verified daily streaks, and transparent VAT-inclusive plans.',
			note: `Questions? Email ${CONTACT_EMAIL}`,
		},
		softwareName: 'Puzzled',
		softwareDescription: `${TOTAL_GAMES} daily word, logic, number, and spatial puzzles in one web suite with midnight HKT daily resets, server-verified streaks, and full past-day archive access.`,
		offers: [
			{ name: "Free (Today's featured puzzle)", price: '0', priceCurrency: 'USD' },
			{ name: '3-Day Weekend Plus & Archive Pass', price: '0.99', priceCurrency: 'USD' },
			{ name: 'Puzzled Plus (Monthly)', price: '4.99', priceCurrency: 'USD' },
			{ name: 'Puzzled Plus (Yearly)', price: '39.99', priceCurrency: 'USD' },
		],
	},
	'family-brain-games-no-ads': {
		slug: 'family-brain-games-no-ads',
		path: '/use-cases/family-brain-games-no-ads',
		metaTitle: 'Ad-Free Daily Brain Games for Families (4 Seats)',
		metaDescription:
			'Clean, distraction-free daily word, math, and logic puzzles for up to 4 family members—each with separate streaks and stats. Zero in-game ads, 8 languages. Family plan from $7.99/mo or £6.49/mo.',
		eyebrow: 'Up to 4 family seats · Zero in-game ads',
		h1: 'Clean brain games the whole family can play—with separate streaks and zero distractions.',
		heroSubhead: `Most puzzle apps interrupt every round with loud video ads and dark-pattern timers. Puzzled never shows an ad while you are solving a puzzle—and Puzzled Plus Family gives up to four people full, 100% ad-free access to all ${TOTAL_GAMES} daily games and past archives, each with their own stats, streaks, and preferred language.`,
		facts: [
			'4 individual accounts, 1 plan',
			'Zero ads while playing',
			'Zero ads anywhere on Plus Family',
			`${locales.length} UI languages per member`,
		],
		primaryCta: {
			label: 'Start Puzzled Plus Family (4 seats)',
			href: '/pricing?entry_surface=seo_family-brain-games-no-ads#family',
		},
		secondaryCta: {
			label: "Try today's free puzzle first",
			href: '/?entry_surface=seo_family-brain-games-no-ads',
		},
		workflowTitle: 'Built for multi-person households',
		workflowSubtitle:
			'Separate streaks, eight UI languages, and zero interruptions on puzzle boards.',
		workflows: [
			{
				title: 'Zero interruptions while solving—for everyone',
				body: 'Even on the free daily pick, Puzzled never puts banners, pop-ups, or video ads on a puzzle board. Upgrade to Puzzled Plus Family and every screen—including the archive index and result cards—stays 100% ad-free.',
			},
			{
				title: 'One family plan covers 4 individual accounts',
				body: 'Subscribe once ($7.99/mo or $64.99/yr USD · £6.49/mo or £52.99/yr GBP—about $1.35/person/month on yearly) and invite up to 3 family members via an invite link. Everyone keeps their own login, streak, and solve history, and can compare spoiler-free result cards at the dinner table.',
			},
			{
				title: 'Eight languages so grandparents, parents, and kids play comfortably',
				body: 'Each member sets their own interface language independently across English (US & UK), 繁體中文 (香港 & 台灣), 简体中文, 日本語, Español, and Português (Brasil).',
			},
		],
		comparisonTitle: 'Why households pick Puzzled Plus Family',
		comparisonSubtitle: 'One VAT-inclusive subscription replaces up to four individual plans.',
		comparisonHeaders: [
			'Feature',
			'Ad-Supported Puzzle Apps',
			'Individual Subscriptions × 4',
			'Puzzled Plus Family (puzzled.gg)',
		],
		comparisonRows: [
			{
				feature: 'In-game distractions',
				columns: [
					'Video ads between rounds, coin shops',
					'Ad-free, but 4 separate bills',
					'Zero ads on boards or anywhere else',
				],
			},
			{
				feature: 'Seats & progress',
				columns: [
					'Shared tablet = overwritten stats',
					'$20+/mo for 4 accounts',
					'Up to 4 separate accounts, each with private streaks & stats',
				],
			},
			{
				feature: 'Language support',
				columns: [
					'Usually English-only',
					'Varies',
					'8 locales selectable per player (en-US, en-GB, zh-HK, zh-TW, zh-CN, ja, es, pt-BR)',
				],
			},
			{
				feature: 'Family price (VAT incl.)',
				columns: [
					'Free with data/ad trackers',
					'4 × $4.99 = $19.96/mo',
					'$7.99/mo or $64.99/yr USD · £6.49/mo or £52.99/yr GBP',
				],
			},
		],
		faqTitle: 'Frequently asked questions',
		faqs: [
			{
				question: 'Are there ads while playing Puzzled?',
				answer:
					'No. Puzzled never shows ads while a puzzle is being played, and Puzzled Plus and Puzzled Plus Family accounts have zero ads anywhere on the site.',
			},
			{
				question: 'How many people does Puzzled Plus Family cover?',
				answer:
					'Puzzled Plus Family covers up to 4 people (the plan owner plus 3 invited members), each with their own account, streaks, and stats.',
			},
			{
				question: 'Can family members use different languages?',
				answer:
					'Yes. Each player can choose from 8 locales: en-US, en-GB, zh-HK, zh-TW, zh-CN, ja, es, and pt-BR.',
			},
			{
				question: 'How much does Puzzled Plus Family cost?',
				answer:
					'Puzzled Plus Family is $7.99/month or $64.99/year USD (£6.49/month or £52.99/year GBP), VAT inclusive.',
			},
		],
		closingCta: {
			title: 'One subscription, four separate daily streaks',
			body: `Share all ${TOTAL_GAMES} daily games, the full archive, and ad-free play across four family accounts.`,
			note: `Questions? Email ${CONTACT_EMAIL}`,
		},
		softwareName: 'Puzzled Plus Family',
		softwareDescription:
			'Ad-free daily word, logic, number, and spatial brain games for up to 4 family members, each with their own streaks, stats, and full archive access.',
		offers: [
			{ name: 'Puzzled Plus Family (Monthly, 4 seats)', price: '7.99', priceCurrency: 'USD' },
			{ name: 'Puzzled Plus Family (Yearly, 4 seats)', price: '64.99', priceCurrency: 'USD' },
			{ name: 'Puzzled Plus Family (Yearly GBP, 4 seats)', price: '52.99', priceCurrency: 'GBP' },
		],
	},
} as const satisfies Record<string, UseCaseSpec>

export type UseCaseSlug = keyof typeof USE_CASE_SPECS

export function buildUseCaseJsonLd(spec: UseCaseSpec, origin = 'https://puzzled.gg') {
	const baseOrigin = origin.replace(/\/+$/, '')
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'SoftwareApplication',
				name: spec.softwareName,
				applicationCategory: 'GameApplication',
				operatingSystem: 'Web',
				inLanguage: [...locales],
				url: `${baseOrigin}${spec.path}`,
				description: spec.softwareDescription,
				offers: spec.offers.map((offer) => ({
					'@type': 'Offer',
					name: offer.name,
					price: offer.price,
					priceCurrency: offer.priceCurrency,
				})),
				publisher: {
					'@type': 'Organization',
					name: 'Sylphx Limited',
					url: 'https://sylphx.com',
					email: CONTACT_EMAIL,
				},
			},
			{
				'@type': 'FAQPage',
				mainEntity: spec.faqs.map((faq) => ({
					'@type': 'Question',
					name: faq.question,
					acceptedAnswer: {
						'@type': 'Answer',
						text: faq.answer,
					},
				})),
			},
		],
	}
}

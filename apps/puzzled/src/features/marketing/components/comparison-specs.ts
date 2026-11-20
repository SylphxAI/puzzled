import { getAllGameMetadata } from '@/games/registry'
import type { GameCategory } from '@/games/types'
import { FAMILY_SEATS, listPrice, offerPrice } from './catalogue-prices'
import { COMPARISON_HUB_PATH, COMPARISON_SLUGS, type ComparisonSlug } from './comparison-slugs'
import type { MarketingFaqItem } from './marketing-faq'
import type { UseCaseCta, UseCaseOffer } from './use-case-specs'

export type ComparisonRow = {
	feature: string
	them: string
	us: string
}

export type ComparisonPoint = {
	title: string
	body: string
}

export type ComparisonPairing = {
	/** The other publisher's game, named only to describe it (nominative use). */
	theirs: string
	/** Our game's catalogue slug; the link and name come from the registry. */
	slug: string
	why: string
}

export type ComparisonSpec = {
	slug: ComparisonSlug
	path: `/vs/${ComparisonSlug}`
	/** Short name of the product compared, as players search for it. */
	rival: string
	metaTitle: string
	metaDescription: string
	eyebrow: string
	h1: string
	lead: string
	facts: readonly string[]
	verdictTitle: string
	verdict: readonly string[]
	primaryCta: UseCaseCta
	secondaryCta: UseCaseCta
	tableTitle: string
	tableSubtitle: string
	rows: readonly ComparisonRow[]
	theirStrengthsTitle: string
	theirStrengths: readonly ComparisonPoint[]
	ourStrengthsTitle: string
	ourStrengths: readonly ComparisonPoint[]
	pairingsTitle: string
	pairingsSubtitle: string
	pairings: readonly ComparisonPairing[]
	faqTitle: string
	faqs: readonly MarketingFaqItem[]
	closingCta: { title: string; body: string }
	/** Independence and trademark notice, plus the date the rival's facts were read. */
	disclaimer: string
	/** One line for the comparison's entry in `/llms.txt`. */
	llmsSummary: string
	softwareName: string
	softwareDescription: string
	offers: readonly UseCaseOffer[]
}

const GAMES = getAllGameMetadata()
const TOTAL_GAMES = GAMES.length
const countIn = (category: GameCategory) =>
	GAMES.filter((game) => game.category === category).length
const PASS = listPrice('puzzled_starter_unlock')
const PLUS_MONTH = listPrice('plus_individual_monthly')
const PLUS_YEAR = listPrice('plus_individual_yearly')
const FAMILY_MONTH = listPrice('plus_family_monthly')
const FAMILY_YEAR = listPrice('plus_family_yearly')

/** Query string that attributes a visit to one comparison page. */
const entry = (slug: ComparisonSlug) => `entry_surface=seo_vs-${slug}`

/** Every registered game counted once, by category ("9 word, 4 logic, ..."). */
const LINEUP = `${countIn('word')} word, ${countIn('logic')} logic, ${countIn('math')} number and ${countIn('spatial')} spatial`

/** Tryit's side of the price question, the same on every comparison. */
const TRYIT_PRICES = `Tryit's 3 daily picks are free. To open all ${TOTAL_GAMES} games and the archive: a 3-Day Pass is ${PASS} once, Tryit Plus is ${PLUS_MONTH}/month or ${PLUS_YEAR}/year, and Tryit Family (up to ${FAMILY_SEATS} people) is ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year, VAT included.`

const NEW_PUZZLES_FAQ: MarketingFaqItem = {
	question: 'When do new Tryit puzzles come out?',
	answer: `Every day at midnight Hong Kong time (UTC+8). All ${TOTAL_GAMES} games refresh together, and everyone gets the same set.`,
}

const PASS_STRENGTH: ComparisonPoint = {
	title: `A ${PASS} pass, not a contract`,
	body: 'The 3-Day Pass opens every game and every past day for 3 days with one payment and no renewal. Perfect for a long weekend of catching up.',
}

const SOFTWARE = {
	softwareName: 'Tryit',
	softwareDescription: `${TOTAL_GAMES} daily word, logic, number and spatial puzzles in one web app. Pick any 3 to play free every day with no account; Tryit Plus opens every game and the full archive.`,
	offers: [
		{ name: 'Free (any 3 games a day)', price: '0', priceCurrency: 'USD' },
		{ name: '3-Day Pass', price: offerPrice('puzzled_starter_unlock'), priceCurrency: 'USD' },
		{
			name: 'Tryit Plus (Monthly)',
			price: offerPrice('plus_individual_monthly'),
			priceCurrency: 'USD',
		},
		{
			name: 'Tryit Plus (Yearly)',
			price: offerPrice('plus_individual_yearly'),
			priceCurrency: 'USD',
		},
		{
			name: 'Tryit Family (Monthly)',
			price: offerPrice('plus_family_monthly'),
			priceCurrency: 'USD',
		},
		{
			name: 'Tryit Family (Yearly)',
			price: offerPrice('plus_family_yearly'),
			priceCurrency: 'USD',
		},
	],
} as const satisfies Pick<ComparisonSpec, 'softwareName' | 'softwareDescription' | 'offers'>

/**
 * Rival facts are limited to what each company states itself, read 2026-11-18:
 * - NYT Games: the NYT Help Center "New York Times Games Subscription",
 *   "Wordle" and "Connections" articles. Third-party lists disagree on which NYT
 *   games are free, so the page names only Wordle and Connections as free and
 *   quotes no NYT price.
 * - Lumosity: Lumosity Help Center ("Free Account vs Premium", "Where are the
 *   free games?", "Types of subscriptions"), lumosity.com/en/brain-games and the
 *   US App Store listing (id577232024), whose in-app list runs $11.99 to $89.00.
 *   The purchase page needs a login, so no plan-by-plan price is quoted.
 * - LinkedIn Games: linkedin.com/games (nine games) and the LinkedIn Help
 *   article "Games on LinkedIn" (free for members and guests, midnight PT).
 * - Elevate: The Mind Company's Elevate page (free = one three-game workout a
 *   day with an account; Premium $39.99/year with a 7-day trial or $9.99/month,
 *   US App Store), Elevate Support (no desktop version; iOS and Android) and
 *   the US App Store listing (id875063456: Editors' Choice, 4.8, 547K ratings).
 * - Puzzmo: puzzmo.com, the Puzzmo FAQ (what Plus adds, second family
 *   profile), the US App Store listing (id6714482734: Plus $3.99 monthly,
 *   $39.99 yearly; iPhone, iPad, Mac) and Hearst's 19 May 2025 iPhone launch
 *   release (10,000+ puzzle archive for subscribers). Guests can play on
 *   puzzmo.com, so the page draws no account contrast.
 * - Brilliant: brilliant.org (Koji tutor, topics from grade 5 to college, ACS
 *   WASC accreditation, kidSAFE COPPA seal, 5,000+ schools), brilliant.org/premium
 *   and the Brilliant Help Center ("What's the difference between free and
 *   Premium?": 2 concepts or practice sets a day, in order, occasional ads,
 *   a limited Koji preview; "How do I get started?": a free account by email,
 *   Google or Apple; "How much does Brilliant Premium cost?": monthly, annual
 *   and a Family Plan for up to 6, priced on the subscription page with
 *   occasional discounts; "Where can I use Brilliant?": web, iOS, Android).
 *   Brilliant varies its price by plan and offer, so no Brilliant price is quoted.
 *   Operator: Brilliant Worldwide, Inc. (Terms of Use, Privacy Policy).
 * - Wordle: The New York Times Help Center ("Wordle" and "New York Times Games
 *   Subscription" articles): one free daily 5-letter word puzzle in 6 tries on
 *   web and in the NYT Games app; Wordle Bot and the Wordle archive (going back
 *   to June 2021) come with an NYT Games subscription. Prices vary by country
 *   and offer, so no NYT price is quoted.
 */
export const COMPARISON_SPECS = {
	'nyt-games': {
		slug: 'nyt-games',
		path: '/vs/nyt-games',
		rival: 'NYT Games',
		metaTitle: `Tryit vs NYT Games: ${TOTAL_GAMES} Daily Puzzles, Any 3 Free`,
		metaDescription: `Tryit vs NYT Games, honestly compared. Tryit has ${TOTAL_GAMES} daily word, logic, number and spatial puzzles; pick any 3 free every day with no login and no ads while you play. ${PASS} one-time 3-Day Pass.`,
		eyebrow: 'Tryit vs NYT Games · An honest comparison',
		h1: `Love NYT Games? Meet ${TOTAL_GAMES} more daily puzzles, any 3 free.`,
		lead: `NYT Games is the home of Wordle, Connections, Spelling Bee and the Crossword. Tryit is a different daily habit: ${TOTAL_GAMES} word, logic, number and spatial puzzles in one place, and you pick any 3 to play free every day with no login and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No account needed',
			`${PASS} 3-Day Pass, one time`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose NYT Games for the full-size, edited daily Crossword, the Spelling Bee and native iOS and Android apps.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzle types in one place, 3 free picks a day without an account, and a ${PASS} pass with no renewal.`,
			'Plenty of puzzle fans do both: keep the Crossword, add three Tryit games for variety.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('nyt-games')}` },
		secondaryCta: {
			label: `See the ${PASS} 3-Day Pass`,
			href: `/pricing?${entry('nyt-games')}`,
		},
		tableTitle: 'Tryit and NYT Games side by side',
		tableSubtitle:
			'What each one offers a daily puzzle player today. NYT details come from The New York Times Help Center.',
		rows: [
			{
				feature: 'Daily games',
				them: 'The Crossword, The Mini, Wordle, Connections, Spelling Bee, Strands, Letter Boxed, Tiles, Sudoku, Pips and more',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: 'Some games, including Wordle and Connections; a Games subscription opens every game',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Account to start',
				them: 'Recommended, to keep streaks and stats across devices',
				us: 'Not needed for the free picks; sign in to keep streaks and stats across devices',
			},
			{
				feature: 'Crossword',
				them: 'Full-size, edited daily Crossword plus The Mini and The Midi, with an archive back to 1993',
				us: 'Mini Grid, a quick 5×5 daily crossword',
			},
			{
				feature: 'Try everything, no commitment',
				them: 'Games subscription, billed every 4 weeks or yearly',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
			{
				feature: 'Ongoing plans',
				them: 'Prices vary by country and current offer; see nytimes.com',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Where you play',
				them: 'Web, plus the NYT Games app for iOS and Android',
				us: 'Any browser on phone, tablet or desktop; nothing to install',
			},
			{
				feature: 'Sharing',
				them: 'Shareable results for games such as Wordle and Connections',
				us: 'A spoiler-free result card for every game: your pattern and time, never the answer',
			},
		],
		theirStrengthsTitle: 'Where NYT Games shines',
		theirStrengths: [
			{
				title: 'The Crossword',
				body: 'A full-size, edited daily crossword, with subscribers getting it the evening before print and an archive of more than 10,000 puzzles going back to 1993.',
			},
			{
				title: 'Iconic originals',
				body: 'Wordle, Connections, Spelling Bee, Strands and Letter Boxed all live there, and Wordle and Connections are free to play.',
			},
			{
				title: 'Native apps',
				body: 'The NYT Games app for iOS and Android puts the daily lineup one tap away on your phone.',
			},
		],
		ourStrengthsTitle: 'Why puzzle fans pick Tryit',
		ourStrengths: [
			{
				title: `${TOTAL_GAMES} daily games in one place`,
				body: 'Word games, logic grids, number puzzles and spatial challenges, refreshed together at midnight Hong Kong time (UTC+8). Same set for everyone, so results compare fairly.',
			},
			{
				title: 'Any 3 free, every day',
				body: 'Choose your own three from the full lineup. No account, no card, and no ads while you play.',
			},
			PASS_STRENGTH,
			{
				title: `One plan for up to ${FAMILY_SEATS} people`,
				body: `Tryit Family covers up to ${FAMILY_SEATS} accounts, each with their own streaks and stats, for ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year.`,
			},
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Tryit has its own games, not copies of NYT puzzles. These are the closest matches by style.',
		pairings: [
			{ theirs: 'Wordle', slug: 'word-guess', why: 'Guess the 5-letter word in 6 tries.' },
			{ theirs: 'Connections', slug: 'word-groups', why: 'Sort 16 words into 4 groups of 4.' },
			{
				theirs: 'Spelling Bee',
				slug: 'word-hive',
				why: 'Make as many words as you can from 7 letters.',
			},
			{ theirs: 'The Mini', slug: 'crossword', why: 'A quick 5×5 crossword.' },
			{ theirs: 'Strands', slug: 'word-search', why: 'Find the hidden words in a themed grid.' },
			{
				theirs: 'Pips',
				slug: 'pip-place',
				why: 'Place dominoes so every region follows its rule.',
			},
			{
				theirs: 'Sudoku',
				slug: 'sudoku',
				why: 'Classic 9×9 Sudoku, with Cage Sudoku for a harder grid.',
			},
		],
		faqTitle: 'Tryit vs NYT Games: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to NYT Games?',
				answer: `Tryit is free to start: pick any 3 of its ${TOTAL_GAMES} daily games every day, with no account and no ads while you play. Tryit Plus or a 3-Day Pass opens every game and the archive. Tryit is independent and not affiliated with The New York Times.`,
			},
			{
				question: 'Can I play Wordle, Connections or Spelling Bee on Tryit?',
				answer:
					'No. Those games belong to The New York Times. Tryit has its own daily games in similar styles: Five (guess the 5-letter word), Threads (find 4 groups of 4), Hive (words from 7 letters) and Mini Grid (a 5×5 crossword).',
			},
			{
				question: 'How much does Tryit cost compared with NYT Games?',
				answer: `${TRYIT_PRICES} NYT Games prices vary by country and offer, so check nytimes.com for current rates.`,
			},
			{
				question: 'Does Tryit have a full-size crossword like the NYT Crossword?',
				answer:
					"Not today. Tryit's crossword is Mini Grid, a 5×5 daily. If the full-size Crossword is your main habit, NYT Games is the better fit, and many players keep it and add Tryit for variety.",
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by The New York Times Company. NYT Games, Wordle, Connections, Spelling Bee, Strands, Letter Boxed, Tiles, Pips, The Crossword, The Mini and The Midi are trademarks of The New York Times Company, named here only to compare. NYT Games details were checked against The New York Times Help Center on 18 November 2026.',
		llmsSummary: `How Tryit's ${TOTAL_GAMES} daily games and 3 free daily picks compare with NYT Games, and which Tryit games suit Wordle, Connections and Spelling Bee fans.`,
		...SOFTWARE,
	},
	lumosity: {
		slug: 'lumosity',
		path: '/vs/lumosity',
		rival: 'Lumosity',
		metaTitle: `Tryit vs Lumosity: A Free Alternative, ${TOTAL_GAMES} Daily Puzzles`,
		metaDescription: `Looking for a free Lumosity alternative? Tryit has ${TOTAL_GAMES} daily word, logic, number and spatial puzzles in your browser. Pick any 3 free every day: no app, no sign-up, no test first. Tryit Plus ${PLUS_MONTH}/month.`,
		eyebrow: 'Tryit vs Lumosity · An honest comparison',
		h1: `Daily brain games with no app and no sign-up. Pick any 3 of ${TOTAL_GAMES}, free.`,
		lead: `Lumosity is a brain-training program: you make an account, take a Fit Test, then play the workouts it picks for you. Tryit is a lighter daily habit: ${TOTAL_GAMES} word, logic, number and spatial puzzles in your browser, and you choose any 3 to play free every day, with no account and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No app, no account',
			`Tryit Plus ${PLUS_MONTH}/month`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose Lumosity for a structured training program: 40+ adaptive games, personalized workouts, detailed performance insights and apps for iPhone, iPad and Android.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzles you pick yourself, 3 free a day in any browser with no account, and all of them with Tryit Plus for ${PLUS_MONTH}/month.`,
			'Tryit makes no brain-training claims. It is a fresh set of good puzzles every day, ready in one tap.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('lumosity')}` },
		secondaryCta: { label: 'See Tryit Plus plans', href: `/pricing?${entry('lumosity')}` },
		tableTitle: 'Tryit and Lumosity side by side',
		tableSubtitle:
			'What each one offers a daily player today. Lumosity details come from the Lumosity Help Center and its US App Store listing.',
		rows: [
			{
				feature: 'Daily games',
				them: '40+ games for memory, speed, attention, flexibility and problem solving, plus word and math games, served as daily workouts',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: '3 games a day, picked for you from a rotation, with a free account',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Before your first game',
				them: 'Create an account and take the 10-minute Fit Test',
				us: 'Nothing. Tap a game and play; sign in later to keep streaks and stats across devices',
			},
			{
				feature: 'Where you play',
				them: 'The website after you log in, or the Lumosity app for iPhone, iPad and Android',
				us: 'Any browser on phone, tablet or desktop; nothing to install',
			},
			{
				feature: 'Paid plans',
				them: 'Premium monthly, yearly, two-year and lifetime plans; the US App Store lists them from $11.99 to $89.00. Family plans for up to 5 people',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Try everything, no commitment',
				them: 'A Premium plan, from one month to lifetime',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
			{
				feature: 'Progress',
				them: 'Performance insights, with scores compared to others in your age group',
				us: 'Streaks and stats when you sign in, and a spoiler-free result card to share: your pattern and time, never the answer',
			},
		],
		theirStrengthsTitle: 'Where Lumosity shines',
		theirStrengths: [
			{
				title: 'A full training program',
				body: 'Premium builds personalized daily workouts from 40+ games that adapt as you play, with modes for quick sessions, weaker skills, language and math.',
			},
			{
				title: 'Insight into how you play',
				body: 'Performance insights track your scores over time and show how they compare with others your age.',
			},
			{
				title: 'Rooted in research tasks',
				body: 'Lumosity turns established cognitive tasks into games and collaborates with university researchers worldwide.',
			},
		],
		ourStrengthsTitle: 'Why players pick Tryit',
		ourStrengths: [
			{
				title: 'You choose your free 3',
				body: `Pick any 3 from the full lineup of ${TOTAL_GAMES}, every day. No account, no card and no ads while you play.`,
			},
			{
				title: 'Playing in seconds',
				body: 'No download, no sign-up and no test first. Open tryit.fun on any phone, tablet or computer and the first puzzle is one tap away.',
			},
			{
				title: `${TOTAL_GAMES} puzzles, fresh every day`,
				body: 'Word games, logic grids, number puzzles and spatial challenges, refreshed together at midnight Hong Kong time (UTC+8). Same set for everyone, so results compare fairly.',
			},
			PASS_STRENGTH,
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Tryit has its own puzzles, not copies of Lumosity games. These are the closest matches by skill.',
		pairings: [
			{
				theirs: 'Pet Detective',
				slug: 'number-path',
				why: 'Plan one route through every cell, in number order.',
			},
			{
				theirs: 'Masterpiece',
				slug: 'pip-place',
				why: 'Fit dominoes into the grid so every region follows its rule.',
			},
			{
				theirs: 'Fuse Clues',
				slug: 'crowns',
				why: 'Pure deduction: one crown per row, column and colored region.',
			},
			{
				theirs: 'Star Search',
				slug: 'pattern-match',
				why: 'Spot sets of 3 cards that are all the same or all different.',
			},
			{
				theirs: 'Word Bubbles',
				slug: 'word-hive',
				why: 'Make as many words as you can from 7 letters.',
			},
			{ theirs: 'Raindrops', slug: 'arithmo', why: 'Find the hidden equation in 6 tries.' },
		],
		faqTitle: 'Tryit vs Lumosity: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to Lumosity?',
				answer: `If you want daily puzzles rather than a training program, yes. Pick any 3 of Tryit's ${TOTAL_GAMES} daily games every day for free, with no app, no account and no ads while you play. Tryit Plus or a 3-Day Pass opens every game and the archive. Tryit is independent and not affiliated with Lumos Labs.`,
			},
			{
				question: 'Do I need to download an app or take a test first?',
				answer:
					'No. Tryit runs in any browser on phone, tablet or desktop. Open a game and start; there is no sign-up, quiz or test. Make an account only if you want to keep streaks and stats across devices.',
			},
			{
				question: 'How much does Tryit cost compared with Lumosity?',
				answer: `${TRYIT_PRICES} Lumosity Premium prices vary by plan, platform and country; the US App Store lists them from $11.99 to $89.00.`,
			},
			{
				question: 'Is Tryit brain training?',
				answer:
					'No. Tryit is a set of daily puzzles, made to be quick and fun, and it makes no claims about memory or cognition. If you want a structured program with performance insights, Lumosity is built for that, and you can still add a few Tryit puzzles to your day.',
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no app, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by Lumos Labs, Inc. Lumosity, Fit Test and the Lumosity game names on this page belong to Lumos Labs, Inc. and are named here only to compare. Lumosity details were checked against the Lumosity Help Center, lumosity.com and its US App Store listing on 18 November 2026.',
		llmsSummary: `A free Lumosity alternative for daily puzzles: any 3 of ${TOTAL_GAMES} games free in the browser with no app, account or test first, compared with Lumosity's brain-training program.`,
		...SOFTWARE,
	},
	'linkedin-games': {
		slug: 'linkedin-games',
		path: '/vs/linkedin-games',
		rival: 'LinkedIn Games',
		metaTitle: 'Tryit vs LinkedIn Games: Puzzles Like Queens, Tango and Zip',
		metaDescription: `Like LinkedIn's Queens, Tango and Zip? Tryit has ${TOTAL_GAMES} daily logic, word, number and spatial puzzles away from your work feed. Pick any 3 free every day, no login and no ads while you play.`,
		eyebrow: 'Tryit vs LinkedIn Games · An honest comparison',
		h1: `Finished Queens already? Here are ${TOTAL_GAMES} more daily puzzles, any 3 free.`,
		lead: `LinkedIn Games puts quick daily puzzles like Queens, Tango and Zip inside your professional network. Tryit is puzzles and nothing else: ${TOTAL_GAMES} word, logic, number and spatial games with no feed and no work network. You pick any 3 to play free every day, with no login and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No login, no feed',
			`${PASS} 3-Day Pass, one time`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose LinkedIn Games for free daily puzzles you can compare with your connections and colleagues, right inside LinkedIn.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzle types in one place, any 3 free every day, with no feed and no login.`,
			'Or do both: finish Queens and Zip, then pick three Tryit games for the rest of your break.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('linkedin-games')}` },
		secondaryCta: {
			label: `See the ${PASS} 3-Day Pass`,
			href: `/pricing?${entry('linkedin-games')}`,
		},
		tableTitle: 'Tryit and LinkedIn Games side by side',
		tableSubtitle:
			"What each one offers a daily puzzle player today. LinkedIn details come from LinkedIn's games page and Help Center.",
		rows: [
			{
				feature: 'Daily games',
				them: 'Queens, Tango, Zip, Mini Sudoku, Patches, Pinpoint, Crossclimb, Wend and Sumbreak, one puzzle each a day',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: 'Every game, for LinkedIn members and guests',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Where you play',
				them: 'Inside LinkedIn: its games hub, your feed, notifications and the LinkedIn app',
				us: 'tryit.fun in any browser on phone, tablet or desktop: puzzles only, no feed',
			},
			{
				feature: 'Leaderboards',
				them: 'Rank against your connections, plus top companies and schools',
				us: 'A daily leaderboard, and a spoiler-free result card you can send to anyone',
			},
			{
				feature: 'New puzzles',
				them: 'Midnight Pacific Time',
				us: 'Midnight Hong Kong time (UTC+8), the same set for everyone',
			},
			{
				feature: 'Try everything, no commitment',
				them: 'Nothing to buy: every daily game is free',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
		],
		theirStrengthsTitle: 'Where LinkedIn Games shines',
		theirStrengths: [
			{
				title: 'Free, every one',
				body: 'Every LinkedIn daily game is free to play, for members and guests alike.',
			},
			{
				title: 'Built for your network',
				body: 'Leaderboards rank you against your connections and show the top companies and schools, so a quick Queens time turns into a conversation.',
			},
			{
				title: 'Expert puzzle making',
				body: 'Mini Sudoku is handcrafted by the originators of Sudoku and a three-time World Sudoku Champion.',
			},
		],
		ourStrengthsTitle: 'Why puzzle fans pick Tryit',
		ourStrengths: [
			{
				title: `${TOTAL_GAMES} daily games in one place`,
				body: 'Logic grids like Crowns, Duo and Path, plus word games, number puzzles and spatial challenges, all refreshed together every day.',
			},
			{
				title: 'Just the puzzles',
				body: 'No feed, no posts and no job alerts beside the board. Open tryit.fun and the puzzle is the whole page.',
			},
			{
				title: 'Any 3 free, every day',
				body: 'Choose your own three from the full lineup. No account, no card and no ads while you play.',
			},
			{
				title: 'Every past day, too',
				body: `Tryit Plus and the 3-Day Pass open the archive, so a day you missed is still there to play. Plus is ${PLUS_MONTH}/month or ${PLUS_YEAR}/year.`,
			},
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Tryit has its own games, not copies of LinkedIn puzzles. These are the closest matches by style.',
		pairings: [
			{
				theirs: 'Queens',
				slug: 'crowns',
				why: 'One crown per row, column and colored region, and no two crowns touching.',
			},
			{ theirs: 'Tango', slug: 'duo', why: 'Balance suns and moons in every row and column.' },
			{
				theirs: 'Zip',
				slug: 'number-path',
				why: 'Draw one line from 1 through every cell, in number order.',
			},
			{
				theirs: 'Mini Sudoku',
				slug: 'sudoku',
				why: 'Classic 9×9 Sudoku, with Cage Sudoku for a harder grid.',
			},
			{
				theirs: 'Crossclimb',
				slug: 'word-ladder',
				why: 'Change one letter at a time to climb from word to word.',
			},
			{
				theirs: 'Pinpoint',
				slug: 'word-groups',
				why: 'Spot what links the words: sort 16 into 4 groups of 4.',
			},
			{ theirs: 'Wend', slug: 'word-search', why: 'Find the hidden words in a themed grid.' },
		],
		faqTitle: 'Tryit vs LinkedIn Games: questions',
		faqs: [
			{
				question: 'Where can I play games like LinkedIn Queens?',
				answer: `On Tryit. Crowns is a daily logic puzzle in the same style: one crown in every row, column and colored region. Duo (suns and moons) and Path (one line through every cell) suit Tango and Zip fans. Pick any 3 of Tryit's ${TOTAL_GAMES} games free every day, no login needed.`,
			},
			{
				question: 'Can I play Queens, Tango or Zip on Tryit?',
				answer:
					'No. Those games belong to LinkedIn. Tryit has its own daily games in similar styles: Crowns, Duo, Path, Sudoku, Rungs (a word ladder), Threads (4 groups of 4) and Hunt (a word search).',
			},
			{
				question: 'Do I need a LinkedIn account to play Tryit?',
				answer:
					'No. Tryit is independent and has no link to LinkedIn, and the 3 free daily picks need no account of any kind. Sign in only if you want to keep streaks and stats across devices.',
			},
			{
				question: 'How much does Tryit cost compared with LinkedIn Games?',
				answer: `LinkedIn's daily games are free. ${TRYIT_PRICES}`,
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no feed, no ads while you play.`,
		},
		disclaimer:
			"Tryit is independent and not affiliated with, endorsed by or sponsored by LinkedIn Corporation. LinkedIn and the names of its games belong to LinkedIn Corporation and are named here only to compare. LinkedIn Games details were checked against LinkedIn's games page and Help Center on 18 November 2026.",
		llmsSummary: `Daily logic, word, number and spatial puzzles like LinkedIn's Queens, Tango and Zip, with no feed or login, and which Tryit games suit each LinkedIn game.`,
		...SOFTWARE,
	},
	elevate: {
		slug: 'elevate',
		path: '/vs/elevate',
		rival: 'Elevate',
		metaTitle: `Tryit vs Elevate: A Free Alternative, ${TOTAL_GAMES} Daily Puzzles`,
		metaDescription: `Looking for a free Elevate alternative? Tryit has ${TOTAL_GAMES} daily word, logic, number and spatial puzzles in any browser, on your phone or your computer. Pick any 3 free every day with no app and no account. Tryit Plus ${PLUS_MONTH}/month.`,
		eyebrow: 'Tryit vs Elevate · An honest comparison',
		h1: `Brain games in your browser, on any screen. Pick any 3 of ${TOTAL_GAMES}, free.`,
		lead: `Elevate is a phone app for skill training: you sign up, and the free version gives you one three-game workout a day. Tryit runs in any browser, on your phone or your computer: ${TOTAL_GAMES} word, logic, number and spatial puzzles, and you choose any 3 to play free every day, with no account and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'Phone, tablet or computer',
			`Tryit Plus ${PLUS_MONTH}/month`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose Elevate for skill training in reading, writing, speaking, math and memory, with personalized workouts in a polished phone app.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzles in any browser, your computer included, with any 3 free every day and no account.`,
			'Tryit makes no brain-training claims. It is a fresh set of good puzzles every day, ready in one tap.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('elevate')}` },
		secondaryCta: { label: 'See Tryit Plus plans', href: `/pricing?${entry('elevate')}` },
		tableTitle: 'Tryit and Elevate side by side',
		tableSubtitle:
			'What each one offers a daily player today. Elevate details come from The Mind Company, Elevate Support and the US App Store.',
		rows: [
			{
				feature: 'Daily games',
				them: '40+ games for reading, writing, speaking, math and memory, served as daily workouts',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: 'One three-game workout a day and a game of the week, with a free account',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Before your first game',
				them: 'Install the app and sign up for an account',
				us: 'Nothing. Tap a game and play; sign in later to keep streaks and stats across devices',
			},
			{
				feature: 'Where you play',
				them: 'The Elevate app for iPhone, iPad and Android; there is no desktop version',
				us: 'Any browser on phone, tablet or desktop; nothing to install',
			},
			{
				feature: 'Daily puzzles',
				them: 'Daily puzzles such as crosswords, and past puzzles, come with Premium',
				us: `${TOTAL_GAMES} daily puzzles, any 3 free; every past day with Tryit Plus or the 3-Day Pass`,
			},
			{
				feature: 'Paid plans',
				them: 'Premium $39.99/year with a 7-day free trial, or $9.99/month, on the US App Store',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Try everything, no commitment',
				them: 'A 7-day free trial of the yearly plan',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
		],
		theirStrengthsTitle: 'Where Elevate shines',
		theirStrengths: [
			{
				title: 'Skills for everyday life',
				body: 'Games built around reading, writing, speaking, math and memory, such as calculating a tip or cutting extra words from an email.',
			},
			{
				title: 'Workouts that adapt',
				body: 'Premium personalizes your daily workout, adjusts difficulty as you improve and tracks your performance over time.',
			},
			{
				title: 'A polished app',
				body: 'An App Store Editors’ Choice, rated 4.8 from more than 500,000 US ratings.',
			},
		],
		ourStrengthsTitle: 'Why players pick Tryit',
		ourStrengths: [
			{
				title: 'Play on any screen',
				body: 'Tryit runs in your browser on a phone, tablet or computer, so your lunch-break puzzle works on your work laptop too. Nothing to install.',
			},
			{
				title: 'You choose your free 3',
				body: `Pick any 3 from the full lineup of ${TOTAL_GAMES}, every day. No account, no card and no ads while you play.`,
			},
			{
				title: 'Daily puzzles, free',
				body: 'Every game is a daily puzzle with a fresh grid at midnight Hong Kong time (UTC+8), the same for everyone, so results compare fairly.',
			},
			PASS_STRENGTH,
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Tryit has its own puzzles, not copies of Elevate games. These are the closest matches by skill.',
		pairings: [
			{ theirs: 'Tipping', slug: 'arithmo', why: 'Find the hidden equation in 6 tries.' },
			{
				theirs: 'Estimation',
				slug: 'killer-sudoku',
				why: 'Sudoku where every cage has to add up to its total.',
			},
			{
				theirs: 'Eloquence',
				slug: 'word-hive',
				why: 'Make as many words as you can from 7 letters.',
			},
			{ theirs: 'Detail', slug: 'cryptogram', why: 'Crack a famous quote, one letter at a time.' },
			{
				theirs: 'Connotation',
				slug: 'word-groups',
				why: 'Spot what links the words: sort 16 into 4 groups of 4.',
			},
			{
				theirs: 'Elevate crosswords',
				slug: 'crossword',
				why: 'A quick 5×5 crossword, free as one of your 3 picks.',
			},
		],
		faqTitle: 'Tryit vs Elevate: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to Elevate?',
				answer: `If you want daily puzzles rather than a training program, yes. Pick any 3 of Tryit's ${TOTAL_GAMES} daily games every day for free, in any browser, with no app, no account and no ads while you play. Tryit Plus or a 3-Day Pass opens every game and the archive. Tryit is independent and not affiliated with Elevate Labs.`,
			},
			{
				question: 'Can I play Tryit on my computer?',
				answer:
					'Yes. Tryit runs in any browser on a computer, tablet or phone, and nothing needs installing. Sign in if you want your streaks and stats to follow you between devices.',
			},
			{
				question: 'How much does Tryit cost compared with Elevate?',
				answer: `${TRYIT_PRICES} Elevate Premium is $39.99 a year with a 7-day free trial, or $9.99 a month, on the US App Store; prices vary by country.`,
			},
			{
				question: 'Is Tryit brain training?',
				answer:
					'No. Tryit is a set of daily puzzles, made to be quick and fun, and it makes no claims about memory or cognition. If you want structured skill training with performance tracking, Elevate is built for that, and you can still add a few Tryit puzzles to your day.',
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, on any screen, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by Elevate Labs, LLC or The Mind Company. Elevate and the Elevate game names on this page belong to their owners and are named here only to compare. Elevate details were checked against The Mind Company’s Elevate page, Elevate Support and the US App Store listing on 18 November 2026.',
		llmsSummary: `A free Elevate alternative that runs in any browser, phone or computer: any 3 of ${TOTAL_GAMES} daily games free with no app or account, compared with Elevate's skill-training app.`,
		...SOFTWARE,
	},
	puzzmo: {
		slug: 'puzzmo',
		path: '/vs/puzzmo',
		rival: 'Puzzmo',
		metaTitle: `Tryit vs Puzzmo: ${TOTAL_GAMES} Daily Puzzles, Any 3 Free`,
		metaDescription: `Tryit vs Puzzmo, honestly compared. Tryit has ${TOTAL_GAMES} daily word, logic, number and spatial puzzles; pick any 3 free every day with no login and no ads while you play. Every past day with Tryit Plus or a ${PASS} 3-Day Pass.`,
		eyebrow: 'Tryit vs Puzzmo · An honest comparison',
		h1: `Finished today's Puzzmo? Here are ${TOTAL_GAMES} more daily puzzles, any 3 free.`,
		lead: `Puzzmo is a daily puzzle page with original games like Cross|word, SpellTower, Typeshift and Flipart. Tryit is ${TOTAL_GAMES} word, logic, number and spatial puzzles in one daily set, and you pick any 3 to play free every day, with no login and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No ads while you play',
			`${PASS} 3-Day Pass, one time`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose Puzzmo for its edited daily Cross|word, original games like SpellTower and Typeshift, and leaderboards with friends.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzle types across word, logic, number and spatial, any 3 free every day with no ads while you play, and a ${PASS} pass with no renewal.`,
			'Or do both: finish the Cross|word, then pick three Tryit games for something different.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('puzzmo')}` },
		secondaryCta: { label: `See the ${PASS} 3-Day Pass`, href: `/pricing?${entry('puzzmo')}` },
		tableTitle: 'Tryit and Puzzmo side by side',
		tableSubtitle:
			'What each one offers a daily puzzle player today. Puzzmo details come from puzzmo.com, its FAQ and the US App Store.',
		rows: [
			{
				feature: 'Daily games',
				them: 'Cross|word, Mini Cross|word, SpellTower, Typeshift, Flipart, Pile-Up Poker, Memoku, Really Bad Chess, Bongo, Circuits and more',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: 'Daily games with ads; some games and puzzles are kept for Puzzmo Plus members',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Ads',
				them: 'Display and video ads unless you have Puzzmo Plus',
				us: 'No ads on a puzzle while you play it',
			},
			{
				feature: 'Where you play',
				them: 'puzzmo.com in a browser, plus an app for iPhone, iPad and Mac',
				us: 'Any browser on phone, tablet or desktop; nothing to install',
			},
			{
				feature: 'Past puzzles',
				them: 'An archive of more than 10,000 puzzles with Puzzmo Plus',
				us: `Every past day of all ${TOTAL_GAMES} games with Tryit Plus or the 3-Day Pass`,
			},
			{
				feature: 'Paid plans',
				them: 'Puzzmo Plus $3.99/month or $39.99/year on the US App Store, with a second profile for a family member',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Try everything, no commitment',
				them: 'Puzzmo Plus by the month or the year',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
		],
		theirStrengthsTitle: 'Where Puzzmo shines',
		theirStrengths: [
			{
				title: 'Original games',
				body: 'SpellTower, Typeshift, Flipart and Really Bad Chess, many of them from the designer Zach Gage.',
			},
			{
				title: 'A friendly crossword',
				body: 'The daily midi Cross|word sits between a mini and a full-size grid, and every clue has an optional easier hint.',
			},
			{
				title: 'A deep archive',
				body: 'Puzzmo Plus opens an archive of more than 10,000 puzzles, with no ads.',
			},
		],
		ourStrengthsTitle: 'Why puzzle fans pick Tryit',
		ourStrengths: [
			{
				title: `${TOTAL_GAMES} daily games in one place`,
				body: 'Word games, logic grids like Sudoku and Crowns, number puzzles and spatial challenges, all refreshed together at midnight Hong Kong time (UTC+8).',
			},
			{
				title: 'Any 3 free, no ads mid-game',
				body: 'Choose your own three from the full lineup. No account, no card and no ads on a puzzle while you play it.',
			},
			PASS_STRENGTH,
			{
				title: `One plan for up to ${FAMILY_SEATS} people`,
				body: `Tryit Family covers up to ${FAMILY_SEATS} accounts, each with their own streaks and stats, for ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year.`,
			},
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Tryit has its own games, not copies of Puzzmo puzzles. These are the closest matches by style.',
		pairings: [
			{ theirs: 'Cross|word', slug: 'crossword', why: 'A quick 5×5 crossword.' },
			{
				theirs: 'Memoku',
				slug: 'sudoku',
				why: 'Classic 9×9 Sudoku, with Cage Sudoku for a harder grid.',
			},
			{
				theirs: 'Pile-Up Poker',
				slug: 'pattern-match',
				why: 'Spot sets of 3 cards that are all the same or all different.',
			},
			{
				theirs: 'Flipart',
				slug: 'pip-place',
				why: 'Fit dominoes into the grid so every region follows its rule.',
			},
			{
				theirs: 'Circuits',
				slug: 'word-ladder',
				why: 'Change one letter at a time to climb from word to word.',
			},
			{ theirs: 'SpellTower', slug: 'word-search', why: 'Find the hidden words in a themed grid.' },
		],
		faqTitle: 'Tryit vs Puzzmo: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to Puzzmo?',
				answer: `Tryit is free to start: pick any 3 of its ${TOTAL_GAMES} daily games every day, with no account and no ads while you play. Tryit Plus or a 3-Day Pass opens every game and the archive. Tryit is independent and not affiliated with Puzzmo or Hearst.`,
			},
			{
				question: 'Can I play SpellTower or Cross|word on Tryit?',
				answer:
					'No. Those games belong to Puzzmo. Tryit has its own daily games in similar styles: Mini Grid (a 5×5 crossword), Hunt (a word search), Rungs (a word ladder), Match (sets of 3 cards) and Sudoku.',
			},
			{
				question: 'How much does Tryit cost compared with Puzzmo?',
				answer: `${TRYIT_PRICES} Puzzmo Plus is $3.99 a month or $39.99 a year on the US App Store.`,
			},
			{
				question: 'Can I play past Tryit puzzles?',
				answer: `Yes. Tryit Plus and the 3-Day Pass open every past day of all ${TOTAL_GAMES} games, so a day you missed is still there to play.`,
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by Puzzmo Inc. or Hearst. Puzzmo and the Puzzmo game names on this page belong to their owners and are named here only to compare. Puzzmo details were checked against puzzmo.com, the Puzzmo FAQ, its US App Store listing and its iPhone launch announcement on 18 November 2026.',
		llmsSummary: `How Tryit's ${TOTAL_GAMES} daily games, 3 free daily picks and archive compare with Puzzmo, and which Tryit games suit Cross|word, SpellTower and Pile-Up Poker fans.`,
		...SOFTWARE,
	},
	brilliant: {
		slug: 'brilliant',
		path: '/vs/brilliant',
		rival: 'Brilliant',
		metaTitle: `Tryit vs Brilliant: ${TOTAL_GAMES} Daily Logic Puzzles, Any 3 Free`,
		metaDescription: `Tryit vs Brilliant, honestly compared. Brilliant teaches math and coding; Tryit has ${TOTAL_GAMES} daily logic, number, word and spatial puzzles, any 3 free in your browser with no account or app. ${PASS} one-time 3-Day Pass.`,
		eyebrow: 'Tryit vs Brilliant · An honest comparison',
		h1: `Like Brilliant's logic problems? Play ${TOTAL_GAMES} daily puzzles, any 3 free.`,
		lead: `Brilliant is a personal tutor for math and coding, with guided, interactive lessons from fractions to calculus and Python. Tryit is a daily puzzle habit: ${TOTAL_GAMES} word, logic, number and spatial puzzles on one page, and you pick any 3 to play free every day with no account, no app and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No account or app',
			`${PASS} 3-Day Pass, one time`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose Brilliant for structured, tutor-guided lessons in math, data, science and coding, from fractions to calculus and Python.',
			`Choose Tryit for ${TOTAL_GAMES} daily logic, number, word and spatial puzzles, any 3 free in your browser right now with no account, and a ${PASS} pass with no renewal.`,
			'Or do both: a Brilliant lesson to learn something new, then three Tryit puzzles to put your reasoning to work.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('brilliant')}` },
		secondaryCta: {
			label: `See the ${PASS} 3-Day Pass`,
			href: `/pricing?${entry('brilliant')}`,
		},
		tableTitle: 'Tryit and Brilliant side by side',
		tableSubtitle:
			'What each one offers today. Brilliant details come from brilliant.org and the Brilliant Help Center.',
		rows: [
			{
				feature: 'What it is',
				them: 'A personal tutor for math and coding: guided, interactive lessons from grade 5 to college, with Koji, a visual tutor',
				us: 'A daily puzzle set: the same fresh puzzles for everyone, refreshed at midnight Hong Kong time',
			},
			{
				feature: 'Daily games',
				them: 'Interactive concepts and practice sets inside topics such as Algebra, Calculus, Logic and Python, with a daily streak to keep',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: '2 concepts or practice sets a day, worked through in order, with occasional ads between concepts',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Account to start',
				them: 'A free account (email, Google or Apple) before your first concept',
				us: 'Not needed for the free picks; sign in to keep streaks and stats across devices',
			},
			{
				feature: 'Try everything, no commitment',
				them: 'Premium by the month or the year; free trials are sometimes offered and ask for payment details',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
			{
				feature: 'Ongoing plans',
				them: 'Premium monthly or annual, and a Family Plan for up to 6; current prices on brilliant.org',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Where you play',
				them: 'Web, plus apps for iOS and Android',
				us: 'Any browser on phone, tablet or desktop; nothing to install',
			},
		],
		theirStrengthsTitle: 'Where Brilliant shines',
		theirStrengths: [
			{
				title: 'Structured courses, start to finish',
				body: 'Topics build step by step from fractions through calculus, with probability, statistics, Python, computer science and AI alongside.',
			},
			{
				title: 'A tutor when you get stuck',
				body: 'Koji asks guiding questions and sketches on a shared canvas, working through each step with you without handing over the answer. Full access comes with Premium.',
			},
			{
				title: 'Built for school',
				body: 'Accredited by ACS WASC, kidSAFE COPPA certified and used in more than 5,000 schools, with homework help and test prep.',
			},
		],
		ourStrengthsTitle: 'Why logic fans pick Tryit',
		ourStrengths: [
			{
				title: `${TOTAL_GAMES} daily puzzles on one page`,
				body: 'Logic grids like Crowns and Duo, number puzzles like Arithmo and Cage Sudoku, spatial puzzles like Slides and Path, plus word games. All refreshed together at midnight Hong Kong time (UTC+8).',
			},
			{
				title: 'Any 3 free, right now',
				body: 'No account, no app and no placement quiz. Open a puzzle in your browser and play, with no ads while you play.',
			},
			PASS_STRENGTH,
			{
				title: 'A puzzle, not homework',
				body: 'Nothing to study and no lesson to finish first. Every game is a complete puzzle you can solve in one sitting, then share without spoiling the answer.',
			},
		],
		pairingsTitle: 'If you like these, try these',
		pairingsSubtitle:
			'Brilliant teaches these ideas in lessons. Tryit turns them into a daily puzzle. These are the closest matches.',
		pairings: [
			{
				theirs: 'contest math',
				slug: 'killer-sudoku',
				why: 'Sudoku where every cage has to add up to its total.',
			},
			{
				theirs: 'logic',
				slug: 'crowns',
				why: 'Pure deduction: one crown per row, column and colored region.',
			},
			{
				theirs: 'order of operations',
				slug: 'arithmo',
				why: 'Find the hidden equation in 6 tries.',
			},
			{
				theirs: 'graph search',
				slug: 'number-path',
				why: 'Plan one route through every cell, in number order.',
			},
			{
				theirs: 'geometric reasoning',
				slug: 'block-slide',
				why: 'Slide the blocks out of the way to free the target.',
			},
			{
				theirs: 'cryptograms',
				slug: 'cryptogram',
				why: 'Crack a famous quote, one letter at a time.',
			},
		],
		faqTitle: 'Tryit vs Brilliant: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to Brilliant?',
				answer: `For daily puzzles, yes: pick any 3 of Tryit's ${TOTAL_GAMES} games every day, with no account and no ads while you play. Tryit does not teach courses the way Brilliant does. Tryit is independent and not affiliated with Brilliant.`,
			},
			{
				question: 'Which Tryit games suit Brilliant fans?',
				answer:
					'Start with Crowns and Duo for pure logic, Arithmo and Cage Sudoku for numbers, and Slides, Path and Spots for spatial reasoning. Paint (picture logic) and Cipher (letter substitution) are good next picks.',
			},
			{
				question: 'Do I need an account or an app to play Tryit?',
				answer:
					'No. Tryit runs in any browser on phone, tablet or computer, and the 3 free picks need no account. Sign in only if you want your streaks and stats on every device.',
			},
			{
				question: 'How much does Tryit cost compared with Brilliant?',
				answer: `${TRYIT_PRICES} Brilliant Premium is sold monthly, annually or as a Family Plan for up to 6 people, with current prices on Brilliant's subscription page.`,
			},
			{
				question: 'Will Tryit teach me math or coding?',
				answer:
					'No. Tryit is a daily puzzle habit, not a course: no lessons, no tutor and nothing to study. For structured math or coding lessons, Brilliant is built for that. You can use both: a lesson there, then three puzzles here.',
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Put your reasoning to work today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by Brilliant Worldwide, Inc. Brilliant and Koji belong to their owner and are named here only to compare. Brilliant details were checked against brilliant.org, its Premium page and the Brilliant Help Center on 18 November 2026.',
		llmsSummary: `A Brilliant alternative for daily logic and number puzzles: any 3 of ${TOTAL_GAMES} games free in the browser with no account or app, compared with Brilliant's tutor-led math and coding lessons, and which Tryit games suit Brilliant fans.`,
		...SOFTWARE,
	},
	wordle: {
		slug: 'wordle',
		path: '/vs/wordle',
		rival: 'Wordle',
		metaTitle: `Tryit vs Wordle: ${TOTAL_GAMES} Daily Puzzles, Any 3 Free`,
		metaDescription: `Finished today's Wordle? Tryit has Five plus ${TOTAL_GAMES - 1} more daily word, logic, number and spatial puzzles. Pick any 3 free every day with no login and no ads while you play. ${PASS} one-time 3-Day Pass.`,
		eyebrow: 'Tryit vs Wordle · An honest comparison',
		h1: `Finished today's Wordle? Play ${TOTAL_GAMES} more daily puzzles, any 3 free.`,
		lead: `Wordle is the iconic once-a-day 5-letter word puzzle from The New York Times. Tryit gives your daily puzzle break room to grow: ${TOTAL_GAMES} word, logic, number and spatial puzzles in one place, and you pick any 3 to play free every day with no login and no ads while you play.`,
		facts: [
			`${TOTAL_GAMES} daily games`,
			'Any 3 free every day',
			'No account needed',
			`${PASS} 3-Day Pass, one time`,
		],
		verdictTitle: 'The short answer',
		verdict: [
			'Choose Wordle for the original daily 5-letter word puzzle that millions of friends share every morning, plus Wordle Bot and the NYT archive with a Games subscription.',
			`Choose Tryit for ${TOTAL_GAMES} daily puzzle formats in one clean web suite — including Five, Quad, Threads and Hive — with any 3 free every day and a ${PASS} pass with no renewal.`,
			'Most Wordle fans play both: solve Wordle first, then pick three Tryit puzzles for the rest of your coffee.',
		],
		primaryCta: { label: 'Pick your 3 free games', href: `/?${entry('wordle')}` },
		secondaryCta: {
			label: `See the ${PASS} 3-Day Pass`,
			href: `/pricing?${entry('wordle')}`,
		},
		tableTitle: 'Tryit and Wordle side by side',
		tableSubtitle:
			'What each one gives a daily word-puzzle player today. Wordle details come from The New York Times Help Center.',
		rows: [
			{
				feature: 'Daily games',
				them: 'One daily 5-letter word puzzle in 6 tries, part of the NYT Games lineup',
				us: `${TOTAL_GAMES} games: ${LINEUP}, all with a new puzzle every day`,
			},
			{
				feature: 'Free to play',
				them: 'Today’s Wordle is free every day for everyone',
				us: `Any 3 of the ${TOTAL_GAMES} games, your choice, every day. A game you pick stays open all day`,
			},
			{
				feature: 'Past puzzles',
				them: 'Wordle archive back to June 2021 and Wordle Bot require an NYT Games subscription',
				us: `Every past day of all ${TOTAL_GAMES} games with Tryit Plus or the ${PASS} 3-Day Pass`,
			},
			{
				feature: 'Account to start',
				them: 'Free to play without signing in; an NYT account saves streaks and stats across devices',
				us: 'Not needed for the free picks; sign in to keep streaks and stats across devices',
			},
			{
				feature: 'Word-game variety',
				them: 'One 5-letter word puzzle; other word formats live separately in NYT Games',
				us: `${countIn('word')} daily word games (Five, Quad, Threads, Hive, Mini Grid, Rungs, Frame, Cipher and Hunt) plus logic, number and spatial puzzles`,
			},
			{
				feature: 'Try everything, no commitment',
				them: 'NYT Games subscription, billed every 4 weeks or yearly',
				us: `3-Day Pass: ${PASS} once, no renewal. All ${TOTAL_GAMES} games and every past day`,
			},
			{
				feature: 'Ongoing plans',
				them: 'NYT Games prices vary by country and current offer; see nytimes.com',
				us: `Plus ${PLUS_MONTH}/month or ${PLUS_YEAR}/year. Family for up to ${FAMILY_SEATS} people ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year. VAT included`,
			},
			{
				feature: 'Sharing',
				them: 'The classic spoiler-free 5-column emoji grid',
				us: 'A spoiler-free result card for every game: your pattern and time, never the answer',
			},
		],
		theirStrengthsTitle: 'Where Wordle shines',
		theirStrengths: [
			{
				title: 'The shared cultural ritual',
				body: 'Everyone in your group chat already knows the 5×6 grid and plays the exact same daily word.',
			},
			{
				title: 'Wordle Bot and a deep archive',
				body: 'NYT Games subscribers get turn-by-turn analysis from Wordle Bot and an archive stretching back to June 2021.',
			},
			{
				title: 'Pure one-minute focus',
				body: 'One puzzle, six guesses, done. Its restraint is why it became a daily habit for millions.',
			},
		],
		ourStrengthsTitle: 'Why Wordle fans pick Tryit',
		ourStrengths: [
			{
				title: 'More to play once Wordle is done',
				body: `Keep the 5-letter deduction going with Five and Quad (four 5-letter words at once), then branch into ${TOTAL_GAMES - 2} other daily word, logic, number and spatial puzzles.`,
			},
			{
				title: 'Any 3 free, every day',
				body: 'Choose your own three from the full lineup. No account, no card and no ads while you play.',
			},
			PASS_STRENGTH,
			{
				title: `One plan for up to ${FAMILY_SEATS} people`,
				body: `Tryit Family covers up to ${FAMILY_SEATS} accounts, each with their own streaks and stats, for ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year.`,
			},
		],
		pairingsTitle: 'If you like Wordle, try these',
		pairingsSubtitle:
			'Tryit has its own daily games, not Wordle clones. Start here if 5-letter word deduction is your favourite part of the day.',
		pairings: [
			{
				theirs: 'Wordle',
				slug: 'word-guess',
				why: 'Guess today’s 5-letter word in 6 tries with spoiler-free sharing.',
			},
			{
				theirs: 'multi-board Wordle',
				slug: 'quad-words',
				why: 'Solve 4 five-letter words at the same time from shared guesses.',
			},
			{
				theirs: 'word connections',
				slug: 'word-groups',
				why: 'Sort 16 words into 4 hidden groups of 4.',
			},
			{
				theirs: 'letter-by-letter steps',
				slug: 'word-ladder',
				why: 'Change one letter at a time to climb from the start word to the target.',
			},
			{
				theirs: '7-letter word building',
				slug: 'word-hive',
				why: 'Find as many words as you can from 7 letters.',
			},
			{
				theirs: 'code-breaking words',
				slug: 'cryptogram',
				why: 'Crack a famous quote by deducing letter substitutions.',
			},
		],
		faqTitle: 'Tryit vs Wordle: questions',
		faqs: [
			{
				question: 'Is Tryit a free alternative to Wordle?',
				answer: `Tryit is a daily puzzle companion to Wordle: pick any 3 of its ${TOTAL_GAMES} daily games every day for free, with no account and no ads while you play. Five is Tryit's 5-letter word game, and Quad lets you solve four 5-letter words at once. Tryit is independent and not affiliated with The New York Times.`,
			},
			{
				question: 'Can I play more than one word game a day on Tryit?',
				answer: `Yes. Tryit includes ${countIn('word')} daily word games — Five, Quad, Threads, Hive, Mini Grid, Rungs, Frame, Cipher and Hunt — and you can pick any 3 games free every day, or open all ${TOTAL_GAMES} games with Tryit Plus or the 3-Day Pass.`,
			},
			{
				question: 'How does Tryit pricing compare with Wordle and NYT Games?',
				answer: `Wordle's daily puzzle is free, while its archive and Wordle Bot sit inside an NYT Games subscription (prices vary by country on nytimes.com). ${TRYIT_PRICES}`,
			},
			{
				question: 'Can I play past puzzles like the Wordle archive?',
				answer: `Yes. Tryit Plus and the ${PASS} 3-Day Pass open every past day across all ${TOTAL_GAMES} games, including Five and Quad.`,
			},
			NEW_PUZZLES_FAQ,
		],
		closingCta: {
			title: 'Keep your word-puzzle streak going',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by The New York Times Company. Wordle, Wordle Bot and NYT Games are trademarks of The New York Times Company, named here only to compare. Wordle details were checked against The New York Times Help Center on 20 November 2026.',
		llmsSummary: `A Wordle companion and free daily word-puzzle alternative: Five, Quad and ${TOTAL_GAMES - 2} other daily word, logic, number and spatial puzzles, any 3 free every day with no login.`,
		...SOFTWARE,
	},
} as const satisfies Record<ComparisonSlug, ComparisonSpec>

/** Every comparison, in page order. */
export const COMPARISONS: readonly ComparisonSpec[] = COMPARISON_SLUGS.map(
	(slug) => COMPARISON_SPECS[slug],
)

/** "A, B and C" (or "A, B or C"), the list style of the rest of the copy. */
function joinNames(names: readonly string[], conjunction: 'and' | 'or'): string {
	return names.length < 2
		? names.join('')
		: `${names.slice(0, -1).join(', ')} ${conjunction} ${names.at(-1)}`
}

const RIVAL_NAMES = COMPARISONS.map((spec) => spec.rival)
const HUB_ENTRY = 'entry_surface=seo_vs-hub'

export type ComparisonHubSpec = {
	path: typeof COMPARISON_HUB_PATH
	metaTitle: string
	metaDescription: string
	eyebrow: string
	h1: string
	lead: string
	facts: readonly string[]
	primaryCta: UseCaseCta
	secondaryCta: UseCaseCta
	/** Short labels in the broadsheet rule above the cards. */
	masthead: readonly string[]
	listTitle: string
	listSubtitle: string
	cardCta: string
	principlesTitle: string
	principles: readonly ComparisonPoint[]
	closingCta: { title: string; body: string }
}

/** The `/vs` hub: every comparison's short answer, one click from the full page. */
export const COMPARISON_HUB = {
	path: COMPARISON_HUB_PATH,
	metaTitle: 'Tryit vs NYT Games, Brilliant & More: Honest Comparisons',
	metaDescription: `How Tryit's ${TOTAL_GAMES} daily puzzles compare with ${joinNames(RIVAL_NAMES, 'and')}: short answers, fair credit and the Tryit games to try first.`,
	eyebrow: 'Compare',
	h1: 'Tryit, honestly compared',
	lead: `Already play ${joinNames(RIVAL_NAMES, 'or')}? Each comparison gives the short answer first, credits what the other app does best, and names the Tryit games closest to the ones you love. Then pick any 3 of our ${TOTAL_GAMES} daily puzzles to play free, no account needed.`,
	facts: [
		`${COMPARISONS.length} comparisons`,
		`${TOTAL_GAMES} daily games`,
		'Any 3 free every day',
		'No account needed',
	],
	primaryCta: { label: 'Pick your 3 free games', href: `/?${HUB_ENTRY}` },
	secondaryCta: { label: `See the ${PASS} 3-Day Pass`, href: `/pricing?${HUB_ENTRY}` },
	masthead: [
		`${COMPARISONS.length} comparisons`,
		'Facts from their own pages',
		"Credit where it's due",
	],
	listTitle: 'Pick a comparison',
	listSubtitle: 'The short answer from each page. Open one for the full side-by-side.',
	cardCta: 'Read the comparison',
	principlesTitle: 'How we compare',
	principles: [
		{
			title: 'Their facts, from their own pages',
			body: "We read each company's own site, help center or app store listing, and date the check at the foot of every page. No rumours and no guessed prices.",
		},
		{
			title: "Credit where it's due",
			body: 'Every page says what the other app does better, so you can choose the right one, even when that is not Tryit.',
		},
		{
			title: 'Closest match, never a copy',
			body: 'Tryit has its own games. Each page names the ones nearest in style to the games you already love, so you know where to start.',
		},
	],
	closingCta: {
		title: 'Pick your three for today',
		body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
	},
} as const satisfies ComparisonHubSpec

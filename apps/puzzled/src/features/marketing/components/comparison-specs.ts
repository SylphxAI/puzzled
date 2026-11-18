import { getAllGameMetadata } from '@/games/registry'
import type { GameCategory } from '@/games/types'
import { FAMILY_SEATS, listPrice, offerPrice } from './catalogue-prices'
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
	slug: 'nyt-games'
	path: '/vs/nyt-games'
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
const ENTRY = 'entry_surface=seo_vs-nyt-games'

/**
 * NYT Games facts are limited to what The New York Times states itself (its
 * Help Center "New York Times Games Subscription", "Wordle" and "Connections"
 * articles, read 2026-11-18). Third-party lists disagree on which NYT games
 * are free, so the page names only Wordle and Connections as free and quotes
 * no NYT price.
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
		primaryCta: { label: 'Pick your 3 free games', href: `/?${ENTRY}` },
		secondaryCta: { label: `See the ${PASS} 3-Day Pass`, href: `/pricing?${ENTRY}` },
		tableTitle: 'Tryit and NYT Games side by side',
		tableSubtitle:
			'What each one offers a daily puzzle player today. NYT details come from The New York Times Help Center.',
		rows: [
			{
				feature: 'Daily games',
				them: 'The Crossword, The Mini, Wordle, Connections, Spelling Bee, Strands, Letter Boxed, Tiles, Sudoku, Pips and more',
				us: `${TOTAL_GAMES} games: ${countIn('word')} word, ${countIn('logic')} logic, ${countIn('math')} number and ${countIn('spatial')} spatial, all with a new puzzle every day`,
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
			{
				title: `A ${PASS} pass, not a contract`,
				body: `The 3-Day Pass opens every game and every past day for 3 days with one payment and no renewal. Perfect for a long weekend of catching up.`,
			},
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
				answer: `Tryit's 3 daily picks are free. To open all ${TOTAL_GAMES} games and the archive: a 3-Day Pass is ${PASS} once, Tryit Plus is ${PLUS_MONTH}/month or ${PLUS_YEAR}/year, and Tryit Family (up to ${FAMILY_SEATS} people) is ${FAMILY_MONTH}/month or ${FAMILY_YEAR}/year, VAT included. NYT Games prices vary by country and offer, so check nytimes.com for current rates.`,
			},
			{
				question: 'Does Tryit have a full-size crossword like the NYT Crossword?',
				answer:
					"Not today. Tryit's crossword is Mini Grid, a 5×5 daily. If the full-size Crossword is your main habit, NYT Games is the better fit, and many players keep it and add Tryit for variety.",
			},
			{
				question: 'When do new Tryit puzzles come out?',
				answer: `Every day at midnight Hong Kong time (UTC+8). All ${TOTAL_GAMES} games refresh together, and everyone gets the same set.`,
			},
		],
		closingCta: {
			title: 'Pick your three for today',
			body: `${TOTAL_GAMES} fresh puzzles every day. Any 3 free, no login, no ads while you play.`,
		},
		disclaimer:
			'Tryit is independent and not affiliated with, endorsed by or sponsored by The New York Times Company. NYT Games, Wordle, Connections, Spelling Bee, Strands, Letter Boxed, Tiles, Pips, The Crossword, The Mini and The Midi are trademarks of The New York Times Company, named here only to compare. NYT Games details were checked against The New York Times Help Center on 18 November 2026.',
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
	},
} as const satisfies Record<string, ComparisonSpec>

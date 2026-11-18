import { FAMILY_SEATS, listPrice } from '@/features/marketing/components/catalogue-prices'
import { getAllGameMetadata } from '@/games/registry'
import { CONTACT_EMAIL } from '@/lib/config/app'

// Keep discovery in step with the same registry that supplies the game catalogue,
// and with the price catalogue that checkout charges.
const allGames = getAllGameMetadata()
const games = allGames
	.map((game) => `- [${game.name}](https://tryit.fun/games/${game.slug}): ${game.description}.`)
	.join('\n')
const total = allGames.length
const usd = {
	pass: listPrice('puzzled_starter_unlock'),
	month: listPrice('plus_individual_monthly'),
	year: listPrice('plus_individual_yearly'),
	familyMonth: listPrice('plus_family_monthly'),
	familyYear: listPrice('plus_family_yearly'),
}
const gbp = {
	pass: listPrice('puzzled_starter_unlock', 'gbp'),
	month: listPrice('plus_individual_monthly', 'gbp'),
	year: listPrice('plus_individual_yearly', 'gbp'),
	familyMonth: listPrice('plus_family_monthly', 'gbp'),
	familyYear: listPrice('plus_family_yearly', 'gbp'),
}

const document = `# Tryit

> Tryit is a daily set of ${total} word, logic, number and spatial puzzles, published by Sylphx Limited.

Pick any 3 of today's ${total} games to play free every day, no account needed. A game you pick stays open all day.
New puzzles arrive at midnight, Hong Kong time (UTC+8), with the same daily set for everyone.
Results can be shared without revealing the solution. An account keeps server-verified streaks, results and stats across devices.
No ads are shown on a puzzle while it is being played.

Tryit Plus (${usd.month}/mo or ${usd.year}/yr USD; ${gbp.month}/mo or ${gbp.year}/yr GBP) unlocks all ${total} games, the past-day archive, and ad-free play everywhere.
Tryit Family covers up to ${FAMILY_SEATS} accounts (${usd.familyMonth}/mo or ${usd.familyYear}/yr USD; ${gbp.familyMonth}/mo or ${gbp.familyYear}/yr GBP).
A one-time 3-Day Pass (${usd.pass} USD / ${gbp.pass} GBP) opens every game and the archive for 3 days, with no renewal.
Prices include VAT.

## Play
- [Home](https://tryit.fun/): Today's lineup; pick any 3 games to play free.
- [All games](https://tryit.fun/games): Browse the ${total}-game puzzle catalogue.
- [Pricing & Tryit Plus](https://tryit.fun/pricing): Individual, Family (${FAMILY_SEATS} seats), and 3-Day Pass plans.
${games}
- [Leaderboard](https://tryit.fun/leaderboard): Daily results and rankings.

## Use Cases
- [Daily word & logic puzzles online](https://tryit.fun/use-cases/daily-word-and-logic-puzzles-online): ${total} daily games, any 3 free each day, midnight HKT reset, and full archive access with Plus.
- [Ad-free family brain games](https://tryit.fun/use-cases/family-brain-games-no-ads): Zero-distraction daily puzzles for up to ${FAMILY_SEATS} family accounts in 8 locales.

## Comparisons
- [Tryit vs NYT Games](https://tryit.fun/vs/nyt-games): How Tryit's ${total} daily games and 3 free daily picks compare with NYT Games, and which Tryit games suit Wordle, Connections and Spelling Bee fans.
- [Tryit vs Lumosity](https://tryit.fun/vs/lumosity): A free Lumosity alternative for daily puzzles: any 3 of ${total} games free in the browser with no app, account or test first, compared with Lumosity's brain-training program.
- [Tryit vs LinkedIn Games](https://tryit.fun/vs/linkedin-games): Daily logic, word, number and spatial puzzles like LinkedIn's Queens, Tango and Zip, with no feed or login, and which Tryit games suit each LinkedIn game.

## Help and policies
- [Support](https://tryit.fun/support): Product help and contact information.
- [Privacy policy](https://tryit.fun/privacy): Data use and privacy rights.
- [Terms of service](https://tryit.fun/terms): Terms for using Tryit.

Contact: ${CONTACT_EMAIL}.
`

export function GET() {
	return new Response(document, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			// Like /sitemap.xml: the edge may keep a copy but must revalidate it, so a
			// deploy that changes the offer is served at once, not hours later.
			'Cache-Control': 'public, max-age=0, must-revalidate',
		},
	})
}

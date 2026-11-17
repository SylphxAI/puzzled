import { getAllGameMetadata } from '@/games/registry'
import { CONTACT_EMAIL } from '@/lib/config/app'

// Keep discovery in step with the same registry that supplies the game catalogue.
const allGames = getAllGameMetadata()
const games = allGames
	.map((game) => `- [${game.name}](https://tryit.fun/games/${game.slug}): ${game.description}.`)
	.join('\n')

const document = `# Tryit

> Tryit is a daily set of ${allGames.length} word, logic, number and spatial puzzles, published by Sylphx Limited.

One featured puzzle is free every day and needs no account. New puzzles arrive
at midnight, Hong Kong time (UTC+8), with the same daily set for everyone.
Results can be shared without revealing the solution. An account keeps
server-verified streaks, results and stats across devices.

Tryit Plus ($4.99/mo or $39.99/yr USD; £3.99/mo or £29.99/yr GBP) unlocks all
${allGames.length} games, the past-day archive, and ad-free play everywhere. Tryit Family
covers up to 4 accounts ($7.99/mo or $64.99/yr USD; £5.99/mo or £47.99/yr GBP).
A one-time 3-Day Weekend Plus & Archive Pass is $2.99 USD / £2.99 GBP.

## Play
- [Home](https://tryit.fun/): Today's featured puzzle and daily lineup.
- [All games](https://tryit.fun/games): Browse the ${allGames.length}-game puzzle catalogue.
- [Pricing & Tryit Plus](https://tryit.fun/pricing): Individual, Family (4 seats), and 3-Day Weekend Pass plans.
${games}
- [Leaderboard](https://tryit.fun/leaderboard): Daily results and rankings.

## Use Cases
- [Daily word & logic puzzles online](https://tryit.fun/use-cases/daily-word-and-logic-puzzles-online): All ${allGames.length} daily games, midnight HKT reset, and full archive access.
- [Ad-free family brain games](https://tryit.fun/use-cases/family-brain-games-no-ads): Zero-distraction daily puzzles for up to 4 family accounts in 8 locales.

## Help and policies
- [Support](https://tryit.fun/support): Product help and contact information.
- [Privacy policy](https://tryit.fun/privacy): Data use and privacy rights.
- [Terms of service](https://tryit.fun/terms): Terms for using Tryit.

Contact: ${CONTACT_EMAIL}.
`

export function GET() {
	return new Response(document, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	})
}

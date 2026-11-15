import { getAllGameMetadata } from '@/games/registry'
import { CONTACT_EMAIL } from '@/lib/config/app'

// Keep discovery in step with the same registry that supplies the game catalogue.
const allGames = getAllGameMetadata()
const games = allGames
	.map((game) => `- [${game.name}](https://puzzled.gg/games/${game.slug}): ${game.description}.`)
	.join('\n')

const document = `# Puzzled

> Puzzled is a daily set of ${allGames.length} word, logic, number and spatial puzzles, published by Sylphx Limited.

One featured puzzle is free every day and needs no account. New puzzles arrive
at midnight, Hong Kong time (UTC+8), with the same daily set for everyone.
Results can be shared without revealing the solution. An account keeps
server-verified streaks, results and stats across devices.

Puzzled Plus ($4.99/mo or $39.99/yr USD; £3.99/mo or £29.99/yr GBP) unlocks all
${allGames.length} games, the past-day archive, and ad-free play everywhere. Puzzled Plus Family
covers up to 4 accounts ($7.99/mo or $64.99/yr USD; £5.99/mo or £47.99/yr GBP).
A one-time 3-Day Weekend Plus & Archive Pass is $2.99 USD / £2.99 GBP.

## Play
- [Home](https://puzzled.gg/): Today's featured puzzle and daily lineup.
- [All games](https://puzzled.gg/games): Browse the ${allGames.length}-game puzzle catalogue.
- [Pricing & Puzzled Plus](https://puzzled.gg/pricing): Individual, Family (4 seats), and 3-Day Weekend Pass plans.
${games}
- [Leaderboard](https://puzzled.gg/leaderboard): Daily results and rankings.

## Use Cases
- [Daily word & logic puzzles online](https://puzzled.gg/use-cases/daily-word-and-logic-puzzles-online): All ${allGames.length} daily games, midnight HKT reset, and full archive access.
- [Ad-free family brain games](https://puzzled.gg/use-cases/family-brain-games-no-ads): Zero-distraction daily puzzles for up to 4 family accounts in 8 locales.

## Help and policies
- [Support](https://puzzled.gg/support): Product help and contact information.
- [Privacy policy](https://puzzled.gg/privacy): Data use and privacy rights.
- [Terms of service](https://puzzled.gg/terms): Terms for using Puzzled.

Contact: ${CONTACT_EMAIL}.
`

export function GET() {
	return new Response(document, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	})
}

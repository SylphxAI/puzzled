import { getAllGameMetadata } from '@/games/registry'
import { CONTACT_EMAIL } from '@/lib/config/app'

// Keep discovery in step with the same registry that supplies the game catalogue.
const games = getAllGameMetadata()
	.map((game) => `- [${game.name}](https://puzzled.gg/games/${game.slug}): ${game.description}.`)
	.join('\n')

const document = `# Puzzled

> Puzzled is a daily set of word, logic and number puzzles, published by Sylphx.

One puzzle is free every day and needs no account. New puzzles arrive at midnight,
Hong Kong time, with the same daily set for everyone. Results can be shared without
revealing the solution. An account keeps streaks, results and stats across devices.

## Play
- [Home](https://puzzled.gg/): Today's featured puzzle and daily lineup.
- [All games](https://puzzled.gg/games): Browse the puzzle catalogue.
${games}
- [Leaderboard](https://puzzled.gg/leaderboard): Daily results and rankings.

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

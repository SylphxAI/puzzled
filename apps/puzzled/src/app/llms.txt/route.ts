// Based on en-US/home.json, the public catalogue and legal/support pages.
// Public links verified with HTTP GET on 2026-11-02 (UTC).
const document = `# Puzzled

> Puzzled is a daily set of word, logic and number puzzles, published by Sylphx.

One puzzle is free every day and needs no account. New puzzles arrive at midnight,
Hong Kong time, with the same daily set for everyone. Results can be shared without
revealing the solution. An account keeps streaks, results and stats across devices.

## Play
- [Home](https://puzzled.gg/): Today's featured puzzle and daily lineup.
- [All games](https://puzzled.gg/games): Browse the puzzle catalogue.
- [Sudoku](https://puzzled.gg/games/sudoku): Number-placement puzzle.
- [Five](https://puzzled.gg/games/word-guess): Daily word-guessing puzzle.
- [Threads](https://puzzled.gg/games/word-groups): Find four groups of four.
- [Leaderboard](https://puzzled.gg/leaderboard): Daily results and rankings.

## Help and policies
- [Support](https://puzzled.gg/support): Product help and contact information.
- [Privacy policy](https://puzzled.gg/privacy): Data use and privacy rights.
- [Terms of service](https://puzzled.gg/terms): Terms for using Puzzled.
`

export function GET() {
	return new Response(document, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	})
}

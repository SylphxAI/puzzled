/**
 * Explicit composition root for Puzzled Connect product clients.
 * Stats + primary play (PuzzleService) product authority — not Health-only.
 */

export {
	admitGetDailyViaConnect,
	admitGetPuzzleViaConnect,
	admitSubmitGuessViaConnect,
} from './puzzle-admission'
export {
	createPuzzleServiceClient,
	getDaily,
	getPuzzle,
	puzzleQueryKeys,
	submitGuess,
} from './puzzle-client'
export {
	planPuzzleGetDailyProduct,
	resolvePuzzleProductAuthorityMode,
	shouldUseRestPlayResidual,
} from './puzzle-product-authority'
export { createStatsServiceClient, getLeaderboard, statsQueryKeys } from './stats-client'
export {
	planStatsLeaderboardProduct,
	resolveStatsProductAuthorityMode,
} from './stats-product-authority'

/** App-local re-export of monorepo Puzzle Connect admission shell. */
export {
	admitGetDailyViaConnect,
	admitGetPuzzleViaConnect,
	admitSubmitGuessViaConnect,
	shouldUseRestPlayResidual,
} from '../../../../../src/lib/connect/puzzle-admission'
export { resolveSubmitGuessSeed } from '../../../../../src/lib/connect/puzzle-domain'
export {
	type PuzzleProductAuthorityMode,
	resolvePuzzleProductAuthorityMode,
} from '../../../../../src/lib/connect/puzzle-product-authority'

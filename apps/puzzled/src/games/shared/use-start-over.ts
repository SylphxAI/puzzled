/**
 * Start over, for every game that offers it.
 *
 * A game's own `reset` only rewinds its board. The session must be rewound
 * with it: that clears `resultReady` (so "See your result" goes away) and
 * cancels the pending result-modal timer (so a Start over pressed inside the
 * celebration window cannot open the result over the fresh board).
 */

import { useCallback } from 'react'

export function useStartOver(resetSession: () => void, resetBoard: () => void): () => void {
	return useCallback(() => {
		resetSession()
		resetBoard()
	}, [resetSession, resetBoard])
}

'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { PlusOffer, ResultPlusOffer } from '../lib/plus-offer'

const PlusOfferContext = createContext<ResultPlusOffer | null>(null)

/** Hands the server's decision (sales open, viewer not a member) to result screens. */
export function PlusOfferProvider({
	offer,
	dayKey,
	children,
}: {
	offer: PlusOffer | null
	dayKey: string
	children: ReactNode
}) {
	return (
		<PlusOfferContext.Provider value={offer ? { ...offer, dayKey } : null}>
			{children}
		</PlusOfferContext.Provider>
	)
}

export function usePlusOffer(): ResultPlusOffer | null {
	return useContext(PlusOfferContext)
}

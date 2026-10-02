'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { PlusOffer } from '../lib/plus-offer'

const PlusOfferContext = createContext<PlusOffer | null>(null)

/** Hands the server's decision (sales open, viewer not a member) to result screens. */
export function PlusOfferProvider({
	offer,
	children,
}: {
	offer: PlusOffer | null
	children: ReactNode
}) {
	return <PlusOfferContext.Provider value={offer}>{children}</PlusOfferContext.Provider>
}

export function usePlusOffer(): PlusOffer | null {
	return useContext(PlusOfferContext)
}

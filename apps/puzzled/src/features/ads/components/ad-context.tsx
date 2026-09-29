'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { AdsConfig } from '@/lib/ads'

const AdsContext = createContext<AdsConfig | null>(null)

/** Hands the server's decision (configured, and the viewer has no Plus) to result screens. */
export function AdsProvider({
	config,
	children,
}: {
	config: AdsConfig | null
	children: ReactNode
}) {
	return <AdsContext.Provider value={config}>{children}</AdsContext.Provider>
}

export function useAdsConfig(): AdsConfig | null {
	return useContext(AdsContext)
}

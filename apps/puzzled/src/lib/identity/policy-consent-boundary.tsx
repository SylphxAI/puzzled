'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isLegalPath } from './policy-consent'
import { PolicyConsentGate } from './policy-consent-gate'
import { useSafeUser } from './react'

export function PolicyConsentBoundary({ children }: { children: ReactNode }) {
	const { user } = useSafeUser()
	const pathname = usePathname()
	if (isLegalPath(pathname ?? '')) return children
	return <PolicyConsentGate userId={user?.id ?? null}>{children}</PolicyConsentGate>
}

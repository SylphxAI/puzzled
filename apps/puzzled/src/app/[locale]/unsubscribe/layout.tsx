import type { Metadata } from 'next'

/**
 * Transactional surface: reached from email links, carries a one-time token in
 * the query string. Never indexable.
 */
export const metadata: Metadata = {
	robots: { index: false, follow: false },
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}

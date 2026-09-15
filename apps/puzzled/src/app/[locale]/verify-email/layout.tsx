import type { Metadata } from 'next'

/**
 * Transactional surface: the URL is real for the person who clicked the link
 * in their inbox and noise for everyone else. Form validation also runs on the
 * query string, so the page must stay out of the index entirely.
 */
export const metadata: Metadata = {
	robots: { index: false, follow: false },
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}

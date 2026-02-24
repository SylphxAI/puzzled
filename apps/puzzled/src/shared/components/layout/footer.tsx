'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'

export function Footer() {
	const t = useTranslations('footer')
	const pathname = usePathname()
	// Use static year on server, update on client to avoid hydration mismatch
	const [currentYear, setCurrentYear] = useState(2025)

	useEffect(() => {
		setCurrentYear(new Date().getFullYear())
	}, [])

	// Hide footer on game pages - games are full-screen experiences
	if (pathname?.includes('/games/')) {
		return null
	}

	// Mobile: hidden (bottom nav is used)
	// Desktop: visible
	return (
		<footer className="mt-auto hidden border-t bg-muted/30 md:block">
			<div className="mx-auto max-w-4xl px-4 py-6">
				<div className="flex flex-col items-center gap-4 text-center">
					{/* Logo */}
					<div className="text-sm font-semibold text-foreground">{APP_NAME}</div>

					{/* Links */}
					<nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
						<Link
							href="/privacy"
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							{t('privacy')}
						</Link>
						<Link
							href="/terms"
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							{t('terms')}
						</Link>
						<a
							href={`mailto:${SUPPORT_EMAIL}`}
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							{t('contact')}
						</a>
					</nav>

					{/* Copyright */}
					<p className="text-xs text-muted-foreground">{t('copyright', { year: currentYear })}</p>
				</div>
			</div>
		</footer>
	)
}

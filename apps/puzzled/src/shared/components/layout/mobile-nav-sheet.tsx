'use client'

import { Menu } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { afterFirstPaint } from '@/shared/components/deferred-shell'

const loadPanel = () => import('./mobile-nav-panel')

// The sheet, its dialog runtime and the language menu weigh well over 100 KB
// and are only needed once the menu is opened, so they stay out of the initial
// route bundle. `ssr: false`: the closed sheet renders nothing but its trigger.
const Panel = dynamic(() => loadPanel().then((module) => module.MobileNavPanel), {
	ssr: false,
	loading: () => <MenuButton />,
})

function MenuButton({ onOpen }: { onOpen?: () => void }) {
	const t = useTranslations()
	return (
		<button
			type="button"
			className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
			aria-label={t('nav.openMenu')}
			onClick={onOpen}
		>
			<Menu className="h-5 w-5" aria-hidden="true" />
		</button>
	)
}

/**
 * Mobile navigation trigger. Renders the menu button at once; the sheet's code
 * is fetched after first paint and the sheet mounts, already open, on the
 * first press.
 */
export function MobileNavSheet({ currentStreak = 0 }: { currentStreak?: number }) {
	const [opened, setOpened] = useState(false)

	useEffect(() => afterFirstPaint(() => void loadPanel()), [])

	if (opened) return <Panel currentStreak={currentStreak} defaultOpen />
	return <MenuButton onOpen={() => setOpened(true)} />
}

'use client'

import { useTranslations } from 'next-intl'
import { SettingsSearch, SettingsSearchTrigger, useSettingsSearch } from './settings-search'

/**
 * Settings Header with Search
 *
 * Client component that provides the settings title and search functionality.
 * Includes Cmd+K keyboard shortcut for quick access to search.
 */
export function SettingsHeader() {
	const t = useTranslations()
	const { isOpen, open, close } = useSettingsSearch()

	return (
		<>
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-bold">{t('settings.title')}</h1>
				<SettingsSearchTrigger onClick={open} />
			</div>
			<SettingsSearch open={isOpen} onClose={close} />
		</>
	)
}

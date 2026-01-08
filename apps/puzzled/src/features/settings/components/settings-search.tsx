'use client'

import { Clock, Command, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/shared/components/ui'
import {
	clearRecentSearches,
	getRecentSearches,
	groupBySection,
	highlightMatches,
	type SettingItem,
	type SettingSection,
	saveRecentSearch,
	searchSettings,
} from '../lib/settings-search'

type SettingsSearchProps = {
	open: boolean
	onClose: () => void
}

export function SettingsSearch({ open, onClose }: SettingsSearchProps) {
	const router = useRouter()
	const t = useTranslations('settings.search')
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const [query, setQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [recentSearches, setRecentSearches] = useState<string[]>([])

	// Search results
	const results = useMemo(() => searchSettings(query), [query])
	const groupedResults = useMemo(() => groupBySection(results), [results])

	// Flatten results for keyboard navigation
	const flattenedResults = useMemo(() => {
		const flat: SettingItem[] = []
		for (const [, items] of groupedResults) {
			flat.push(...items)
		}
		return flat
	}, [groupedResults])

	// Load recent searches on mount
	useEffect(() => {
		if (open) {
			setRecentSearches(getRecentSearches())
		}
	}, [open])

	// Focus input when opened (Radix handles dialog focus, but we want input focus)
	useEffect(() => {
		if (open && inputRef.current) {
			const timer = setTimeout(() => {
				inputRef.current?.focus()
			}, 0)
			return () => clearTimeout(timer)
		}
	}, [open])

	// Reset state when closed
	useEffect(() => {
		if (!open) {
			setQuery('')
			setSelectedIndex(0)
		}
	}, [open])

	// Scroll selected item into view
	useEffect(() => {
		if (flattenedResults.length > 0 && listRef.current) {
			const selectedItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
			if (selectedItem) {
				selectedItem.scrollIntoView({ block: 'nearest' })
			}
		}
	}, [selectedIndex, flattenedResults.length])

	// Handle navigation to a setting
	const handleNavigate = useCallback(
		(item: SettingItem) => {
			if (query.trim()) {
				saveRecentSearch(query)
			}
			router.push(item.href)
			onClose()
		},
		[router, onClose, query],
	)

	// Handle recent search click
	const handleRecentSearchClick = useCallback((search: string) => {
		setQuery(search)
		setSelectedIndex(0)
	}, [])

	// Handle clear recent searches
	const handleClearRecent = useCallback(() => {
		clearRecentSearches()
		setRecentSearches([])
	}, [])

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const itemCount = flattenedResults.length

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault()
					if (itemCount > 0) {
						setSelectedIndex((prev) => (prev + 1) % itemCount)
					}
					break

				case 'ArrowUp':
					e.preventDefault()
					if (itemCount > 0) {
						setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount)
					}
					break

				case 'Enter':
					e.preventDefault()
					if (flattenedResults[selectedIndex]) {
						handleNavigate(flattenedResults[selectedIndex])
					}
					break
			}
		},
		[flattenedResults, selectedIndex, handleNavigate],
	)

	const showRecentSearches = !query.trim() && recentSearches.length > 0
	const showEmptyState = query.trim() && results.length === 0
	const showResults = query.trim() && results.length > 0

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent
				className="top-[15vh] translate-y-0 max-w-xl p-0 gap-0 overflow-hidden"
				hideCloseButton
				onPointerDownOutside={(e) => e.preventDefault()}
			>
				{/* Search Input */}
				<div className="flex items-center gap-3 border-b px-4">
					<Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value)
							setSelectedIndex(0)
						}}
						onKeyDown={handleKeyDown}
						placeholder={t('placeholder')}
						className="h-14 flex-1 bg-transparent text-base placeholder:text-muted-foreground"
						aria-label={t('ariaLabel')}
						autoComplete="off"
						autoCorrect="off"
						spellCheck={false}
					/>
					{query && (
						<button
							onClick={() => {
								setQuery('')
								inputRef.current?.focus()
							}}
							className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label={t('clearSearch')}
							type="button"
						>
							<X className="h-4 w-4" />
						</button>
					)}
					<button
						onClick={onClose}
						className="flex h-8 items-center justify-center rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
						type="button"
					>
						ESC
					</button>
				</div>

				{/* Content Area */}
				<div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
					{/* Recent Searches */}
					{showRecentSearches && (
						<div className="py-2">
							<div className="flex items-center justify-between px-3 py-1.5">
								<span className="text-xs font-medium text-muted-foreground">
									{t('recentSearches')}
								</span>
								<button
									onClick={handleClearRecent}
									className="text-xs text-muted-foreground hover:text-foreground"
									type="button"
								>
									{t('clear')}
								</button>
							</div>
							{recentSearches.map((search, index) => (
								<button
									key={index}
									onClick={() => handleRecentSearchClick(search)}
									className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
									type="button"
								>
									<Clock className="h-4 w-4 text-muted-foreground" />
									<span>{search}</span>
								</button>
							))}
						</div>
					)}

					{/* No Query State */}
					{!query.trim() && !showRecentSearches && (
						<div className="py-12 text-center">
							<Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">{t('emptyState')}</p>
							<div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
								<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
									<Command className="inline h-3 w-3" />
								</kbd>
								<span>+</span>
								<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
									K
								</kbd>
								<span className="ml-1">{t('openAnytime')}</span>
							</div>
						</div>
					)}

					{/* Empty State */}
					{showEmptyState && (
						<div className="py-12 text-center">
							<Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">{t('noResults', { query })}</p>
							<p className="mt-1 text-xs text-muted-foreground">{t('searchSuggestions')}</p>
						</div>
					)}

					{/* Search Results */}
					{showResults && (
						<div className="space-y-4 py-2">
							{Array.from(groupedResults.entries()).map(([section, items]) => (
								<div key={section}>
									{/* Section Header */}
									<div className="px-3 py-1.5">
										<span className="text-xs font-medium text-muted-foreground">
											{t(`sections.${section}` as `sections.${SettingSection}`)}
										</span>
									</div>

									{/* Section Items */}
									{items.map((item) => {
										const flatIndex = flattenedResults.indexOf(item)
										const isSelected = flatIndex === selectedIndex

										return (
											<SearchResultItem
												key={item.id}
												item={item}
												query={query}
												isSelected={isSelected}
												dataIndex={flatIndex}
												onClick={() => handleNavigate(item)}
												onMouseEnter={() => setSelectedIndex(flatIndex)}
											/>
										)
									})}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
					<div className="flex items-center gap-4">
						<span className="flex items-center gap-1">
							<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
								&uarr;
							</kbd>
							<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
								&darr;
							</kbd>
							<span className="ml-1">{t('navigate')}</span>
						</span>
						<span className="flex items-center gap-1">
							<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
								&crarr;
							</kbd>
							<span className="ml-1">{t('select')}</span>
						</span>
					</div>
					{query.trim() && <span>{t('resultsCount', { count: results.length })}</span>}
				</div>
			</DialogContent>
		</Dialog>
	)
}

/**
 * Individual search result item
 */
type SearchResultItemProps = {
	item: SettingItem
	query: string
	isSelected: boolean
	dataIndex: number
	onClick: () => void
	onMouseEnter: () => void
}

function SearchResultItem({
	item,
	query,
	isSelected,
	dataIndex,
	onClick,
	onMouseEnter,
}: SearchResultItemProps) {
	const Icon = item.icon
	const titleSegments = highlightMatches(item.title, query)
	const descriptionSegments = highlightMatches(item.description, query)

	return (
		<button
			data-index={dataIndex}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			className={cn(
				'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
				isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
			)}
			type="button"
		>
			<div
				className={cn(
					'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
					isSelected ? 'bg-primary/20' : 'bg-muted',
				)}
			>
				<Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium">
					{titleSegments.map((segment, i) => (
						<span
							key={i}
							className={cn(segment.isMatch && 'bg-primary/20 text-primary font-semibold')}
						>
							{segment.text}
						</span>
					))}
				</p>
				<p className="text-xs text-muted-foreground truncate">
					{descriptionSegments.map((segment, i) => (
						<span key={i} className={cn(segment.isMatch && 'bg-primary/20 text-primary')}>
							{segment.text}
						</span>
					))}
				</p>
			</div>
		</button>
	)
}

/**
 * Search trigger button component
 */
type SettingsSearchTriggerProps = {
	onClick: () => void
	className?: string
}

export function SettingsSearchTrigger({ onClick, className }: SettingsSearchTriggerProps) {
	const t = useTranslations('settings.search')

	return (
		<button
			onClick={onClick}
			className={cn(
				'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground',
				className,
			)}
			type="button"
			aria-label={t('ariaLabel')}
		>
			<Search className="h-4 w-4" />
			<span className="hidden sm:inline">{t('searchSettings')}</span>
			<kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs sm:inline-flex items-center gap-0.5">
				<Command className="h-3 w-3" />K
			</kbd>
		</button>
	)
}

/**
 * Hook for managing settings search state with keyboard shortcut
 */
export function useSettingsSearch() {
	const [isOpen, setIsOpen] = useState(false)

	// Handle Cmd+K / Ctrl+K keyboard shortcut
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setIsOpen((prev) => !prev)
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	const open = useCallback(() => setIsOpen(true), [])
	const close = useCallback(() => setIsOpen(false), [])
	const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

	return {
		isOpen,
		open,
		close,
		toggle,
	}
}

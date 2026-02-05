'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Command } from 'cmdk'
import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	BarChart3,
	Bell,
	CreditCard,
	FileText,
	Flag,
	FlaskConical,
	Gamepad2,
	LayoutDashboard,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Users,
	X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type CommandItem = {
	id: string
	label: string
	icon: typeof LayoutDashboard
	action: () => void
	keywords?: string[]
	shortcut?: string
	group: 'navigation' | 'actions' | 'settings'
}

export function AdminCommandPalette() {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const router = useRouter()
	const t = useTranslations('admin')
	const inputRef = useRef<HTMLInputElement>(null)

	// Open with Cmd+K or Ctrl+K
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen((open) => !open)
			}
		}

		document.addEventListener('keydown', down)
		return () => document.removeEventListener('keydown', down)
	}, [])

	// Focus input when opened
	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0)
		}
	}, [open])

	const navigate = useCallback(
		(href: string) => {
			router.push(href)
			setOpen(false)
			setSearch('')
		},
		[router],
	)

	const commands: CommandItem[] = [
		// Navigation
		{
			id: 'nav-dashboard',
			label: t('sidebar.dashboard'),
			icon: LayoutDashboard,
			action: () => navigate('/admin'),
			keywords: ['home', 'overview', 'main'],
			shortcut: 'G D',
			group: 'navigation',
		},
		{
			id: 'nav-users',
			label: t('sidebar.users'),
			icon: Users,
			action: () => navigate('/admin/users'),
			keywords: ['accounts', 'members', 'people'],
			shortcut: 'G U',
			group: 'navigation',
		},
		{
			id: 'nav-plans',
			label: t('sidebar.plansAndPricing'),
			icon: CreditCard,
			action: () => navigate('/admin/plans'),
			keywords: ['pricing', 'subscription', 'billing', 'stripe'],
			shortcut: 'G P',
			group: 'navigation',
		},
		{
			id: 'nav-games',
			label: t('sidebar.games'),
			icon: Gamepad2,
			action: () => navigate('/admin/games'),
			keywords: ['puzzles', 'catalog'],
			shortcut: 'G G',
			group: 'navigation',
		},
		{
			id: 'nav-analytics',
			label: t('sidebar.analytics'),
			icon: BarChart3,
			action: () => navigate('/admin/analytics'),
			keywords: ['metrics', 'stats', 'data', 'charts', 'dau', 'mau'],
			shortcut: 'G A',
			group: 'navigation',
		},
		{
			id: 'nav-dlq',
			label: t('sidebar.dlq'),
			icon: AlertTriangle,
			action: () => navigate('/admin/dlq'),
			keywords: ['queue', 'errors', 'failed', 'jobs', 'workflows'],
			shortcut: 'G Q',
			group: 'navigation',
		},
		{
			id: 'nav-audit',
			label: t('sidebar.auditLogs'),
			icon: FileText,
			action: () => navigate('/admin/audit-logs'),
			keywords: ['logs', 'history', 'activity', 'trail'],
			shortcut: 'G L',
			group: 'navigation',
		},
		{
			id: 'nav-experiments',
			label: t('sidebar.experiments'),
			icon: FlaskConical,
			action: () => navigate('/admin/experiments'),
			keywords: ['ab', 'testing', 'variants', 'experiment'],
			shortcut: 'G E',
			group: 'navigation',
		},
		{
			id: 'nav-announcements',
			label: t('sidebar.announcements'),
			icon: Bell,
			action: () => navigate('/admin/announcements'),
			keywords: ['notifications', 'messages', 'alerts', 'broadcast'],
			shortcut: 'G N',
			group: 'navigation',
		},
		{
			id: 'nav-feature-flags',
			label: t('sidebar.featureFlags'),
			icon: Flag,
			action: () => navigate('/admin/feature-flags'),
			keywords: ['flags', 'toggles', 'features', 'rollout'],
			shortcut: 'G F',
			group: 'navigation',
		},
		{
			id: 'nav-system',
			label: t('sidebar.system'),
			icon: Activity,
			action: () => navigate('/admin/system'),
			keywords: ['health', 'status', 'monitoring', 'cron', 'jobs'],
			shortcut: 'G Y',
			group: 'navigation',
		},
		{
			id: 'nav-settings',
			label: t('sidebar.settings'),
			icon: Settings,
			action: () => navigate('/admin/settings'),
			keywords: ['config', 'preferences', 'options'],
			shortcut: 'G S',
			group: 'navigation',
		},
		// Actions
		{
			id: 'action-seed-plans',
			label: t('commandPalette.seedPlans'),
			icon: Plus,
			action: () => {
				navigate('/admin/plans')
				// The plans page will have the seed button
			},
			keywords: ['create', 'init', 'setup'],
			group: 'actions',
		},
		{
			id: 'action-sync-stripe',
			label: t('commandPalette.syncStripe'),
			icon: RefreshCw,
			action: () => navigate('/admin/plans'),
			keywords: ['stripe', 'billing', 'update'],
			group: 'actions',
		},
		{
			id: 'action-view-errors',
			label: t('commandPalette.viewErrors'),
			icon: AlertTriangle,
			action: () => navigate('/admin/dlq?status=failed'),
			keywords: ['failed', 'issues', 'problems'],
			group: 'actions',
		},
		// Quick exits
		{
			id: 'nav-back',
			label: t('sidebar.backToApp'),
			icon: ArrowLeft,
			action: () => navigate('/'),
			keywords: ['exit', 'leave', 'home'],
			group: 'navigation',
		},
	]

	const navigationItems = commands.filter((c) => c.group === 'navigation')
	const actionItems = commands.filter((c) => c.group === 'actions')

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="admin-command-trigger" aria-label={t('commandPalette.open')}>
				<Search className="h-4 w-4" />
				<span>{t('commandPalette.search')}</span>
				<kbd className="admin-kbd">⌘K</kbd>
			</Dialog.Trigger>

			<Dialog.Portal>
				{/* Base UI Dialog handles escape key and outside click automatically */}
				<Dialog.Backdrop className="admin-command-backdrop" />

				<Dialog.Popup className="admin-command-dialog">
					{/* Hidden title for accessibility */}
					<Dialog.Title className="sr-only">{t('commandPalette.title')}</Dialog.Title>
					<Dialog.Description className="sr-only">
						{t('commandPalette.description')}
					</Dialog.Description>

					<Command shouldFilter={true} loop>
						{/* Search Input */}
						<div className="admin-command-input-wrapper">
							<Search className="h-4 w-4 text-[var(--admin-text-muted)]" />
							<Command.Input
								ref={inputRef}
								value={search}
								onValueChange={setSearch}
								placeholder={t('commandPalette.placeholder')}
								className="admin-command-input"
							/>
							{search && (
								<button
									type="button"
									onClick={() => setSearch('')}
									className="admin-command-clear"
									aria-label={t('commandPalette.clear')}
								>
									<X className="h-4 w-4" />
								</button>
							)}
							<Dialog.Close
								className="admin-command-close"
								aria-label={t('commandPalette.close')}
							>
								<kbd className="admin-kbd text-xs">esc</kbd>
							</Dialog.Close>
						</div>

						{/* Command List */}
						<Command.List className="admin-command-list">
							<Command.Empty className="admin-command-empty">
								{t('commandPalette.noResults')}
							</Command.Empty>

							{/* Navigation Group */}
							<Command.Group
								heading={t('commandPalette.navigation')}
								className="admin-command-group"
							>
								{navigationItems.map((item) => (
									<Command.Item
										key={item.id}
										value={`${item.label} ${item.keywords?.join(' ') || ''}`}
										onSelect={item.action}
										className="admin-command-item"
									>
										<item.icon className="h-4 w-4" />
										<span>{item.label}</span>
										{item.shortcut && <kbd className="admin-kbd ml-auto">{item.shortcut}</kbd>}
									</Command.Item>
								))}
							</Command.Group>

							{/* Actions Group */}
							<Command.Group heading={t('commandPalette.actions')} className="admin-command-group">
								{actionItems.map((item) => (
									<Command.Item
										key={item.id}
										value={`${item.label} ${item.keywords?.join(' ') || ''}`}
										onSelect={item.action}
										className="admin-command-item"
									>
										<item.icon className="h-4 w-4" />
										<span>{item.label}</span>
										{item.shortcut && <kbd className="admin-kbd ml-auto">{item.shortcut}</kbd>}
									</Command.Item>
								))}
							</Command.Group>
						</Command.List>

						{/* Footer */}
						<div className="admin-command-footer">
							<div className="admin-command-footer-hint">
								<kbd className="admin-kbd">↑↓</kbd>
								<span>{t('commandPalette.navigate')}</span>
							</div>
							<div className="admin-command-footer-hint">
								<kbd className="admin-kbd">↵</kbd>
								<span>{t('commandPalette.select')}</span>
							</div>
							<div className="admin-command-footer-hint">
								<kbd className="admin-kbd">esc</kbd>
								<span>{t('commandPalette.close')}</span>
							</div>
						</div>
					</Command>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

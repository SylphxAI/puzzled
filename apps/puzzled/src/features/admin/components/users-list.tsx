'use client'

import {
	AlertCircle,
	CheckCircle,
	ChevronDown,
	Download,
	Search,
	Shield,
	ShieldOff,
	Sparkles,
	UserCheck,
	XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import { isPremiumPlan } from '@/features/subscription'
import type { Subscription, User } from '@/lib/db/schema'
import { isAdminRole, isSuperAdminRole, ROLE_ADMIN, ROLE_USER } from '@/lib/roles'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@sylphx/ui'
import { trpc } from '@/trpc/client'

type UserWithSubscription = User & { subscription: Subscription | null }

type FilterType = 'all' | 'admin' | 'premium' | 'verified' | 'unverified'
type SortField = 'name' | 'email' | 'createdAt' | 'role'
type SortOrder = 'asc' | 'desc'

export function UsersList({
	users,
	currentUserIsSuperAdmin = false,
}: {
	users: UserWithSubscription[]
	currentUserIsSuperAdmin?: boolean
}) {
	const t = useTranslations('admin.users')
	const [search, setSearch] = useState('')
	const [filter, setFilter] = useState<FilterType>('all')
	const [sortField, setSortField] = useState<SortField>('createdAt')
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const router = useRouter()

	// Filter and sort users
	const processedUsers = useMemo(() => {
		let result = [...users]

		// Apply search filter
		if (search) {
			const searchLower = search.toLowerCase()
			result = result.filter(
				(u) =>
					u.email.toLowerCase().includes(searchLower) ||
					u.name?.toLowerCase().includes(searchLower) ||
					u.id.toLowerCase().includes(searchLower),
			)
		}

		// Apply type filter
		switch (filter) {
			case 'admin':
				result = result.filter((u) => isAdminRole(u.role))
				break
			case 'premium':
				result = result.filter((u) => u.subscription && isPremiumPlan(u.subscription.plan))
				break
			case 'verified':
				result = result.filter((u) => u.emailVerified)
				break
			case 'unverified':
				result = result.filter((u) => !u.emailVerified)
				break
		}

		// Apply sorting
		result.sort((a, b) => {
			let comparison = 0
			switch (sortField) {
				case 'name':
					comparison = (a.name || '').localeCompare(b.name || '')
					break
				case 'email':
					comparison = a.email.localeCompare(b.email)
					break
				case 'createdAt':
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					break
				case 'role':
					comparison = (a.role || '').localeCompare(b.role || '')
					break
			}
			return sortOrder === 'asc' ? comparison : -comparison
		})

		return result
	}, [users, search, filter, sortField, sortOrder])

	// Select/deselect all
	const toggleSelectAll = useCallback(() => {
		if (selectedIds.size === processedUsers.length) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(processedUsers.map((u) => u.id)))
		}
	}, [processedUsers, selectedIds.size])

	// Toggle single selection
	const toggleSelect = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	// Export to CSV
	const exportToCSV = useCallback(() => {
		const usersToExport = selectedIds.size > 0 ? users.filter((u) => selectedIds.has(u.id)) : users

		const headers = ['ID', 'Name', 'Email', 'Role', 'Plan', 'Verified', 'Created At']
		const rows = usersToExport.map((u) => [
			u.id,
			u.name || '',
			u.email,
			u.role,
			u.subscription?.plan || 'free',
			u.emailVerified ? 'Yes' : 'No',
			new Date(u.createdAt).toISOString(),
		])

		const csvContent = [headers, ...rows]
			.map((row) => row.map((cell) => `"${cell}"`).join(','))
			.join('\n')

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		link.href = URL.createObjectURL(blob)
		link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
		link.click()
	}, [users, selectedIds])

	// Bulk role change mutation
	const bulkUpdateRole = trpc.admin.bulkUpdateUserRole.useMutation({
		onSuccess: () => {
			setSelectedIds(new Set())
			router.refresh()
		},
	})

	// Handle bulk role change
	const handleBulkRoleChange = (role: typeof ROLE_USER | typeof ROLE_ADMIN) => {
		const userIds = Array.from(selectedIds).filter((id) => {
			const user = users.find((u) => u.id === id)
			return user && !isSuperAdminRole(user.role) // Skip super_admins
		})

		if (userIds.length > 0) {
			bulkUpdateRole.mutate({ userIds, role })
		}
	}

	// Sort handler
	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
		} else {
			setSortField(field)
			setSortOrder('asc')
		}
	}

	const selectedCount = selectedIds.size
	const allSelected = selectedIds.size === processedUsers.length && processedUsers.length > 0

	return (
		<div className="admin-card admin-animate-in" style={{ animationDelay: '0.2s' }}>
			{/* Toolbar */}
			<div className="admin-card-header flex flex-wrap items-center gap-3 p-4">
				{/* Search */}
				<div className="admin-search flex-1">
					<Search className="admin-search-icon h-4 w-4" aria-hidden="true" />
					<input
						type="search"
						placeholder={t('searchPlaceholder')}
						aria-label={t('searchPlaceholder')}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="admin-input w-full pl-10"
					/>
				</div>

				{/* Filter dropdown */}
				<select
					value={filter}
					onChange={(e) => setFilter(e.target.value as FilterType)}
					className="admin-select"
					aria-label={t('filterLabel')}
				>
					<option value="all">{t('filterAll')}</option>
					<option value="admin">{t('filterAdmins')}</option>
					<option value="premium">{t('filterPremium')}</option>
					<option value="verified">{t('filterVerified')}</option>
					<option value="unverified">{t('filterUnverified')}</option>
				</select>

				{/* Export button */}
				<button type="button" onClick={exportToCSV} className="admin-btn admin-btn-ghost">
					<Download className="h-4 w-4" aria-hidden="true" />
					{t('export')}
				</button>

				{/* Bulk actions */}
				{selectedCount > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type="button" className="admin-btn admin-btn-primary">
								{t('bulkActions', { count: selectedCount })}
								<ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem
								onClick={() => handleBulkRoleChange(ROLE_ADMIN)}
								disabled={bulkUpdateRole.isPending}
							>
								<Shield className="mr-2 h-4 w-4" aria-hidden="true" />
								{t('makeAdminBulk')}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => handleBulkRoleChange(ROLE_USER)}
								disabled={bulkUpdateRole.isPending}
							>
								<ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
								{t('removeAdminBulk')}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={exportToCSV}>
								<Download className="mr-2 h-4 w-4" aria-hidden="true" />
								{t('exportSelected')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			{/* Error Display */}
			{bulkUpdateRole.error && (
				<div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-[var(--admin-error)]/10 p-3 text-sm text-[var(--admin-error)]">
					<AlertCircle className="h-4 w-4 shrink-0" />
					{bulkUpdateRole.error.message}
				</div>
			)}

			{/* Table */}
			<div className="overflow-x-auto">
				<table className="admin-table">
					<thead>
						<tr>
							<th scope="col" className="w-10">
								<input
									type="checkbox"
									checked={allSelected}
									onChange={toggleSelectAll}
									className="admin-checkbox"
									aria-label={t('selectAll')}
								/>
							</th>
							<th scope="col">
								<button
									type="button"
									onClick={() => handleSort('name')}
									className="admin-table-sort-btn"
								>
									{t('tableHeaders.user')}
									{sortField === 'name' && <SortIndicator order={sortOrder} />}
								</button>
							</th>
							<th scope="col">
								<button
									type="button"
									onClick={() => handleSort('role')}
									className="admin-table-sort-btn"
								>
									{t('tableHeaders.role')}
									{sortField === 'role' && <SortIndicator order={sortOrder} />}
								</button>
							</th>
							<th scope="col">{t('tableHeaders.plan')}</th>
							<th scope="col">{t('tableHeaders.verified')}</th>
							<th scope="col">
								<button
									type="button"
									onClick={() => handleSort('createdAt')}
									className="admin-table-sort-btn"
								>
									{t('tableHeaders.joined')}
									{sortField === 'createdAt' && <SortIndicator order={sortOrder} />}
								</button>
							</th>
							<th scope="col">{t('tableHeaders.actions')}</th>
						</tr>
					</thead>
					<tbody>
						{processedUsers.map((user) => (
							<UserRow
								key={user.id}
								user={user}
								selected={selectedIds.has(user.id)}
								onToggleSelect={() => toggleSelect(user.id)}
								currentUserIsSuperAdmin={currentUserIsSuperAdmin}
							/>
						))}
					</tbody>
				</table>
			</div>

			{processedUsers.length === 0 && (
				<div className="py-12 text-center text-[var(--admin-text-muted)]">{t('noUsersFound')}</div>
			)}

			{/* Footer with count */}
			<div className="admin-card-footer flex items-center justify-between px-4 py-3">
				<span className="text-sm text-[var(--admin-text-muted)]">
					{t('showingUsers', { count: processedUsers.length, total: users.length })}
				</span>
				{selectedCount > 0 && (
					<span className="text-sm text-[var(--admin-accent)]">
						{t('selectedUsers', { count: selectedCount })}
					</span>
				)}
			</div>
		</div>
	)
}

function SortIndicator({ order }: { order: SortOrder }) {
	return <span className="ml-1 text-[var(--admin-accent)]">{order === 'asc' ? '↑' : '↓'}</span>
}

function UserRow({
	user,
	selected,
	onToggleSelect,
	currentUserIsSuperAdmin = false,
}: {
	user: UserWithSubscription
	selected: boolean
	onToggleSelect: () => void
	currentUserIsSuperAdmin?: boolean
}) {
	const t = useTranslations('admin.users')
	const locale = useLocale()
	const router = useRouter()

	const isAdmin = isAdminRole(user.role)
	const isSuperAdmin = isSuperAdminRole(user.role)

	const updateRole = trpc.admin.updateUserRole.useMutation({
		onSuccess: () => {
			router.refresh()
		},
	})

	const impersonateMutation = trpc.admin.startImpersonation.useMutation({
		onSuccess: () => {
			// Redirect to home as the impersonated user
			router.push('/')
			router.refresh()
		},
	})

	const toggleAdmin = () => {
		if (isSuperAdmin) return // Can't demote super_admin
		const newRole = isAdminRole(user.role) ? ROLE_USER : ROLE_ADMIN
		updateRole.mutate({ userId: user.id, role: newRole })
	}

	const handleImpersonate = () => {
		if (!isSuperAdmin) {
			impersonateMutation.mutate({ userId: user.id })
		}
	}

	return (
		<tr className={selected ? 'bg-[var(--admin-accent-subtle)]' : ''}>
			<td>
				<input
					type="checkbox"
					checked={selected}
					onChange={onToggleSelect}
					className="admin-checkbox"
					aria-label={t('selectUser', { name: user.name || user.email })}
				/>
			</td>
			<td>
				<div className="flex items-center gap-3">
					<div className="admin-avatar">{user.name?.[0] || user.email[0].toUpperCase()}</div>
					<div>
						<div className="font-medium text-[var(--admin-text-primary)]">
							{user.name || t('unnamed', { defaultValue: 'Unnamed' })}
						</div>
						<div className="text-sm text-[var(--admin-text-muted)]">{user.email}</div>
					</div>
				</div>
			</td>
			<td>
				<span
					className={`admin-badge ${
						isSuperAdmin
							? 'admin-badge-accent'
							: isAdmin
								? 'admin-badge-warning'
								: 'admin-badge-default'
					}`}
				>
					{isAdmin && <Shield className="h-3 w-3" aria-hidden="true" />}
					{user.role}
				</span>
			</td>
			<td>
				<span
					className={`admin-badge ${
						user.subscription && isPremiumPlan(user.subscription.plan)
							? 'admin-badge-accent'
							: 'admin-badge-default'
					}`}
				>
					{user.subscription && isPremiumPlan(user.subscription.plan) ? (
						<Sparkles className="h-3 w-3" aria-hidden="true" />
					) : null}
					{user.subscription?.plan || t('free')}
				</span>
			</td>
			<td>
				{user.emailVerified ? (
					<span className="inline-flex items-center gap-1 text-[var(--admin-success)]">
						<CheckCircle className="h-4 w-4" aria-hidden="true" />
						<span className="sr-only">{t('verified')}</span>
					</span>
				) : (
					<span className="inline-flex items-center gap-1 text-[var(--admin-text-muted)]">
						<XCircle className="h-4 w-4" aria-hidden="true" />
						<span className="sr-only">{t('notVerified')}</span>
					</span>
				)}
			</td>
			<td className="text-sm text-[var(--admin-text-muted)]">
				{new Date(user.createdAt).toLocaleDateString(locale)}
			</td>
			<td>
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1">
						{!isSuperAdmin && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost text-xs"
								onClick={toggleAdmin}
								disabled={updateRole.isPending}
							>
								{isAdmin ? (
									<>
										<ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
										{t('removeAdmin')}
									</>
								) : (
									<>
										<Shield className="h-3.5 w-3.5" aria-hidden="true" />
										{t('makeAdmin')}
									</>
								)}
							</button>
						)}
						{currentUserIsSuperAdmin && !isSuperAdmin && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost text-xs"
								onClick={handleImpersonate}
								disabled={impersonateMutation.isPending}
								title={t('impersonate')}
							>
								<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
								{t('impersonate')}
							</button>
						)}
					</div>
					{(updateRole.error || impersonateMutation.error) && (
						<span className="text-xs text-[var(--admin-error)]">
							{updateRole.error?.message || impersonateMutation.error?.message}
						</span>
					)}
				</div>
			</td>
		</tr>
	)
}

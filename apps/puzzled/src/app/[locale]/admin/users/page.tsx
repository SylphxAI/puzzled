export const dynamic = 'force-dynamic'

import { desc, eq } from 'drizzle-orm'
import { Crown, Shield, UserCheck, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { currentUserId } from '@sylphx/platform-sdk/nextjs'
import { UsersList } from '@/features/admin/components/users-list'
import { isPremiumPlan } from '@/lib/billing/plans'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isAdminRole, isSuperAdminRole } from '@/lib/roles'

async function getUsers() {
	return db.query.users.findMany({
		with: {
			subscription: true,
		},
		orderBy: desc(users.createdAt),
	})
}

export default async function AdminUsersPage() {
	const [t, allUsers, userId] = await Promise.all([
		getTranslations('admin.users'),
		getUsers(),
		currentUserId(),
	])

	// Fetch current user's role from the database
	const currentUserRecord = userId
		? await db.query.users.findFirst({
				where: eq(users.id, userId),
			})
		: null

	const currentUserIsSuperAdmin = currentUserRecord ? isSuperAdminRole(currentUserRecord.role) : false

	const stats = {
		total: allUsers.length,
		admins: allUsers.filter((u) => isAdminRole(u.role)).length,
		premium: allUsers.filter((u) => u.subscription && isPremiumPlan(u.subscription.plan)).length,
		verified: allUsers.filter((u) => u.emailVerified).length,
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-4">
				<StatCard label={t('totalUsers')} value={stats.total} icon={Users} delay={0} />
				<StatCard label={t('admins')} value={stats.admins} icon={Shield} delay={1} />
				<StatCard label={t('premium')} value={stats.premium} icon={Crown} delay={2} />
				<StatCard label={t('verified')} value={stats.verified} icon={UserCheck} delay={3} />
			</div>

			{/* Users List */}
			<UsersList users={allUsers} currentUserIsSuperAdmin={currentUserIsSuperAdmin} />
		</div>
	)
}

function StatCard({
	label,
	value,
	icon: Icon,
	delay = 0,
}: {
	label: string
	value: number
	icon: typeof Users
	delay?: number
}) {
	return (
		<div
			className="admin-stat-card admin-animate-in p-5"
			style={{ animationDelay: `${delay * 0.05}s` }}
		>
			<div className="flex items-center gap-3">
				<div className="admin-stat-icon">
					<Icon className="h-4 w-4" aria-hidden="true" />
				</div>
				<div>
					<div className="admin-stat-value text-xl">{value}</div>
					<div className="admin-stat-label text-xs">{label}</div>
				</div>
			</div>
		</div>
	)
}

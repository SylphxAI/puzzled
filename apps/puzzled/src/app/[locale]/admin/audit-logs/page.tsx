export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/features/admin'
import { AuditLogsView } from './audit-logs-view'

export default async function AdminAuditLogsPage() {
	// Each page re-checks admin: an RSC request for the page alone skips the layout.
	await requireAdmin()
	return <AuditLogsView />
}

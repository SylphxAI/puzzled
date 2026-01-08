/**
 * Role Constants
 *
 * Re-exports from @sylphx/admin/rbac for backwards compatibility.
 * UserRole type is derived from schema (SSOT).
 */

import type { UserRole } from '@/lib/db/schema'

// Re-export UserRole from schema (SSOT)
export type { UserRole }

// Re-export everything from @sylphx/admin/rbac
export {
	ROLE_USER,
	ROLE_ADMIN,
	ROLE_SUPER_ADMIN,
	ADMIN_ROLES,
	ALL_ROLES,
	isAdminRole,
	isSuperAdminRole,
	type AdminRole,
} from '@sylphx/admin/rbac'

import { isAdminRole } from '@/lib/roles'
import { useSession } from '../lib/auth-client'

/**
 * Check if current user has admin privileges
 * Returns { isAdmin, isLoading }
 */
export function useIsAdmin() {
	const { data: session, isPending } = useSession()
	const role = session?.user?.role as string | undefined
	const isAdmin = isAdminRole(role)

	return {
		isAdmin,
		isLoading: isPending,
	}
}

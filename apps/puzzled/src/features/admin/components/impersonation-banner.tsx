'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { trpc } from '@/trpc/client'

export function ImpersonationBanner() {
	const t = useTranslations('admin.impersonation')
	const router = useRouter()

	const { data: state, isLoading } = trpc.admin.getImpersonationState.useQuery(undefined, {
		refetchInterval: 30000, // Check every 30 seconds
	})

	const stopMutation = trpc.admin.stopImpersonation.useMutation({
		onSuccess: () => {
			router.push('/admin/users')
			router.refresh()
		},
	})

	// Don't render if not impersonating
	if (isLoading || !state) {
		return null
	}

	return (
		<div className="fixed left-0 right-0 top-0 z-[100] flex flex-col bg-amber-500 px-4 py-2 text-black">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<AlertTriangle className="h-4 w-4" aria-hidden="true" />
					<span className="text-sm font-medium">{t('banner', { email: state.targetEmail })}</span>
				</div>
				<button
					type="button"
					onClick={() => stopMutation.mutate()}
					disabled={stopMutation.isPending}
					className="flex items-center gap-1 rounded bg-black/20 px-3 py-1 text-sm font-medium hover:bg-black/30 disabled:opacity-50"
				>
					<X className="h-4 w-4" aria-hidden="true" />
					{t('stop')}
				</button>
			</div>
			{stopMutation.error && (
				<p className="mt-1 text-xs text-red-800">{stopMutation.error.message}</p>
			)}
		</div>
	)
}

'use client'

import { RefreshCw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@sylphx/ui'
import { trpc } from '@/trpc/client'

export function SeedPlansButton() {
	const router = useRouter()
	const toast = useToast()

	const seedMutation = trpc.admin.seedPlans.useMutation({
		onSuccess: () => {
			toast.success('Plans seeded', 'Default plans created and synced to Stripe')
			router.refresh()
		},
		onError: (error) => {
			toast.error('Failed to seed plans', error.message || 'An error occurred')
		},
	})

	return (
		<Button
			onClick={() => seedMutation.mutate({ syncToStripe: true })}
			disabled={seedMutation.isPending}
		>
			<Sparkles className={`mr-2 h-4 w-4 ${seedMutation.isPending ? 'animate-pulse' : ''}`} />
			{seedMutation.isPending ? 'Creating...' : 'Seed Default Plans'}
		</Button>
	)
}

export function SyncPlansButton() {
	const router = useRouter()
	const toast = useToast()

	const syncMutation = trpc.admin.syncAllPlans.useMutation({
		onSuccess: (data) => {
			toast.success('Plans synced', `${data.synced} plans synced to Stripe`)
			router.refresh()
		},
		onError: (error) => {
			toast.error('Failed to sync plans', error.message || 'An error occurred')
		},
	})

	return (
		<Button
			variant="outline"
			onClick={() => syncMutation.mutate()}
			disabled={syncMutation.isPending}
		>
			<RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
			{syncMutation.isPending ? 'Syncing...' : 'Sync All to Stripe'}
		</Button>
	)
}

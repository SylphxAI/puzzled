'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@sylphx/ui'
import { trpc } from '@/trpc/client'

export function SeedPlansButton() {
	const router = useRouter()
	const toast = useToast()

	const seedMutation = trpc.admin.seedPlans.useMutation({
		onSuccess: () => {
			toast.success('Plans seeded', 'Default plans created')
			router.refresh()
		},
		onError: (error) => {
			toast.error('Failed to seed plans', error.message || 'An error occurred')
		},
	})

	return (
		<Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
			<Sparkles className={`mr-2 h-4 w-4 ${seedMutation.isPending ? 'animate-pulse' : ''}`} />
			{seedMutation.isPending ? 'Creating...' : 'Seed Default Plans'}
		</Button>
	)
}

// Note: SyncPlansButton removed - platform handles Stripe sync

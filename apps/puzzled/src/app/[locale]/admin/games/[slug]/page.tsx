export const dynamic = 'force-dynamic'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GameDashboard } from '@/features/admin/components/game-dashboard'
import { getGameConfig } from '@/games/registry'

type Params = Promise<{ slug: string }>

export default async function AdminGameDetailPage({ params }: { params: Params }) {
	const { slug } = await params

	// Validate game exists
	const game = getGameConfig(slug)
	if (!game) {
		notFound()
	}

	return (
		<div className="space-y-6">
			{/* Back link */}
			<Link
				href="/admin/games"
				className="inline-flex items-center gap-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Games
			</Link>

			{/* Game Dashboard */}
			<GameDashboard slug={slug} />
		</div>
	)
}

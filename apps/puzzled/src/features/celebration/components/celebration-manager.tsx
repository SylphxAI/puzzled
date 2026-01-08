'use client'

import { Flame, Gem, Medal, Star, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Celebration, StarBurst, WinBurst } from '@/features/celebration/components'
import { triggerHaptic, triggerSound } from '@/shared/hooks'

type CelebrationEvent = {
	type: 'win' | 'perfect' | 'streak-milestone' | 'achievement' | 'hot-streak'
	data?: {
		attempts?: number
		streak?: number
		achievementName?: string
	}
}

type CelebrationManagerProps = {
	onCelebrationComplete?: () => void
}

export function useCelebration() {
	const [event, setEvent] = useState<CelebrationEvent | null>(null)

	const celebrate = useCallback((newEvent: CelebrationEvent) => {
		setEvent(newEvent)
	}, [])

	const clear = useCallback(() => {
		setEvent(null)
	}, [])

	return { event, celebrate, clear }
}

export function CelebrationManager({ onCelebrationComplete }: CelebrationManagerProps) {
	const [currentEvent, setCurrentEvent] = useState<CelebrationEvent | null>(null)
	const [isAnimating, setIsAnimating] = useState(false)

	// Listen for celebration events from a global event bus
	useEffect(() => {
		const handleCelebration = (e: CustomEvent<CelebrationEvent>) => {
			setCurrentEvent(e.detail)
			setIsAnimating(true)
		}

		window.addEventListener('celebrate' as keyof WindowEventMap, handleCelebration as EventListener)
		return () => {
			window.removeEventListener(
				'celebrate' as keyof WindowEventMap,
				handleCelebration as EventListener,
			)
		}
	}, [])

	const handleComplete = useCallback(() => {
		setIsAnimating(false)
		setCurrentEvent(null)
		onCelebrationComplete?.()
	}, [onCelebrationComplete])

	if (!currentEvent || !isAnimating) return null

	switch (currentEvent.type) {
		case 'win':
			// Trigger sound and haptic feedback
			triggerSound('win')
			triggerHaptic('win')
			// WinBurst auto-hides after 600ms
			setTimeout(handleComplete, 700)
			return <WinBurst show={true} />

		case 'perfect':
			// Perfect game gets enhanced celebration
			triggerSound('perfectWin')
			triggerHaptic('win')
			return (
				<>
					<StarBurst show={true} />
					<Celebration show={true} onComplete={handleComplete} />
				</>
			)

		case 'streak-milestone':
			triggerSound('streak')
			triggerHaptic('streak')
			return (
				<StreakMilestoneCelebration
					streak={currentEvent.data?.streak || 0}
					onComplete={handleComplete}
				/>
			)

		case 'achievement':
			triggerSound('achievement')
			triggerHaptic('achievement')
			return (
				<AchievementCelebration
					name={currentEvent.data?.achievementName || 'Achievement'}
					onComplete={handleComplete}
				/>
			)

		case 'hot-streak':
			triggerSound('streak')
			triggerHaptic('streak')
			return <HotStreakCelebration onComplete={handleComplete} />

		default:
			triggerSound('win')
			triggerHaptic('win')
			return <Celebration show={true} onComplete={handleComplete} />
	}
}

// Trigger a celebration from anywhere
export function triggerCelebration(event: CelebrationEvent) {
	window.dispatchEvent(new CustomEvent('celebrate', { detail: event }))
}

// Special celebration for streak milestones (7, 30, 100, 365)
function StreakMilestoneCelebration({
	streak,
	onComplete,
}: {
	streak: number
	onComplete: () => void
}) {
	useEffect(() => {
		const timeout = setTimeout(onComplete, 3000)
		return () => clearTimeout(timeout)
	}, [onComplete])

	const getMilestoneIcon = (s: number) => {
		if (s >= 365) return <Trophy className="h-12 w-12 text-yellow-500" aria-label="Trophy" />
		if (s >= 100) return <Gem className="h-12 w-12 text-purple-500" aria-label="Diamond" />
		if (s >= 30) return <Star className="h-12 w-12 text-yellow-400" aria-label="Star" />
		return <Flame className="h-12 w-12 text-orange-500" aria-label="Fire" />
	}

	const getMilestoneTitle = (s: number) => {
		if (s >= 365) return 'LEGENDARY!'
		if (s >= 100) return 'INCREDIBLE!'
		if (s >= 30) return 'AMAZING!'
		return 'AWESOME!'
	}

	return (
		<div className="pointer-events-none fixed inset-0 z-toast flex items-center justify-center bg-black/50 animate-fade-in">
			<div className="animate-bounce-once rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 p-8 text-center text-white shadow-2xl">
				<div className="flex justify-center">{getMilestoneIcon(streak)}</div>
				<div className="mt-4 text-3xl font-bold">{getMilestoneTitle(streak)}</div>
				<div className="mt-2 text-xl">{streak}-Day Streak!</div>
			</div>
			<Celebration show={true} onComplete={() => {}} />
		</div>
	)
}

// Achievement unlock celebration
function AchievementCelebration({ name, onComplete }: { name: string; onComplete: () => void }) {
	useEffect(() => {
		const timeout = setTimeout(onComplete, 2000)
		return () => clearTimeout(timeout)
	}, [onComplete])

	return (
		<div className="pointer-events-none fixed inset-0 z-toast flex items-center justify-center">
			<div className="animate-pop rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-6 text-center text-white shadow-2xl">
				<div className="flex justify-center">
					<Medal className="h-10 w-10 text-yellow-300" aria-label="Medal" />
				</div>
				<div className="mt-2 text-sm font-medium opacity-80">ACHIEVEMENT UNLOCKED</div>
				<div className="mt-1 text-lg font-bold">{name}</div>
			</div>
		</div>
	)
}

// Hot streak celebration (3+ wins in a session)
function HotStreakCelebration({ onComplete }: { onComplete: () => void }) {
	useEffect(() => {
		const timeout = setTimeout(onComplete, 1500)
		return () => clearTimeout(timeout)
	}, [onComplete])

	return (
		<div className="pointer-events-none fixed inset-0 z-toast flex items-center justify-center">
			<div className="flex items-center gap-2 animate-slide-up rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-white shadow-lg">
				<Flame className="h-6 w-6" aria-label="Fire" />
				<span className="text-lg font-bold">ON FIRE!</span>
			</div>
		</div>
	)
}

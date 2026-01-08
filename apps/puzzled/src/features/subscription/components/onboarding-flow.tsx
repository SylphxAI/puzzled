'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/features/auth'
import { useOnboardingState } from '../hooks'
import { PremiumPrompt } from './premium-prompt'
import { SignupPrompt } from './signup-prompt'
import { WelcomeModal } from './welcome-modal'

/**
 * OnboardingFlow - Manages the guest user onboarding experience
 *
 * Flow:
 * 1. First visit: Show WelcomeModal
 * 2. After 1st game as guest: Show SignupPrompt
 * 3. After 3rd game as guest: Show PremiumPrompt
 *
 * Only shows for non-authenticated users
 */
export function OnboardingFlow() {
	const { data: session } = useSession()
	const {
		shouldShowWelcome,
		shouldShowSignupPrompt,
		shouldShowPremiumPrompt,
		markWelcomeSeen,
		dismissSignupPrompt,
		dismissPremiumPrompt,
		state,
	} = useOnboardingState()

	// Local state to control which modal is currently visible
	const [activeModal, setActiveModal] = useState<'welcome' | 'signup' | 'premium' | null>(null)

	// Only show onboarding for guest users
	const isGuest = !session?.user

	// Determine which modal to show based on priority
	useEffect(() => {
		if (!isGuest) {
			setActiveModal(null)
			return
		}

		// Priority: Welcome > Signup > Premium
		if (shouldShowWelcome) {
			setActiveModal('welcome')
		} else if (shouldShowSignupPrompt) {
			setActiveModal('signup')
		} else if (shouldShowPremiumPrompt) {
			setActiveModal('premium')
		} else {
			setActiveModal(null)
		}
	}, [isGuest, shouldShowWelcome, shouldShowSignupPrompt, shouldShowPremiumPrompt])

	// Handlers
	const handleWelcomeClose = () => {
		markWelcomeSeen()
		setActiveModal(null)
	}

	const handleWelcomePlay = () => {
		markWelcomeSeen()
		setActiveModal(null)
		// Scroll to games section or do nothing (games are already visible)
	}

	const handleSignupDismiss = () => {
		dismissSignupPrompt()
		setActiveModal(null)
	}

	const handlePremiumDismiss = () => {
		dismissPremiumPrompt()
		setActiveModal(null)
	}

	if (!isGuest) {
		return null
	}

	return (
		<>
			{/* Welcome Modal - First visit */}
			{activeModal === 'welcome' && (
				<WelcomeModal onClose={handleWelcomeClose} onPlay={handleWelcomePlay} />
			)}

			{/* Signup Prompt - After 1st game */}
			{activeModal === 'signup' && (
				<SignupPrompt
					guestStreak={state.gamesCompletedAsGuest}
					onDismiss={handleSignupDismiss}
					variant="modal"
				/>
			)}

			{/* Premium Prompt - After 3rd game */}
			{activeModal === 'premium' && (
				<PremiumPrompt
					currentStreak={state.gamesCompletedAsGuest}
					onDismiss={handlePremiumDismiss}
					variant="streak-milestone"
				/>
			)}
		</>
	)
}

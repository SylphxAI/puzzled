/**
 * Sound Effects Hook
 *
 * Provides synthesized sound effects for game events using Web Audio API.
 * No external audio files required - all sounds are generated programmatically.
 *
 * Features:
 * - Zero-dependency sound synthesis
 * - Respects user preferences (localStorage)
 * - Graceful degradation on unsupported browsers
 * - Mobile-friendly (unlocks audio context on first interaction)
 *
 * Usage:
 *   const { playSound, toggleSound, isMuted } = useSound()
 *   playSound('win')
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Sound effect types
export type SoundEffect =
	| 'keyPress'
	| 'submit'
	| 'correct'
	| 'present'
	| 'absent'
	| 'error'
	| 'win'
	| 'perfectWin'
	| 'lose'
	| 'achievement'
	| 'streak'
	| 'select'
	| 'deselect'
	| 'categoryFound'
	| 'almostThere'
	| 'shuffle'

import { SOUND_ENABLED_KEY } from '@/lib/storage-keys'

/**
 * Get or create a shared AudioContext
 * Using a singleton to avoid creating multiple contexts
 */
let audioContext: AudioContext | null = null
let audioContextUnlocked = false

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null

	if (!audioContext) {
		try {
			audioContext = new (
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
			)()
		} catch {
			return null
		}
	}

	return audioContext
}

/**
 * Unlock audio context on user interaction (required for mobile)
 */
function unlockAudioContext() {
	if (audioContextUnlocked) return

	const ctx = getAudioContext()
	if (!ctx) return

	// Resume if suspended
	if (ctx.state === 'suspended') {
		ctx.resume()
	}

	// Create and play a silent buffer to unlock
	const buffer = ctx.createBuffer(1, 1, 22050)
	const source = ctx.createBufferSource()
	source.buffer = buffer
	source.connect(ctx.destination)
	source.start(0)

	audioContextUnlocked = true
}

// Register unlock on first user interaction
if (typeof window !== 'undefined') {
	const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown']
	const unlock = () => {
		unlockAudioContext()
		for (const e of unlockEvents) {
			document.removeEventListener(e, unlock)
		}
	}
	for (const e of unlockEvents) {
		document.addEventListener(e, unlock, { once: true })
	}
}

/**
 * Helper to create exponential decay on AudioParam
 * exponentialRampToValueAtTime doesn't accept 0, so we use a very small value
 */
function decayTo(param: AudioParam, value: number, endTime: number) {
	param.exponentialRampToValueAtTime(Math.max(value, 0.0001), endTime)
}

/**
 * Sound synthesis functions
 * Each function creates a unique sound using oscillators and gain nodes
 */
const soundGenerators: Record<SoundEffect, (ctx: AudioContext) => void> = {
	// Quick, subtle click for key presses
	keyPress: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.value = 800
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.05, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.05)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.05)
	},

	// Slightly more pronounced for submit
	submit: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.value = 600
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.1, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.1)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.1)
	},

	// Bright, positive tone for correct
	correct: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
		osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.15, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.2)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.2)
	},

	// Neutral tone for present (in word but wrong spot)
	present: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.value = 440 // A4
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.1, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.15)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.15)
	},

	// Low, muted tone for absent
	absent: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.value = 220 // A3
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.08, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.1)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.1)
	},

	// Error buzz
	error: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.value = 150
		osc.type = 'sawtooth'
		gain.gain.setValueAtTime(0.1, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.15)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.15)
	},

	// Victory fanfare - ascending arpeggio
	win: (ctx) => {
		const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
		notes.forEach((freq, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			const startTime = ctx.currentTime + i * 0.1
			gain.gain.setValueAtTime(0.15, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.3)

			osc.start(startTime)
			osc.stop(startTime + 0.3)
		})
	},

	// Perfect win - fuller chord + sparkle
	perfectWin: (ctx) => {
		// Main chord
		const chordNotes = [523.25, 659.25, 783.99] // C major
		chordNotes.forEach((freq) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			gain.gain.setValueAtTime(0.12, ctx.currentTime)
			decayTo(gain.gain, 0.001, ctx.currentTime + 0.5)

			osc.start(ctx.currentTime)
			osc.stop(ctx.currentTime + 0.5)
		})

		// Sparkle effect
		const sparkleNotes = [1318.51, 1567.98, 2093.0] // E6, G6, C7
		sparkleNotes.forEach((freq, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			const startTime = ctx.currentTime + 0.15 + i * 0.08
			gain.gain.setValueAtTime(0.08, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.2)

			osc.start(startTime)
			osc.stop(startTime + 0.2)
		})
	},

	// Lose - descending sad tone
	lose: (ctx) => {
		const notes = [392.0, 349.23, 329.63, 293.66] // G4, F4, E4, D4
		notes.forEach((freq, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			const startTime = ctx.currentTime + i * 0.15
			gain.gain.setValueAtTime(0.1, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.2)

			osc.start(startTime)
			osc.stop(startTime + 0.2)
		})
	},

	// Achievement unlock - triumphant chord
	achievement: (ctx) => {
		// Two-chord progression
		const chord1 = [349.23, 440.0, 523.25] // F4, A4, C5
		const chord2 = [392.0, 493.88, 587.33] // G4, B4, D5

		chord1.forEach((freq) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			gain.gain.setValueAtTime(0.1, ctx.currentTime)
			decayTo(gain.gain, 0.001, ctx.currentTime + 0.3)

			osc.start(ctx.currentTime)
			osc.stop(ctx.currentTime + 0.3)
		})

		chord2.forEach((freq) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			const startTime = ctx.currentTime + 0.25
			gain.gain.setValueAtTime(0.12, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.4)

			osc.start(startTime)
			osc.stop(startTime + 0.4)
		})
	},

	// Streak milestone - quick celebratory burst
	streak: (ctx) => {
		const notes = [659.25, 783.99, 987.77, 1174.66] // E5, G5, B5, D6
		notes.forEach((freq, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'triangle'
			const startTime = ctx.currentTime + i * 0.06
			gain.gain.setValueAtTime(0.1, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.15)

			osc.start(startTime)
			osc.stop(startTime + 0.15)
		})
	},

	// Selection sound (Connections)
	select: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.setValueAtTime(400, ctx.currentTime)
		osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05)
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.08, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.08)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.08)
	},

	// Deselection sound (Connections)
	deselect: (ctx) => {
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.setValueAtTime(500, ctx.currentTime)
		osc.frequency.setValueAtTime(400, ctx.currentTime + 0.05)
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.06, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.08)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.08)
	},

	// Category found (Connections) - satisfying resolution
	categoryFound: (ctx) => {
		const notes = [440, 554.37, 659.25] // A4, C#5, E5 (A major)
		notes.forEach((freq, i) => {
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.frequency.value = freq
			osc.type = 'sine'
			const startTime = ctx.currentTime + i * 0.05
			gain.gain.setValueAtTime(0.12, startTime)
			decayTo(gain.gain, 0.001, startTime + 0.25)

			osc.start(startTime)
			osc.stop(startTime + 0.25)
		})
	},

	// Almost there (one away) - encouraging ascending note
	almostThere: (ctx) => {
		// Rising tone that ends on a question mark - encouraging but incomplete
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.frequency.setValueAtTime(349.23, ctx.currentTime) // F4
		osc.frequency.setValueAtTime(392.0, ctx.currentTime + 0.1) // G4
		osc.frequency.setValueAtTime(440.0, ctx.currentTime + 0.2) // A4
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.12, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.35)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.35)
	},

	// Shuffle sound - quick playful swoosh
	shuffle: (ctx) => {
		// Descending then ascending whoosh effect
		const osc = ctx.createOscillator()
		const gain = ctx.createGain()
		osc.connect(gain)
		gain.connect(ctx.destination)

		// Start high, dip down, come back up
		osc.frequency.setValueAtTime(600, ctx.currentTime)
		osc.frequency.setValueAtTime(300, ctx.currentTime + 0.08)
		osc.frequency.setValueAtTime(500, ctx.currentTime + 0.15)
		osc.type = 'sine'
		gain.gain.setValueAtTime(0.08, ctx.currentTime)
		decayTo(gain.gain, 0.001, ctx.currentTime + 0.18)

		osc.start(ctx.currentTime)
		osc.stop(ctx.currentTime + 0.18)
	},
}

export function useSound() {
	const [isMuted, setIsMuted] = useState(() => {
		if (typeof window === 'undefined') return false
		const stored = localStorage.getItem(SOUND_ENABLED_KEY)
		// Default to enabled if not set
		return stored === 'false'
	})

	const contextRef = useRef<AudioContext | null>(null)

	// Initialize audio context lazily
	useEffect(() => {
		contextRef.current = getAudioContext()
	}, [])

	const playSound = useCallback(
		(effect: SoundEffect) => {
			if (isMuted) return

			const ctx = contextRef.current || getAudioContext()
			if (!ctx) return

			// Ensure context is running
			if (ctx.state === 'suspended') {
				ctx.resume()
			}

			try {
				soundGenerators[effect](ctx)
			} catch {
				// Silently fail if sound generation fails
			}
		},
		[isMuted],
	)

	const toggleSound = useCallback(() => {
		setIsMuted((prev) => {
			const newValue = !prev
			localStorage.setItem(SOUND_ENABLED_KEY, String(!newValue))
			return newValue
		})
	}, [])

	const setMuted = useCallback((muted: boolean) => {
		setIsMuted(muted)
		localStorage.setItem(SOUND_ENABLED_KEY, String(!muted))
	}, [])

	return useMemo(
		() => ({
			playSound,
			toggleSound,
			setMuted,
			isMuted,
			isSupported: typeof window !== 'undefined' && 'AudioContext' in window,
		}),
		[playSound, toggleSound, setMuted, isMuted],
	)
}

/**
 * Simple function to trigger sound effects without using the hook
 * Useful for one-off sounds in event handlers
 * Note: This respects the stored preference
 */
export function triggerSound(effect: SoundEffect): void {
	if (typeof window === 'undefined') return

	// Check stored preference
	const stored = localStorage.getItem(SOUND_ENABLED_KEY)
	if (stored === 'false') return

	const ctx = getAudioContext()
	if (!ctx) return

	// Ensure context is running
	if (ctx.state === 'suspended') {
		ctx.resume()
	}

	try {
		soundGenerators[effect](ctx)
	} catch {
		// Silently fail
	}
}

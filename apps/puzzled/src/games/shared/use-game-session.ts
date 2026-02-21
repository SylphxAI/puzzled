/**
 * Shared Game Session Hook
 *
 * Consolidates common game session logic across all games:
 * - Phase state machine (ready -> playing)
 * - localStorage for played status
 * - Timer tracking
 * - Save result logic (score calculated server-side)
 * - Guest state management
 * - Celebration + modal orchestration
 *
 * SECURITY ARCHITECTURE:
 * - Client NEVER calculates score
 * - Client sends submission data (moves, final state, etc.)
 * - Server validates AND calculates score via validateAndScore()
 */

import { useGuestGameState } from "@/features/daily/hooks/use-guest-game-state";
import { useSaveGameResult } from "@/features/gamification";
import type { PuzzleDifficulty } from "@/games/types";
import { getGameSessionKey } from "@/lib/storage-keys";
import {
	triggerHaptic,
	triggerSound,
	useGuestOnboarding,
} from "@/shared/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

/** Final game outcome - what gets saved to database */
type GameEndStatus = "won" | "lost";

export type GamePhase = "ready" | "playing";

/**
 * What client sends when game ends
 * NOTE: No score field - score is calculated server-side
 */
export interface GameEndData {
	status: GameEndStatus;
	attempts?: number;
	maxAttempts?: number;
	/** Mistakes made during gameplay (for UI display) */
	mistakes?: number;
	/** Hints used during gameplay (for UI display) */
	hintsUsed?: number;
	/**
	 * Game-specific submission data for server validation
	 * Each game defines what data it needs:
	 * - Wordle: { guesses: string[] }
	 * - Sudoku: { finalGrid: number[][] }
	 * - Queens: { finalGrid: boolean[][] }
	 * - etc.
	 */
	data: unknown;
}

export interface UseGameSessionOptions {
	/**
	 * Unique game identifier (e.g., 'wordle', 'sudoku')
	 */
	gameSlug: string;

	/**
	 * Game mode - determines if result is saved
	 */
	mode?: "daily" | "archive";

	/**
	 * Puzzle ID - REQUIRED for saving results
	 */
	puzzleId?: string;

	/**
	 * Difficulty level for games that support it
	 */
	difficulty?: PuzzleDifficulty;

	/**
	 * Custom celebration sound
	 * @default 'perfectWin' for won, 'lose' for lost
	 */
	celebrationSound?: "perfectWin" | "win" | "lose";

	/**
	 * Custom celebration haptic
	 * @default 'success' for won, 'error' for lost
	 */
	celebrationHaptic?: "success" | "win" | "lose" | "error";

	/**
	 * Show star burst effect on perfect wins
	 * @default false
	 */
	enableStarBurst?: boolean;

	/**
	 * Condition for star burst (e.g., first attempt win)
	 */
	isPerfectWin?: (data: GameEndData) => boolean;

	/**
	 * Delay before showing result modal (ms)
	 * @default 1500 for won, 1000 for lost
	 */
	resultModalDelay?: number;

	/**
	 * Delay before showing guest signup prompt (ms)
	 * @default 2000
	 */
	guestPromptDelay?: number;
}

export interface UseGameSessionReturn {
	// Phase management
	gamePhase: GamePhase;
	setGamePhase: (phase: GamePhase) => void;
	isReady: boolean;
	isPlaying: boolean;

	// Game lifecycle
	startGame: () => void;
	endGame: (data: GameEndData) => void;

	// Timer
	startTime: number | null;
	timeSpentMs: number;

	// Server response
	serverScore: number | null;

	// Modals & UI
	showCelebration: boolean;
	showStarBurst: boolean;
	showResultModal: boolean;
	showGuestSignupPrompt: boolean;
	setShowResultModal: (show: boolean) => void;
	setShowGuestSignupPrompt: (show: boolean) => void;

	// Guest signup
	handleCloseGuestPrompt: () => void;

	// Utilities
	resetSession: () => void;
}

export function useGameSession(
	options: UseGameSessionOptions,
): UseGameSessionReturn {
	const {
		gameSlug,
		mode = "daily",
		puzzleId,
		difficulty,
		celebrationSound,
		celebrationHaptic,
		enableStarBurst = false,
		isPerfectWin,
		resultModalDelay,
		guestPromptDelay = 2000,
	} = options;

	const storageKey = getGameSessionKey(gameSlug);

	// Hooks
	const { saveResult, isLoggedIn } = useSaveGameResult(gameSlug);
	const { saveCompletion: saveGuestCompletion } = useGuestGameState(gameSlug);
	const { incrementGuestGames, shouldShowSignupPrompt, dismissSignupPrompt } =
		useGuestOnboarding();

	// State
	const [gamePhase, setGamePhase] = useState<GamePhase>(() => {
		if (typeof window === "undefined") return "ready";
		return localStorage.getItem(storageKey) ? "playing" : "ready";
	});

	const [startTime, setStartTime] = useState<number | null>(null);
	const [showCelebration, setShowCelebration] = useState(false);
	const [showStarBurst, setShowStarBurst] = useState(false);
	const [showResultModal, setShowResultModal] = useState(false);
	const [showGuestSignupPrompt, setShowGuestSignupPrompt] = useState(false);
	const [serverScore, setServerScore] = useState<number | null>(null);

	// Ref to prevent duplicate saves
	const savedRef = useRef(false);

	// Derived state
	const isReady = gamePhase === "ready";
	const isPlaying = gamePhase === "playing";

	// Calculate time spent (for real-time display)
	const timeSpentMs = startTime ? Date.now() - startTime : 0;

	/**
	 * Start game - mark as played and begin timer
	 */
	const startGame = useCallback(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(storageKey, "true");
		}
		setStartTime(Date.now());
		setGamePhase("playing");
	}, [storageKey]);

	/**
	 * End game - save result (server calculates score), show celebration, show modal
	 *
	 * IMPORTANT: No score is sent to server - server calculates it
	 */
	const endGame = useCallback(
		async (endData: GameEndData) => {
			if (savedRef.current) return;

			savedRef.current = true;
			const finalTimeSpentMs = startTime ? Date.now() - startTime : 0;
			const { status } = endData;

			// Determine celebration type
			const isPerfect = enableStarBurst && isPerfectWin?.(endData);

			if (status === "won") {
				// Show celebration
				setShowCelebration(true);

				// Perfect win gets star burst
				if (isPerfect) {
					setShowStarBurst(true);
					triggerSound(celebrationSound || "perfectWin");
					triggerHaptic(celebrationHaptic || "win");
				} else {
					triggerSound(celebrationSound || "win");
					triggerHaptic(celebrationHaptic || "win");
				}
			} else if (status === "lost") {
				triggerSound(celebrationSound || "lose");
				triggerHaptic(celebrationHaptic || "lose");
			}

			// Save result (daily mode only)
			if (mode === "daily" && puzzleId) {
				if (isLoggedIn) {
					// Save to database for logged-in users
					// Server validates and calculates score
					try {
						const result = await saveResult({
							status,
							attempts: endData.attempts ?? 1,
							timeSpentMs: finalTimeSpentMs,
							puzzleId,
							mode: "daily" as const,
							// Difficulty level (for games that support it)
							difficulty,
							// Game-specific submission data
							data: endData.data,
						});
						// Store server-calculated score
						if (result?.score !== undefined) {
							setServerScore(result.score);
						}
					} catch (error) {
						console.error(`[${gameSlug}] Failed to save result:`, error);
					}
				} else {
					// Save to localStorage for guest users
					saveGuestCompletion({
						status,
						attempts: endData.attempts ?? 1,
						// No score for guests - would need server validation
					});

					// Track guest game completion for onboarding
					incrementGuestGames();

					// Show signup prompt if appropriate
					if (shouldShowSignupPrompt) {
						setTimeout(() => {
							setShowGuestSignupPrompt(true);
						}, guestPromptDelay);
					}
				}
			}

			// Show result modal after celebration
			const delay = resultModalDelay ?? (status === "won" ? 1500 : 1000);

			setTimeout(() => {
				setShowCelebration(false);
				setShowStarBurst(false);
				setShowResultModal(true);
			}, delay);
		},
		[
			startTime,
			mode,
			puzzleId,
			difficulty,
			gameSlug,
			isLoggedIn,
			saveResult,
			saveGuestCompletion,
			incrementGuestGames,
			shouldShowSignupPrompt,
			enableStarBurst,
			isPerfectWin,
			celebrationSound,
			celebrationHaptic,
			resultModalDelay,
			guestPromptDelay,
		],
	);

	/**
	 * Set start time for returning users who skip ready screen
	 */
	useEffect(() => {
		if (gamePhase === "playing" && startTime === null) {
			setStartTime(Date.now());
		}
	}, [gamePhase, startTime]);

	/**
	 * Handle closing guest signup prompt
	 */
	const handleCloseGuestPrompt = useCallback(() => {
		setShowGuestSignupPrompt(false);
		dismissSignupPrompt();
	}, [dismissSignupPrompt]);

	/**
	 * Reset session state (for new game)
	 */
	const resetSession = useCallback(() => {
		savedRef.current = false;
		setShowCelebration(false);
		setShowStarBurst(false);
		setShowResultModal(false);
		setShowGuestSignupPrompt(false);
		setServerScore(null);
		setStartTime(Date.now());
	}, []);

	return {
		// Phase management
		gamePhase,
		setGamePhase,
		isReady,
		isPlaying,

		// Game lifecycle
		startGame,
		endGame,

		// Timer
		startTime,
		timeSpentMs,

		// Server response
		serverScore,

		// Modals & UI
		showCelebration,
		showStarBurst,
		showResultModal,
		showGuestSignupPrompt,
		setShowResultModal,
		setShowGuestSignupPrompt,

		// Guest signup
		handleCloseGuestPrompt,

		// Utilities
		resetSession,
	};
}

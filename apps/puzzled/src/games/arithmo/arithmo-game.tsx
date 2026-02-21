/**
 * Arithmo Game Component
 * Guess the equation in 6 tries (Nerdle-style)
 */

"use client";

import { Celebration } from "@/features/celebration/components/celebration";
import { GameResultModal } from "@/features/daily/components/game-result-modal";
import { GuestSignupPrompt } from "@/features/daily/components/guest-signup-prompt";
import { HowToPlayModal } from "@/features/daily/components/how-to-play-modal";
import { useGameSession } from "@/games/shared/use-game-session";
import { parsePuzzleDataClient } from "@/games/types";
import { ArithmoIcon } from "@/shared/components/ui/game-icons";
import { triggerHaptic, triggerSound } from "@/shared/hooks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@sylphx/ui";
import { HelpCircle, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArithmoGrid, ArithmoKeyboard } from "./components";
import type { ArithmoPuzzleData, ArithmoSolution } from "./types";
import { MAX_ATTEMPTS } from "./types";
import { useArithmo } from "./use-arithmo";

type Props = {
	mode?: "daily" | "archive";
	puzzleId?: string;
	puzzleData?: unknown;
};

export function ArithmoGame({ mode = "daily", puzzleId, puzzleData }: Props) {
	const t = useTranslations("games.arithmo");

	// Get puzzle from server data
	const [puzzle] = useState(() =>
		parsePuzzleDataClient<ArithmoPuzzleData, ArithmoSolution>(puzzleData),
	);

	const {
		isReady,
		startGame,
		endGame,
		startTime,
		showCelebration,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: "arithmo",
		mode,
		puzzleId,
		enableStarBurst: false,
		isPerfectWin: (stats) => stats.attempts === 1,
	});

	const [showHelpModal, setShowHelpModal] = useState(false);

	// Game hook
	const game = useArithmo();

	// Initialize game when puzzle is ready
	useEffect(() => {
		if (puzzle && !isReady) {
			game.init(puzzle.solution.equation);
		}
	}, [puzzle, isReady, game.init]); // eslint-disable-line react-hooks/exhaustive-deps

	// Handle submit
	const handleSubmit = useCallback(() => {
		if (!puzzle) return;

		game.submitGuess(puzzle.solution.equation);

		if (game.state.error) {
			triggerHaptic("error");
			triggerSound("error");
		}
	}, [game, puzzle]);

	// Keyboard event listener
	useEffect(() => {
		if (isReady || game.state.isComplete) return;

		function handleKeyDown(e: KeyboardEvent) {
			if (e.ctrlKey || e.metaKey || e.altKey) return;

			if (e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			} else if (e.key === "Backspace") {
				e.preventDefault();
				game.deleteChar();
			} else if (/^[0-9+\-*/=]$/.test(e.key)) {
				e.preventDefault();
				game.addChar(e.key);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isReady,
		game.state.isComplete,
		game.addChar,
		game.deleteChar,
		handleSubmit,
	]); // eslint-disable-line react-hooks/exhaustive-deps

	// Track game completion
	const gameEndedRef = useRef(false);
	if (game.state.isComplete && !gameEndedRef.current) {
		gameEndedRef.current = true;
		endGame({
			status: game.state.isWon ? "won" : "lost",
			attempts: game.state.guesses.length,
			maxAttempts: MAX_ATTEMPTS,
			data: {
				guesses: game.state.guesses,
			},
		});
	}

	// Share result
	const handleShare = useCallback(() => {
		const emojis = game.state.results
			.map((row) =>
				row
					.map((status) =>
						status === "correct" ? "🟩" : status === "present" ? "🟨" : "⬛",
					)
					.join(""),
			)
			.join("\n");

		const attempts = game.state.isWon ? game.state.guesses.length : "X";
		const text = `🧮 Arithmo ${attempts}/${MAX_ATTEMPTS}\n\n${emojis}\n\nPlay at puzzled.gg`;
		navigator.clipboard.writeText(text);
	}, [game.state.results, game.state.guesses.length, game.state.isWon]);

	// Get error message
	const getErrorMessage = () => {
		if (!game.state.error) return null;
		switch (game.state.error) {
			case "notComplete":
				return t("messages.notComplete");
			case "invalid":
				return t("messages.invalid");
			default:
				return null;
		}
	};

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<ArithmoIcon size={48} className="text-primary" />
					</div>
					<CardTitle>{t("name")}</CardTitle>
					<p className="text-sm text-muted-foreground">{t("description")}</p>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Rules */}
					<div className="rounded-lg bg-muted/50 p-4">
						<h3 className="mb-2 flex items-center gap-2 font-medium">
							<HelpCircle className="h-4 w-4" />
							{t("rules.title")}
						</h3>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>• {t("rules.rule1")}</li>
							<li>• {t("rules.rule2")}</li>
							<li>• {t("rules.rule3")}</li>
						</ul>
					</div>

					<Button onClick={startGame} className="w-full" size="lg">
						<Play className="mr-2 h-4 w-4" />
						{t("startGame")}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="relative flex w-full flex-col items-center gap-3 sm:gap-4 px-2 sm:px-4">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Header */}
			<div className="flex w-full max-w-sm items-center justify-between">
				<div className="text-sm text-muted-foreground">{t("name")}</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowHelpModal(true)}
				>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Grid */}
			<ArithmoGrid
				guesses={game.state.guesses}
				results={game.state.results}
				currentGuess={game.state.currentGuess}
				currentRow={game.state.currentRow}
			/>

			{/* Error message */}
			{game.state.error && (
				<div className="text-sm text-destructive animate-in fade-in">
					{getErrorMessage()}
				</div>
			)}

			{/* Keyboard */}
			<ArithmoKeyboard
				onChar={game.addChar}
				onDelete={game.deleteChar}
				onEnter={handleSubmit}
				keyboardStatus={game.state.keyboardStatus}
				disabled={game.state.isComplete}
			/>

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="arithmo"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="arithmo"
				status={game.state.isWon ? "won" : "lost"}
				solution={game.state.isWon ? undefined : puzzle.solution.equation}
				stats={{
					attempts: game.state.guesses.length,
					maxAttempts: MAX_ATTEMPTS,
					timeSpentMs:
						game.state.endTime && startTime
							? game.state.endTime - startTime
							: 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			{/* Guest signup prompt */}
			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>
		</div>
	);
}

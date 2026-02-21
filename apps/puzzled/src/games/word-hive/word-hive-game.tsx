"use client";

import {
	Celebration,
	StarBurst,
} from "@/features/celebration/components/celebration";
import { GameResultModal } from "@/features/daily/components/game-result-modal";
import { GuestSignupPrompt } from "@/features/daily/components/guest-signup-prompt";
import { HowToPlayModal } from "@/features/daily/components/how-to-play-modal";
import { useGameSession } from "@/games/shared/use-game-session";
import { parsePuzzleDataClient } from "@/games/types";
import { SpellingBeeIcon } from "@/shared/components/ui/game-icons";
import { triggerHaptic, triggerSound } from "@/shared/hooks";
import { Button } from "@sylphx/ui";
import { Delete, HelpCircle, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { CurrentWord, Honeycomb, RankDisplay, WordList } from "./components";
import type { SpellingBeePuzzleClientData } from "./types";
import { type SubmitResult, useWordHive } from "./use-word-hive";

type Props = {
	mode?: "daily" | "archive";
	puzzleId?: string;
	puzzleData?: unknown;
};

export function WordHiveGame({ mode = "daily", puzzleId, puzzleData }: Props) {
	const t = useTranslations("games.wordHive");
	const tCommon = useTranslations("common");
	const tShare = useTranslations("share");

	// Parse puzzle data from server using client-safe parser
	const [initialPuzzle] = useState(() => {
		const parsed = parsePuzzleDataClient<SpellingBeePuzzleClientData, unknown>(
			puzzleData,
		);
		return parsed.puzzleData;
	});

	const {
		isReady,
		startGame,
		endGame,
		startTime,
		showCelebration,
		showStarBurst,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: "word-hive",
		mode,
		puzzleId,
		enableStarBurst: true,
		isPerfectWin: (stats) => stats.attempts === stats.maxAttempts, // Queen Bee = all words
	});

	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState("");
	const [showHelpModal, setShowHelpModal] = useState(false);
	const [shakeWord, setShakeWord] = useState(false);
	const [showPangramBurst, setShowPangramBurst] = useState(false);

	const submitResultHandlerRef = useRef<(result: SubmitResult) => void>(
		() => {},
	);

	const game = useWordHive(initialPuzzle, (result) =>
		submitResultHandlerRef.current(result),
	);

	const handleHelpClick = useCallback(() => {
		setShowHelpModal(true);
	}, []);

	const showToastMsg = useCallback((message: string) => {
		setToastMessage(message);
		setShowToast(true);
		setTimeout(() => setShowToast(false), 2000);
	}, []);

	const triggerShake = useCallback(() => {
		setShakeWord(true);
		setTimeout(() => setShakeWord(false), 300);
	}, []);

	// Handle submit result feedback
	const handleSubmitResult = useCallback(
		(result: SubmitResult) => {
			switch (result) {
				case "success":
					triggerSound("correct");
					triggerHaptic("success");
					break;
				case "pangram":
					triggerSound("perfectWin");
					triggerHaptic("win");
					setShowPangramBurst(true);
					setTimeout(() => setShowPangramBurst(false), 2000);
					showToastMsg("Pangram! ✨");
					break;
				case "too_short":
					showToastMsg(t("messages.tooShort"));
					triggerSound("error");
					triggerHaptic("error");
					triggerShake();
					break;
				case "missing_center":
					showToastMsg(t("messages.missingCenter"));
					triggerSound("error");
					triggerHaptic("error");
					triggerShake();
					break;
				case "invalid_letter":
					showToastMsg(t("messages.invalidLetter"));
					triggerSound("error");
					triggerHaptic("error");
					triggerShake();
					break;
				case "not_in_list":
					showToastMsg(t("messages.notInList"));
					triggerSound("error");
					triggerHaptic("error");
					triggerShake();
					break;
				case "already_found":
					showToastMsg(t("messages.alreadyFound"));
					triggerHaptic("error");
					triggerShake();
					break;
			}
		},
		[t, showToastMsg, triggerShake],
	);

	submitResultHandlerRef.current = handleSubmitResult;

	const handleSubmit = useCallback(() => {
		triggerHaptic("submit");
		const result = game.trySubmitWord();
		handleSubmitResult(result);
	}, [game, handleSubmitResult]);

	// Track game completion (Genius or Queen Bee)
	const gameEndedRef = useRef(false);
	if (
		(game.rank === "genius" || game.gameStatus === "won") &&
		!gameEndedRef.current
	) {
		gameEndedRef.current = true;
		endGame({
			status: "won",
			attempts: game.foundWords.length,
			maxAttempts: game.totalWords,
			data: {
				foundWords: game.foundWords,
			},
		});
	}

	const handleShare = async () => {
		const rankEmoji =
			game.rank === "queen-bee"
				? "👑"
				: game.rank === "genius"
					? "🧠"
					: game.rank === "amazing"
						? "🤩"
						: game.rank === "great"
							? "💪"
							: "🐝";

		const text = `${rankEmoji} Puzzled Spelling Bee
${game.score}/${game.maxScore} points
${game.foundWords.length}/${game.totalWords} words
${game.foundPangrams.length}/${game.totalPangrams} pangrams

puzzled.gg`;

		try {
			if (navigator.share) {
				await navigator.share({ text });
			} else {
				await navigator.clipboard.writeText(text);
				showToastMsg(tShare("copied"));
			}
		} catch {
			// User cancelled
		}
	};

	// Ready screen
	if (isReady) {
		return (
			<div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
				<HowToPlayModal
					open={showHelpModal}
					onClose={() => setShowHelpModal(false)}
					gameSlug="word-hive"
				/>

				<SpellingBeeIcon size={64} className="text-primary" />
				<div>
					<h2 className="mb-2 text-xl font-bold">{t("name")}</h2>
					<p className="text-muted-foreground">{t("description")}</p>
				</div>

				{/* Rules */}
				<div className="w-full rounded-lg bg-muted/50 p-4 text-sm">
					<p className="mb-3 font-medium">{t("rules.title")}</p>
					<ul className="space-y-2 text-left text-muted-foreground">
						<li>• {t("rules.rule1")}</li>
						<li>• {t("rules.rule2")}</li>
						<li>• {t("rules.rule3")}</li>
						<li>• {t("rules.rule4")}</li>
					</ul>
				</div>

				<Button onClick={startGame} size="lg" className="gap-2">
					<Play className="h-5 w-5" />
					{tCommon("play")}
				</Button>

				<button
					type="button"
					onClick={handleHelpClick}
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					<HelpCircle className="h-3 w-3" />
					{t("howToPlay")}
				</button>
			</div>
		);
	}

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-4 px-2 sm:gap-6 sm:px-0">
			{/* Guest Signup Prompt */}
			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>

			{/* Celebrations */}
			<Celebration show={showCelebration} />
			<StarBurst show={showStarBurst || showPangramBurst} />

			{/* Rank Progress */}
			<div className="w-full max-w-sm px-2 sm:px-0">
				<RankDisplay
					rank={game.rank}
					score={game.score}
					maxScore={game.maxScore}
				/>
			</div>

			{/* Current Word Input */}
			<CurrentWord
				word={game.currentWord}
				centerLetter={game.centerLetter}
				shake={shakeWord}
			/>

			{/* Honeycomb */}
			<Honeycomb
				centerLetter={game.centerLetter}
				outerLetters={game.outerLetters}
				onLetterClick={game.addLetter}
				disabled={game.gameStatus !== "playing"}
			/>

			{/* Action Buttons */}
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					onClick={game.deleteLetter}
					disabled={game.currentWord.length === 0}
					className="min-h-[44px] min-w-[44px]"
					aria-label={t("delete")}
				>
					<Delete className="h-5 w-5" />
				</Button>

				<Button
					variant="outline"
					size="icon"
					onClick={game.shuffle}
					className="min-h-[44px] min-w-[44px]"
					aria-label={t("shuffle")}
				>
					<RotateCcw className="h-5 w-5" />
				</Button>

				<Button
					onClick={handleSubmit}
					disabled={game.currentWord.length < 4}
					className="min-h-[44px] px-6"
				>
					Enter
				</Button>
			</div>

			{/* Word List */}
			<div className="w-full max-w-sm px-2 sm:px-0">
				<WordList
					foundWords={game.foundWords}
					totalWords={game.totalWords}
					pangrams={game.pangrams}
				/>
			</div>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-hive"
				status="won"
				stats={{
					attempts: game.foundWords.length,
					maxAttempts: game.totalWords,
					timeSpentMs: startTime ? Date.now() - startTime : 0,
				}}
				solution={`${game.score} points`}
				mode={mode}
				onShare={handleShare}
			/>

			{/* Toast */}
			{showToast && (
				<div
					role="alert"
					aria-live="assertive"
					className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-slide-up rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg"
				>
					{toastMessage}
				</div>
			)}
		</div>
	);
}

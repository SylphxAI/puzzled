import { cronSuccess, verifyCronAuth } from "@/lib/api/cron";
import { getServerBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily puzzle generation cron job
 *
 * Triggered by Vercel Cron at 23:00 UTC daily (see vercel.json)
 * Calls the puzzle generation job directly.
 *
 * Architecture:
 * - Vercel Cron triggers this endpoint
 * - This endpoint triggers /api/jobs/generate-puzzles (fire-and-forget)
 * - Job generates puzzles for all games for tomorrow
 */
export function GET(request: Request): Response {
	const authError = verifyCronAuth(request, "[PuzzleGeneration]");
	if (authError) return authError;

	const baseUrl = getServerBaseUrl();
	const jobUrl = `${baseUrl}/api/jobs/generate-puzzles`;

	console.log("[PuzzleGeneration] Triggering puzzle generation job");

	// Fire-and-forget - don't await
	fetch(jobUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-internal-call": "true",
		},
	}).catch((error) => {
		console.error("[PuzzleGeneration] Failed to trigger job:", error);
	});

	return cronSuccess("Puzzle generation job triggered");
}

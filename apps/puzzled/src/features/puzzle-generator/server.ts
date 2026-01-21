/**
 * Server-side exports for puzzle generator
 * Use this import path: import { ... } from '@/features/puzzle-generator/server'
 */

export {
	type DailyPuzzleResults,
	generateConnectionsPuzzle,
	generateCrosswordPuzzle,
	generateDailyPuzzles,
	generateNonogramPuzzle,
	getTodayDateString,
	getTomorrowDateString,
} from './lib/generator'
export { ai } from './lib/openrouter'
export {
	type ConnectionsValidationResult,
	parseConnectionsResponse,
	validateConnectionsPuzzle,
} from './lib/validators/connections'
export {
	type CrosswordValidationResult,
	parseCrosswordResponse,
	validateCrosswordPuzzle,
} from './lib/validators/crossword'
export {
	type NonogramValidationResult,
	parseNonogramResponse,
	validateNonogramPuzzle,
} from './lib/validators/nonogram'

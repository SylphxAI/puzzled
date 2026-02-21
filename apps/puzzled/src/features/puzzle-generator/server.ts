/**
 * Server-side exports for puzzle generator
 * Use this import path: import { ... } from '@/features/puzzle-generator/server'
 */

export {
	generateConnectionsPuzzle,
	generateCrosswordPuzzle,
	generateNonogramPuzzle,
} from "./lib/generator";
export { ai } from "./lib/openrouter";

/**
 * Server-side exports for puzzle generator
 * Use this import path: import { ... } from '@/features/puzzle-generator/server'
 */

export { ai } from './lib/ai-client'
export {
	generateConnectionsPuzzle,
	generateCrosswordPuzzle,
	generateNonogramPuzzle,
} from './lib/generator'
export { type AdminModel, adminModelCatalog } from './lib/model-catalog'

/**
 * Admin model catalog mapping for the Models door `GET /models` document.
 *
 * The door projects the authenticated catalog as
 * `{object:"list", data:[row...], models:[codex rows]}` with USD-per-million
 * pricing, `display_name`, `context_window`/`max_context_window`, and
 * `supports_*` capability flags (no legacy Platform row fields such as
 * `context_length`, `name`, or a `capabilities` blob). The admin model picker
 * (`/api/admin/models`) lists conversation SKUs to choose
 * `app_settings.puzzle_generator_model`.
 */
import type { AIModelList, AIModelRow } from '@/lib/identity/ai'

export type AdminModel = {
	id: string
	name: string
	contextLength: number | null
	pricing: {
		/** USD per million tokens (door unit), or null when unlisted. */
		prompt: number | null
		completion: number | null
	}
	capabilities: {
		search: boolean
		parallelToolCalls: boolean
		reasoningSummary: boolean
	}
}

const PRIORITY_PROVIDERS = ['anthropic', 'openai', 'google', 'meta-llama']

function providerOf(id: string): string {
	return id.split('/')[0] ?? id
}

function toAdminModel(row: AIModelRow): AdminModel {
	return {
		id: row.id,
		name: row.display_name ?? row.id,
		contextLength: row.context_window ?? row.max_context_window ?? null,
		pricing: {
			prompt: row.pricing?.prompt ?? null,
			completion: row.pricing?.completion ?? null,
		},
		capabilities: {
			search: row.supports_search_tool === true,
			parallelToolCalls: row.supports_parallel_tool_calls === true,
			reasoningSummary: row.supports_reasoning_summary_parameter === true,
		},
	}
}

export function adminModelCatalog(list: AIModelList): AdminModel[] {
	return (list.data ?? [])
		.filter((row) => Boolean(row.id))
		.map(toAdminModel)
		.sort((a, b) => {
			const aPriority = PRIORITY_PROVIDERS.indexOf(providerOf(a.id))
			const bPriority = PRIORITY_PROVIDERS.indexOf(providerOf(b.id))
			if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority
			if (aPriority !== -1) return -1
			if (bPriority !== -1) return 1
			return a.name.localeCompare(b.name)
		})
}

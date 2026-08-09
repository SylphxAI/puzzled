/**
 * Explicit client state classification (architecture standard §6).
 * Zustand only when genuinely cross-component AND client-owned.
 * Server-authoritative state → TanStack Query / Connect-Query.
 */
export type ClientStateClass = 'react_local' | 'tanstack_server' | 'zustand_client_owned'

export type StatePlacementDecision = {
	classification: ClientStateClass
	allowed: boolean
	reason: string
}

export function classifyClientState(input: {
	crossComponent: boolean
	clientOwned: boolean
	serverAuthoritative: boolean
}): StatePlacementDecision {
	if (input.serverAuthoritative) {
		return {
			classification: 'tanstack_server',
			allowed: true,
			reason: 'server_authoritative_use_tanstack_or_connect_query',
		}
	}
	if (input.crossComponent && input.clientOwned) {
		return {
			classification: 'zustand_client_owned',
			allowed: true,
			reason: 'cross_component_client_owned_zustand_ok',
		}
	}
	return {
		classification: 'react_local',
		allowed: true,
		reason: 'local_component_state',
	}
}

export function zustandForbiddenForServerState(serverAuthoritative: boolean): boolean {
	return serverAuthoritative
}

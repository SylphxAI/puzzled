export const SHARED_HOME_HEADER: string
export function isSharedHomeRequest(
	method: string,
	url: string,
	headers: Record<string, unknown>,
): boolean

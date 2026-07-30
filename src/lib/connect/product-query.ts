/**
 * Product query keys / helpers — schema-first product RPC (not Health-only).
 * Pair with Connect residual client at call sites (Connect-Query / resource).
 */
export const productQueryKeys = {
  root: ['connect', 'product'] as const,
  status: (id?: string) => [...productQueryKeys.root, 'status', id ?? 'default'] as const,
}

/**
 * tsup Build Configuration
 *
 * ## Architecture Decision (ADR-001)
 *
 * We use only 4 entry points, separated by peer dependency requirements:
 *
 * | Entry Point | Peer Dependencies | Why Separate |
 * |-------------|-------------------|--------------|
 * | index.ts | None | Main entry - all pure functions |
 * | react/index.ts | react, react-dom | Has 'use client', needs React |
 * | server/index.ts | jose | Uses Node.js crypto APIs |
 * | nextjs/index.ts | next | Uses next/headers, next/server |
 *
 * Multiple entry points are NOT needed for tree-shaking.
 * Modern bundlers (Vite, esbuild, webpack 5) tree-shake unused exports
 * when `sideEffects: false` is set in package.json.
 *
 * See ADR.md for full rationale.
 */

import { defineConfig } from 'tsup'

// Shared externals: peer dependencies that consumers must provide
const PEER_EXTERNALS = [
	// React (peer dependency)
	'react',
	'react-dom',
	'react/jsx-runtime',
	'react/jsx-dev-runtime',
	'use-sync-external-store',
	'use-sync-external-store/shim',
	// Next.js (peer dependency)
	'next',
	'next/server',
	'next/headers',
	'next/navigation',
	'next/link',
	'next/image',
]

export default defineConfig([
	// ==========================================================================
	// Main Entry Point - All Pure Functions
	// ==========================================================================
	// No React, no Node.js-specific APIs. Works in browser, Node, edge.
	// Tree-shaking handled by consumer's bundler, not by separate entry points.
	{
		entry: ['src/index.ts'],
		format: ['esm'],
		dts: false, // TODO: Enable when we fix type architecture
		splitting: false,
		sourcemap: true,
		clean: true,
		external: PEER_EXTERNALS,
		// Bundle all dependencies (tRPC, superjson, etc.) into the SDK
		noExternal: [
			'@trpc/client',
			'@trpc/server',
			'superjson',
			'jose',
			'@sylphx/ui',
		],
	},

	// ==========================================================================
	// Server Entry Point - Node.js Server Utilities
	// ==========================================================================
	// Requires jose for JWT verification. Server-only, never expose to browser.
	{
		entry: { 'server/index': 'src/server/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		noExternal: ['jose'],
	},

	// ==========================================================================
	// Next.js Entry Point - Next.js Integration
	// ==========================================================================
	// Requires next for middleware, cookies, server components.
	{
		entry: { 'nextjs/index': 'src/nextjs/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		noExternal: ['jose'],
	},

	// ==========================================================================
	// React Entry Point - React Hooks & Components
	// ==========================================================================
	// Requires react, react-dom. Has 'use client' directive at top.
	// This is the largest entry point due to UI components.
	{
		entry: { 'react/index': 'src/react/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		// Bundle all SDK dependencies
		noExternal: [
			'@trpc/client',
			'@trpc/server',
			'superjson',
			'rrweb',
			'@sylphx/ui',
			'@vercel/blob',
		],
	},
])

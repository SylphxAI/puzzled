/**
 * tsup Build Configuration
 *
 * ## Architecture Decision (ADR-001)
 *
 * We use only 5 entry points, separated by peer dependency requirements:
 *
 * | Entry Point | Peer Dependencies | Why Separate |
 * |-------------|-------------------|--------------|
 * | index.ts | None | Main entry - all pure functions |
 * | react/index.ts | react, react-dom | Has 'use client', needs React |
 * | server/index.ts | jose | Uses Node.js crypto APIs |
 * | nextjs/index.ts | next | Uses next/headers, next/server |
 * | web-analytics.ts | None | Web Analytics tracker (standalone) |
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
		format: ['esm', 'cjs'],
		outExtension({ format }) {
			return { js: format === 'esm' ? '.mjs' : '.js' }
		},
		dts: true,
		splitting: false,
		sourcemap: true,
		clean: true,
		external: PEER_EXTERNALS,
		// Bundle all dependencies into the SDK
		noExternal: ['jose', '@sylphx/ui', 'web-vitals'],
	},

	// ==========================================================================
	// Server Entry Point - Node.js Server Utilities
	// ==========================================================================
	// Requires jose for JWT verification. Server-only, never expose to browser.
	{
		entry: { 'server/index': 'src/server/index.ts' },
		format: ['esm', 'cjs'],
		outExtension({ format }) {
			return { js: format === 'esm' ? '.mjs' : '.js' }
		},
		dts: true,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		noExternal: ['jose', 'web-vitals'],
	},

	// ==========================================================================
	// Next.js Entry Point - Next.js Integration
	// ==========================================================================
	// Requires next for middleware, cookies, server components.
	{
		entry: { 'nextjs/index': 'src/nextjs/index.ts' },
		format: ['esm', 'cjs'],
		outExtension({ format }) {
			return { js: format === 'esm' ? '.mjs' : '.js' }
		},
		dts: true,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		noExternal: ['jose', 'web-vitals'],
	},

	// ==========================================================================
	// React Entry Point - React Hooks & Components
	// ==========================================================================
	// Requires react, react-dom. Has 'use client' directive at top.
	// This is the largest entry point due to UI components.
	{
		entry: { 'react/index': 'src/react/index.ts' },
		format: ['esm', 'cjs'],
		outExtension({ format }) {
			return { js: format === 'esm' ? '.mjs' : '.js' }
		},
		dts: true,
		splitting: false,
		sourcemap: true,
		external: [
			...PEER_EXTERNALS,
			// Make use-sync-external-store external so the CJS require() is not bundled
			// into the SDK dist. Next.js will handle it via serverExternalPackages.
			'use-sync-external-store',
			'use-sync-external-store/shim',
			'use-sync-external-store/shim/with-selector',
		],
		// Bundle all SDK dependencies
		noExternal: ['rrweb', '@sylphx/ui', 'web-vitals'],
	},

	// ==========================================================================
	// Web Analytics Entry Point - Standalone Tracker
	// ==========================================================================
	// Lightweight analytics tracker, no React dependency.
	{
		entry: { 'web-analytics': 'src/web-analytics.ts' },
		format: ['esm', 'cjs'],
		outExtension({ format }) {
			return { js: format === 'esm' ? '.mjs' : '.js' }
		},
		dts: true,
		splitting: false,
		sourcemap: true,
		external: PEER_EXTERNALS,
		noExternal: ['web-vitals'],
	},
])

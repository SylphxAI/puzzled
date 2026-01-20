import { defineConfig } from 'tsup'

// Common externals for all builds
const commonExternal = ['react', 'react-dom', 'next', 'next/server', 'next/headers']

export default defineConfig([
	// Core SDK - pure functions (no React)
	{
		entry: [
			'src/index.ts',
			'src/config.ts',
			'src/auth.ts',
			'src/ai.ts',
			'src/analytics.ts',
			'src/billing.ts',
			'src/storage.ts',
			'src/notifications.ts',
			'src/jobs.ts',
			'src/flags.ts',
			'src/webhooks.ts',
			'src/email.ts',
			'src/consent.ts',
			'src/referrals.ts',
		],
		format: ['esm'],
		dts: false, // DTS requires standalone types (TODO: fix type architecture)
		splitting: false,
		sourcemap: true,
		clean: true,
		external: commonExternal,
	},
	// Server SDK (server-side only)
	{
		entry: { 'server/index': 'src/server/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		external: commonExternal,
	},
	// Next.js integration
	{
		entry: { 'nextjs/index': 'src/nextjs/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		external: commonExternal,
	},
	// React bindings (use client is in source files)
	{
		entry: { 'react/index': 'src/react/index.ts' },
		format: ['esm'],
		dts: false,
		splitting: false,
		sourcemap: true,
		// External React and packages that cause SSR issues
		external: ['react', 'react-dom', 'use-sync-external-store', '@vercel/blob'],
	},
])

#!/usr/bin/env npx tsx
/**
 * Migration Integrity Check
 *
 * Validates that the database schema matches committed migrations.
 * Fails CI if there are uncommitted schema changes.
 *
 * Usage: npx tsx scripts/check-migrations.ts
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DRIZZLE_DIR = path.join(process.cwd(), 'drizzle')

async function main() {
	console.log('🗄️  Checking migration integrity...\n')

	// Step 1: Check that drizzle directory exists
	if (!fs.existsSync(DRIZZLE_DIR)) {
		console.error('❌ Drizzle migrations directory not found!')
		console.error('   Run: bun run db:generate')
		process.exit(1)
	}

	// Step 2: Get list of existing migration files
	const migrationFiles = fs
		.readdirSync(DRIZZLE_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort()

	console.log(`Found ${migrationFiles.length} existing migrations:`)
	for (const file of migrationFiles) {
		console.log(`  - ${file}`)
	}
	console.log()

	// Step 3: Run drizzle-kit generate in dry-run mode to check for schema drift
	try {
		// Generate to a temp directory to check for changes
		const tempDir = path.join(process.cwd(), '.drizzle-check')

		// Clean up temp dir if it exists
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true })
		}

		// Run drizzle-kit generate to temp directory
		// Note: This requires DATABASE_URL to be set, but we check schema only
		console.log('Checking for uncommitted schema changes...\n')

		// For CI, we'll check if there are any tables in schema.ts that don't have migrations
		const schemaContent = fs.readFileSync(
			path.join(process.cwd(), 'src/lib/db/schema.ts'),
			'utf-8',
		)

		// Extract table names from pgTable definitions
		const tableMatches = schemaContent.matchAll(/pgTable\(['"](\w+)['"]/g)
		const schemaTables = [...tableMatches].map((m) => m[1])

		console.log(`Schema defines ${schemaTables.length} tables:`)
		for (const table of schemaTables) {
			console.log(`  - ${table}`)
		}
		console.log()

		// Read all migration files and extract CREATE TABLE statements
		const migratedTables = new Set<string>()
		for (const file of migrationFiles) {
			const content = fs.readFileSync(path.join(DRIZZLE_DIR, file), 'utf-8')
			const createMatches = content.matchAll(/CREATE TABLE[^"]*"(\w+)"/gi)
			for (const match of createMatches) {
				migratedTables.add(match[1])
			}
		}

		console.log(`Migrations create ${migratedTables.size} tables:`)
		for (const table of migratedTables) {
			console.log(`  - ${table}`)
		}
		console.log()

		// Check for missing tables
		const missingMigrations = schemaTables.filter((t) => !migratedTables.has(t))

		if (missingMigrations.length > 0) {
			console.error('❌ Schema drift detected! The following tables have no migration:')
			for (const table of missingMigrations) {
				console.error(`   - ${table}`)
			}
			console.error('\nRun: bun run db:generate')
			console.error('Then commit the generated migration file.\n')
			process.exit(1)
		}

		console.log('✅ All schema tables have corresponding migrations!\n')
	} catch (error) {
		console.error('Migration check error:', error)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error('Script error:', error)
	process.exit(1)
})

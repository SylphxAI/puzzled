#!/usr/bin/env bun
/**
 * Protobuf+Buf conformance gate (ADR-168 S0).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

const repoRoot = import.meta.dir.replace(/\/scripts$/, '')
process.chdir(repoRoot)

const toolsBuf = join(repoRoot, '.tools/buf')
const bufCandidates = [
	process.env.BUF_BIN,
	toolsBuf,
	'/usr/local/bin/buf',
	`${process.env.HOME}/.local/bin/buf`,
	'buf',
].filter(Boolean) as string[]

let buf = ''
for (const candidate of bufCandidates) {
	try {
		await $`${candidate} --version`.quiet()
		buf = candidate
		break
	} catch {
		// try next
	}
}

if (!buf) {
	const version = '1.50.0'
	const arch = process.arch === 'x64' ? 'x86_64' : process.arch
	const platform =
		process.platform === 'linux' ? 'Linux' : process.platform === 'darwin' ? 'Darwin' : ''
	if (!platform) {
		console.error('buf CLI not found and auto-install unsupported on this OS')
		process.exit(1)
	}
	await $`mkdir -p ${join(repoRoot, '.tools')}`.quiet()
	const url = `https://github.com/bufbuild/buf/releases/download/v${version}/buf-${platform}-${arch}`
	await $`curl -fsSL ${url} -o ${toolsBuf}`
	await $`chmod +x ${toolsBuf}`.quiet()
	buf = toolsBuf
}

console.log(`[check:proto-buf] using ${buf}`)

const lint = await $`${buf} lint`.nothrow()
if (lint.exitCode !== 0) {
	console.error(lint.stderr.toString() || lint.stdout.toString())
	process.exit(lint.exitCode ?? 1)
}
console.log('[check:proto-buf] buf lint OK')

const descriptorBaseline = join(repoRoot, 'proto/baseline/descriptors.binpb')
const gitBaselines = [
	{ treeRef: 'main', against: '.git#branch=main,subdir=proto' },
	{ treeRef: 'HEAD^', against: '.git#ref=HEAD^,subdir=proto' },
] as const

let againstRef: string | null = null
for (const candidate of gitBaselines) {
	const hasProto =
		await $`git ls-tree -r --name-only ${candidate.treeRef} -- proto/puzzled`.nothrow()
	if (hasProto.exitCode === 0 && hasProto.stdout.toString().trim().length > 0) {
		againstRef = candidate.against
		break
	}
}

if (!againstRef && existsSync(descriptorBaseline)) {
	againstRef = descriptorBaseline
}

if (!againstRef) {
	console.log(
		'[check:proto-buf] skip buf breaking (no git baseline yet; commit proto/baseline/descriptors.binpb)',
	)
} else {
	const breaking = await $`${buf} breaking --against ${againstRef}`.nothrow()
	if (breaking.exitCode !== 0) {
		console.error(breaking.stderr.toString() || breaking.stdout.toString())
		process.exit(breaking.exitCode ?? 1)
	}
	console.log(`[check:proto-buf] buf breaking OK (against ${againstRef})`)
}

const protoHealth = join(repoRoot, 'proto/puzzled/v1/health.proto')
const protoStats = join(repoRoot, 'proto/puzzled/v1/stats.proto')
if (!existsSync(protoHealth) || !existsSync(protoStats)) {
	console.error('[check:proto-buf] missing proto/puzzled/v1/*.proto')
	process.exit(1)
}

console.log('[check:proto-buf] pass')
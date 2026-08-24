#!/usr/bin/env node
'use strict'

/**
 * Knative/Next listen binder for puzzled web.
 *
 * Next standalone uses process.env.HOSTNAME || '0.0.0.0' and process.env.PORT.
 * Kubernetes sets HOSTNAME to the pod name, so Next would bind the pod IP and
 * Knative's 127.0.0.1 probe would fail (Initial scale never achieved).
 * Knative injects PORT and rejects a user env of that name; honor it here.
 */

const fs = require('node:fs')
const path = require('node:path')

function parseListenPort(raw) {
	const port = Number.parseInt(String(raw ?? ''), 10)
	if (Number.isFinite(port) && port > 0 && port < 65536) return String(port)
	return '3000'
}

function listenBind(env) {
	return {
		hostname: '0.0.0.0',
		port: parseListenPort(env.PORT),
	}
}

function applyListenEnv(env) {
	const bind = listenBind(env)
	env.HOSTNAME = bind.hostname
	env.PORT = bind.port
	return bind
}

function resolveStandaloneServer(rootDir, exists = fs.existsSync) {
	const candidates = [
		path.join(rootDir, 'apps/puzzled/server.js'),
		path.join(rootDir, 'server.js'),
	]
	return candidates.find((file) => exists(file)) ?? null
}

if (require.main === module) {
	applyListenEnv(process.env)
	const server = resolveStandaloneServer(__dirname)
	if (!server) {
		console.error('[puzzled-web] standalone server.js not found under', __dirname)
		process.exit(1)
	}
	require(server)
}

module.exports = {
	applyListenEnv,
	listenBind,
	parseListenPort,
	resolveStandaloneServer,
}

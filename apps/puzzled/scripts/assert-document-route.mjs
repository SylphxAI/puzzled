#!/usr/bin/env node
/**
 * Source pin: GET `/` must return an HTML document even when Connect never
 * answers. Do not green from `/healthz`.
 */

const http = require('node:http')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const net = require('node:net')
const path = require('node:path')

const APP_ROOT = path.resolve(__dirname, '..')
const GET_BUDGET_MS = 8000
const LISTEN_BUDGET_MS = 30000

function listenHang() {
	return new Promise((resolve, reject) => {
		const server = http.createServer(() => {
			// Accept and never respond.
		})
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address()
			if (!addr || typeof addr === 'string') {
				reject(new Error('blackhole has no port'))
				return
			}
			resolve({
				port: addr.port,
				close: () =>
					new Promise((done, fail) => {
						if (typeof server.closeAllConnections === 'function') {
							server.closeAllConnections()
						}
						server.close((err) => (err ? fail(err) : done()))
					}),
			})
		})
	})
}

function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer()
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address()
			if (!addr || typeof addr === 'string') {
				reject(new Error('no free port'))
				return
			}
			const port = addr.port
			server.close((err) => (err ? reject(err) : resolve(port)))
		})
	})
}

function waitForPort(port, budgetMs) {
	const started = Date.now()
	return new Promise((resolve, reject) => {
		const tryOnce = () => {
			const socket = net.connect({ host: '127.0.0.1', port })
			socket.once('connect', () => {
				socket.end()
				resolve()
			})
			socket.once('error', () => {
				socket.destroy()
				if (Date.now() - started > budgetMs) {
					reject(new Error(`web did not listen on ${port} within ${budgetMs}ms`))
					return
				}
				setTimeout(tryOnce, 150)
			})
		}
		tryOnce()
	})
}

function isHtmlDocument(contentType, body) {
	if (!body) return false
	const ct = String(contentType ?? '').toLowerCase()
	return (
		ct.includes('text/html') ||
		body.includes('<html') ||
		body.trimStart().toLowerCase().startsWith('<!doctype html')
	)
}

async function main() {
	const hang = await listenHang()
	const webPort = await freePort()
	const child = spawn('bunx', ['next', 'start', '-H', '0.0.0.0', '-p', String(webPort)], {
		cwd: APP_ROOT,
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOSTNAME: '0.0.0.0',
			PORT: String(webPort),
			API_INTERNAL_URL: `http://127.0.0.1:${hang.port}`,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	let stdout = ''
	let stderr = ''
	child.stdout?.on('data', (chunk) => {
		stdout += chunk
		process.stdout.write(chunk)
	})
	child.stderr?.on('data', (chunk) => {
		stderr += chunk
		process.stderr.write(chunk)
	})
	const exitPromise = new Promise((resolve) => child.on('exit', resolve))
	try {
		await Promise.race([
			waitForPort(webPort, LISTEN_BUDGET_MS),
			exitPromise.then((code) => {
				throw new Error(`next start exited ${code} before listen\n${stdout}\n${stderr}`)
			}),
		])
		const started = Date.now()
		const response = await fetch(`http://127.0.0.1:${webPort}/`, {
			signal: AbortSignal.timeout(GET_BUDGET_MS),
			redirect: 'manual',
		})
		const body = await response.text()
		const elapsed = Date.now() - started
		const contentType = response.headers.get('content-type')
		if (elapsed >= GET_BUDGET_MS) {
			throw new Error(`GET / exceeded ${GET_BUDGET_MS}ms`)
		}
		if (!body || body.length === 0) {
			throw new Error(`GET / returned empty body status=${response.status} type=${contentType}`)
		}
		if (!isHtmlDocument(contentType, body)) {
			throw new Error(
				`GET / is not an HTML document status=${response.status} type=${contentType} body=${body.slice(0, 180)}`,
			)
		}
		console.log(`GET / document ok status=${response.status} bytes=${body.length} ms=${elapsed}`)
	} finally {
		child.kill('SIGTERM')
		await Promise.race([exitPromise, delay(2000)])
		if (child.exitCode === null && child.signalCode === null) {
			child.kill('SIGKILL')
		}
		await hang.close().catch(() => {})
	}
}

main().catch((error) => {
	console.error('[assert-document-route]', error)
	process.exit(1)
})

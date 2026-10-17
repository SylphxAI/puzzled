// Writes <file>.br (brotli quality 11) next to every compressible file under a
// directory (W-10074). Usage: node precompress-static.mjs <dir>
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

const EXT = new Set(['.js', '.css', '.json', '.svg', '.txt', '.html'])
const dir = process.argv[2]
if (!dir) {
	console.error('usage: precompress-static.mjs <dir>')
	process.exit(2)
}

let files = 0
let before = 0
let after = 0
function walk(d) {
	for (const name of readdirSync(d)) {
		const file = join(d, name)
		if (statSync(file).isDirectory()) walk(file)
		else if (EXT.has(extname(name).toLowerCase())) {
			const raw = readFileSync(file)
			const br = brotliCompressSync(raw, {
				params: {
					[constants.BROTLI_PARAM_QUALITY]: 11,
					[constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
					[constants.BROTLI_PARAM_LGWIN]: 24,
				},
			})
			writeFileSync(`${file}.br`, br)
			files += 1
			before += raw.length
			after += br.length
		}
	}
}
walk(dir)
console.log(`precompressed ${files} files: ${before} -> ${after} bytes`)

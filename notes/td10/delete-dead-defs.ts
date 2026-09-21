import { readFileSync, writeFileSync } from 'node:fs'
import * as ts from 'typescript'

const listPath = process.argv[2]
const root = process.argv[3] ?? '.'
const rows = readFileSync(listPath, 'utf8')
	.split('\n')
	.filter((l) => l.trim().length > 0)
const targets = rows.map((l) => {
	const parts = l.split('\t')
	return { name: parts[0], file: parts[1], line: Number(parts[2]) }
})

const byFile = new Map()
for (const t of targets) {
	const arr = byFile.get(t.file) ?? []
	arr.push(t)
	byFile.set(t.file, arr)
}

const skipped = []
const removedList = []
let removed = 0

for (const [file, list] of byFile) {
	const abs = root + '/' + file
	let text = readFileSync(abs, 'utf8')
	const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
	const edits = []
	const seen = new Set()
	for (const stmt of sf.statements) {
		for (const t of list) {
			if (seen.has(t.name)) continue
			let hit = false
			if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.name.text === t.name) hit = true
			else if (ts.isClassDeclaration(stmt) && stmt.name && stmt.name.text === t.name) hit = true
			else if (ts.isVariableStatement(stmt)) {
				const decls = stmt.declarationList.declarations
				let idx = -1
				for (let i = 0; i < decls.length; i++) {
					const d = decls[i]
					if (ts.isIdentifier(d.name) && d.name.text === t.name) idx = i
				}
				if (idx >= 0) {
					if (decls.length > 1) {
						skipped.push('multi-declarator ' + file + ':' + t.line + ' ' + t.name)
						seen.add(t.name)
						continue
					}
					hit = true
				}
			}
			if (!hit) continue
			const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined
			if (
				mods &&
				mods.some(
					(m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword,
				)
			) {
				skipped.push('exported ' + file + ':' + t.line + ' ' + t.name)
				seen.add(t.name)
				continue
			}
			const startLine = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1
			if (startLine !== t.line) {
				skipped.push('line-mismatch ' + file + ':' + t.line + ' vs ' + startLine + ' ' + t.name)
				seen.add(t.name)
				continue
			}
			edits.push({ start: stmt.getFullStart(), end: stmt.getEnd(), name: t.name, line: t.line })
			seen.add(t.name)
		}
	}
	for (const t of list)
		if (!seen.has(t.name)) skipped.push('not-found ' + file + ':' + t.line + ' ' + t.name)
	edits.sort((a, b) => b.start - a.start)
	for (const e of edits) {
		text = text.slice(0, e.start) + text.slice(e.end)
		removed = removed + 1
		removedList.push(e.name + '\t' + file + '\t' + e.line)
	}
	writeFileSync(abs, text)
}

console.log(
	JSON.stringify({ removed: removed, skipped: skipped, removedList: removedList }, null, 2),
)

import { writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfflineDocument } from '../src/shared/components/offline/offline-document'

// Regenerate after changing the document, brand components, Button, or tokens.
writeFileSync(
	new URL('../public/offline.html', import.meta.url),
	`<!doctype html>${renderToStaticMarkup(<OfflineDocument />)}\n`,
)

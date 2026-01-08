'use client'

import { Download, FileDown, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { downloadJson, getExportFilename } from '@/lib/download'
import { Button } from '@sylphx/ui'
import { exportUserData } from '../actions/privacy-actions'

export function DataExport() {
	const t = useTranslations()
	const [isExporting, setIsExporting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleExport = async () => {
		setIsExporting(true)
		setError(null)

		try {
			const result = await exportUserData()

			if (result.success && result.data) {
				downloadJson(result.data, getExportFilename('puzzled-data-export'))
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t('settings.privacy.exportError'))
		} finally {
			setIsExporting(false)
		}
	}

	return (
		<div className="space-y-4">
			<div>
				<h4 className="mb-2 font-medium">{t('settings.privacy.exportData')}</h4>
				<p className="mb-4 text-sm text-muted-foreground">
					{t('settings.privacy.exportDescription')}
				</p>
				<Button onClick={handleExport} disabled={isExporting} variant="outline">
					{isExporting ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							{t('settings.privacy.exporting')}
						</>
					) : (
						<>
							<Download className="mr-2 h-4 w-4" />
							{t('settings.privacy.exportButton')}
						</>
					)}
				</Button>
				{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
			</div>

			<div className="rounded-lg border bg-muted/50 p-4">
				<div className="mb-2 flex items-start gap-2">
					<FileDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
					<div className="flex-1">
						<p className="text-sm font-medium">{t('settings.privacy.exportIncludes')}</p>
						<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
							<li>• {t('settings.privacy.exportProfile')}</li>
							<li>• {t('settings.privacy.exportGameHistory')}</li>
							<li>• {t('settings.privacy.exportStats')}</li>
							<li>• {t('settings.privacy.exportStreaks')}</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	)
}

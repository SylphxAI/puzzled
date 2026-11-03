'use client'

import { Button } from '@sylphx/ui'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { useClipboardCopy } from '@/shared/hooks/use-clipboard-copy'

export type AccountIdProps = {
	/** The signed-in player's own Auth subject; shown to that player only. */
	id: string
	label: string
	hint: string
	copyLabel: string
	copiedLabel: string
}

/**
 * The player's own account id with a copy button. It is the player's own
 * identifier (not a secret) and what support asks for.
 */
export function AccountId({ id, label, hint, copyLabel, copiedLabel }: AccountIdProps) {
	const t = useTranslations('common.clipboard')
	const textRef = useRef<HTMLElement>(null)
	const { status, copy } = useClipboardCopy(id, textRef)

	return (
		<div className="mt-4 border-t pt-4">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<div className="mt-1 flex items-center gap-2">
				<code
					ref={textRef}
					tabIndex={-1}
					className="min-w-0 flex-1 select-all break-all text-sm"
					data-testid="account-id"
				>
					{id}
				</code>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={copy}
					disabled={status === 'pending'}
					aria-busy={status === 'pending'}
					className="min-h-11 shrink-0 gap-2"
				>
					{status === 'copied' ? (
						<Check className="h-4 w-4" aria-hidden="true" />
					) : (
						<Copy className="h-4 w-4" aria-hidden="true" />
					)}
					<span aria-live="polite">
						{status === 'pending' ? t('pending') : status === 'copied' ? copiedLabel : copyLabel}
					</span>
				</Button>
			</div>
			{status === 'failed' && (
				<p role="alert" className="mt-2 text-sm text-destructive">
					{t('failed')}
				</p>
			)}
			<p className="mt-1 text-xs text-muted-foreground">{hint}</p>
		</div>
	)
}

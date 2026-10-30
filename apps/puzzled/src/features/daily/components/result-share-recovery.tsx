'use client'

import { Button } from '@sylphx/ui'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { selectCopyText, useClipboardCopy } from '@/shared/hooks/use-clipboard-copy'

/** Keep the caption available when automatic sharing or copying is refused. */
export function ResultShareRecovery({ text }: { text: string }) {
	const tCommon = useTranslations('common')
	const tShare = useTranslations('share')
	const textRef = useRef<HTMLTextAreaElement>(null)
	const { status, copy } = useClipboardCopy(text, textRef)
	useEffect(() => {
		selectCopyText(textRef.current)
	}, [])

	return (
		<div className="space-y-2">
			{(status === 'idle' || status === 'failed') && (
				<p role="alert" className="text-sm text-destructive">
					{tCommon('clipboard.failed')}
				</p>
			)}
			<textarea
				ref={textRef}
				aria-label={tShare('card.caption')}
				readOnly
				value={text}
				rows={4}
				className="w-full resize-none rounded-lg border border-border bg-muted p-3 text-sm"
			/>
			<Button
				type="button"
				variant="outline"
				className="min-h-11 w-full"
				onClick={copy}
				disabled={status === 'pending'}
				aria-busy={status === 'pending'}
			>
				<span aria-live="polite">
					{status === 'pending'
						? tCommon('clipboard.pending')
						: status === 'copied'
							? tCommon('copied')
							: tShare('copy')}
				</span>
			</Button>
		</div>
	)
}

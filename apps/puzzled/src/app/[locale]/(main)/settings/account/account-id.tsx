'use client'

import { Button } from '@sylphx/ui'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

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
	const [copied, setCopied] = useState(false)

	async function copy() {
		try {
			await navigator.clipboard.writeText(id)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Clipboard can be blocked; the id stays selectable on screen.
		}
	}

	return (
		<div className="mt-4 border-t pt-4">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			<div className="mt-1 flex items-center gap-2">
				<code className="min-w-0 flex-1 select-all break-all text-sm" data-testid="account-id">
					{id}
				</code>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={copy}
					className="min-h-11 shrink-0 gap-2"
				>
					{copied ? (
						<Check className="h-4 w-4" aria-hidden="true" />
					) : (
						<Copy className="h-4 w-4" aria-hidden="true" />
					)}
					<span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
				</Button>
			</div>
			<p className="mt-1 text-xs text-muted-foreground">{hint}</p>
		</div>
	)
}

'use client'

import { Delete } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/shared/hooks'
import type { LetterStatus } from '../types'
import { KEYBOARD_ROWS } from '../types'

const STATUS_HINTS: Record<LetterStatus, string> = {
	correct: 'in correct position',
	present: 'in word but wrong position',
	absent: 'not in word',
	empty: '',
	pending: '',
}

const STATUS_COLORS: Record<LetterStatus, string> = {
	correct: 'bg-correct text-white',
	present: 'bg-present text-white',
	absent: 'bg-absent text-white',
	empty: 'bg-key-bg text-key-text',
	pending: 'bg-key-bg text-key-text',
}

type KeyProps = {
	label: string
	status?: LetterStatus
	onClick: () => void
	canSubmit?: boolean
}

const Key = memo(function Key({ label, status, onClick, canSubmit }: KeyProps) {
	const ariaLabel = useMemo(() => {
		if (label === 'BACKSPACE') return 'Delete letter'
		if (label === 'ENTER') return 'Submit word'
		const statusHint = status && STATUS_HINTS[status]
		return statusHint ? `Letter ${label}, ${statusHint}` : `Letter ${label}`
	}, [label, status])

	const isUsed = status && status !== 'empty' && status !== 'pending'
	const isEnter = label === 'ENTER'
	const isBackspace = label === 'BACKSPACE'
	const isAction = isEnter || isBackspace

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel}
			aria-pressed={isUsed ? true : undefined}
			className={cn(
				'flex min-h-[44px] min-w-0 flex-1 items-center justify-center font-bold uppercase',
				'transition-all active:scale-95',
				// Letter keys - standard rounded rectangle
				!isAction && ['rounded-lg text-sm sm:text-base', STATUS_COLORS[status || 'empty']],
				// ENTER - changes based on whether guess is complete
				isEnter && [
					'flex-[1.5] rounded-xl text-xs sm:text-sm',
					canSubmit
						? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 active:shadow-sm'
						: 'bg-muted text-muted-foreground',
				],
				// BACKSPACE - secondary action, subtle styling
				isBackspace && [
					'flex-[1.5] rounded-xl',
					'bg-muted text-muted-foreground',
					'hover:bg-muted/80',
				],
			)}
		>
			{isBackspace ? (
				<Delete className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
			) : isEnter ? (
				<svg
					className="h-4 w-4 sm:h-5 sm:w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<polyline points="9 10 4 15 9 20" />
					<path d="M20 4v7a4 4 0 0 1-4 4H4" />
				</svg>
			) : (
				label
			)}
		</button>
	)
})

type KeyboardProps = {
	keyboardState: Record<string, LetterStatus>
	onKeyPress: (key: string) => void
	onEnter: () => void
	onDelete: () => void
	canSubmit?: boolean
}

export function Keyboard({
	keyboardState,
	onKeyPress,
	onEnter,
	onDelete,
	canSubmit,
}: KeyboardProps) {
	const handleClick = useCallback(
		(key: string) => {
			if (key === 'ENTER') {
				triggerHaptic('submit')
				onEnter()
			} else if (key === 'BACKSPACE') {
				triggerHaptic('keyPress')
				onDelete()
			} else {
				triggerHaptic('keyPress')
				onKeyPress(key)
			}
		},
		[onEnter, onDelete, onKeyPress],
	)

	return (
		<div
			className="flex w-full max-w-[512px] flex-col gap-1.5 px-1 sm:px-0"
			role="group"
			aria-label="On-screen keyboard"
		>
			{/* Row 1: Q W E R T Y U I O P */}
			<div className="flex w-full gap-1" role="group" aria-label="Keyboard row 1">
				{KEYBOARD_ROWS[0].map((key) => (
					<Key key={key} label={key} status={keyboardState[key]} onClick={() => handleClick(key)} />
				))}
			</div>

			{/* Row 2: A S D F G H J K L - with padding for centering */}
			<div className="flex w-full gap-1 px-[5%]" role="group" aria-label="Keyboard row 2">
				{KEYBOARD_ROWS[1].map((key) => (
					<Key key={key} label={key} status={keyboardState[key]} onClick={() => handleClick(key)} />
				))}
			</div>

			{/* Row 3: ENTER Z X C V B N M BACKSPACE */}
			<div className="flex w-full gap-1" role="group" aria-label="Keyboard row 3">
				{KEYBOARD_ROWS[2].map((key) => (
					<Key
						key={key}
						label={key}
						status={keyboardState[key]}
						onClick={() => handleClick(key)}
						canSubmit={key === 'ENTER' ? canSubmit : undefined}
					/>
				))}
			</div>
		</div>
	)
}

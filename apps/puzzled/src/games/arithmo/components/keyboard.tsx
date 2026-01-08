'use client'

/**
 * Arithmo Keyboard Component
 * Number and operator input keyboard
 */

import { CornerDownLeft, Delete } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import type { CharStatus } from '../types'

type ArithmoKeyboardProps = {
	onChar: (char: string) => void
	onDelete: () => void
	onEnter: () => void
	keyboardStatus: Record<string, CharStatus>
	disabled?: boolean
}

const ROWS = [
	['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
	['+', '-', '*', '/', '='],
]

export function ArithmoKeyboard({
	onChar,
	onDelete,
	onEnter,
	keyboardStatus,
	disabled = false,
}: ArithmoKeyboardProps) {
	const t = useTranslations('games.arithmo.keyboard')

	return (
		<div className="flex flex-col gap-1 sm:gap-1.5 w-full max-w-sm px-1">
			{/* Number row */}
			<div className="flex justify-center gap-0.5 sm:gap-1">
				{ROWS[0].map((key) => (
					<Key
						key={key}
						char={key}
						onClick={() => onChar(key)}
						status={keyboardStatus[key]}
						disabled={disabled}
					/>
				))}
			</div>

			{/* Operators row */}
			<div className="flex justify-center gap-0.5 sm:gap-1">
				<button
					type="button"
					onClick={onDelete}
					disabled={disabled}
					className={cn(
						'flex h-11 sm:h-12 w-12 sm:w-14 items-center justify-center rounded',
						'bg-muted font-bold text-foreground',
						'transition-colors hover:bg-muted/80',
						'active:scale-95',
						disabled && 'opacity-50 cursor-not-allowed',
					)}
					aria-label={t('delete')}
				>
					<Delete className="h-4 w-4 sm:h-5 sm:w-5" />
				</button>

				{ROWS[1].map((key) => (
					<Key
						key={key}
						char={key}
						onClick={() => onChar(key)}
						status={keyboardStatus[key]}
						disabled={disabled}
						isOperator
					/>
				))}

				<button
					type="button"
					onClick={onEnter}
					disabled={disabled}
					className={cn(
						'flex h-11 sm:h-12 w-12 sm:w-14 items-center justify-center rounded',
						'bg-primary font-bold text-primary-foreground',
						'transition-colors hover:bg-primary/90',
						'active:scale-95',
						disabled && 'opacity-50 cursor-not-allowed',
					)}
					aria-label={t('enter')}
				>
					<CornerDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
				</button>
			</div>
		</div>
	)
}

type KeyProps = {
	char: string
	onClick: () => void
	status?: CharStatus
	disabled?: boolean
	isOperator?: boolean
}

function Key({ char, onClick, status, disabled = false, isOperator = false }: KeyProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				'flex h-11 sm:h-12 items-center justify-center rounded',
				'font-bold text-base sm:text-lg transition-colors',
				'active:scale-95',
				isOperator ? 'w-9 sm:w-10' : 'w-7 sm:w-9',
				// Status colors
				!status || status === 'empty'
					? 'bg-muted text-foreground hover:bg-muted/80'
					: status === 'correct'
						? 'bg-correct text-white'
						: status === 'present'
							? 'bg-present text-white'
							: 'bg-absent text-white',
				disabled && 'opacity-50 cursor-not-allowed',
			)}
			aria-label={char}
		>
			{char}
		</button>
	)
}

/**
 * Word Guess Icon
 *
 * 5 letter tiles with one correct (filled)
 * Represents the core Wordle-like guessing mechanic
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function WordGuessIcon({ size = 24, className, ...props }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			{...props}
		>
			<rect x="2" y="8" width="4" height="4" rx="0.5" />
			<rect x="7" y="8" width="4" height="4" rx="0.5" fill="currentColor" />
			<rect x="12" y="8" width="4" height="4" rx="0.5" />
			<rect x="17" y="8" width="4" height="4" rx="0.5" />
			{/* Hint lines below */}
			<path d="M2 15h4M7 15h4M12 15h4M17 15h4" strokeWidth="1" opacity="0.4" />
		</svg>
	)
}


/**
 * Sudoku Icon
 *
 * 9x9 grid with 3x3 boxes
 * Represents the classic number puzzle
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function SudokuIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Outer border */}
			<rect x="2" y="2" width="20" height="20" rx="1" strokeWidth="2" />
			{/* 3x3 box dividers */}
			<path d="M8.67 2v20M15.33 2v20" strokeWidth="1.5" />
			<path d="M2 8.67h20M2 15.33h20" strokeWidth="1.5" />
			{/* Inner grid lines */}
			<path d="M5.33 2v20M12 2v20M18.67 2v20" strokeWidth="0.5" opacity="0.4" />
			<path d="M2 5.33h20M2 12h20M2 18.67h20" strokeWidth="0.5" opacity="0.4" />
			{/* Sample numbers */}
			<text x="5.33" y="7" textAnchor="middle" fontSize="4" fill="currentColor" stroke="none">9</text>
			<text x="12" y="14" textAnchor="middle" fontSize="4" fill="currentColor" stroke="none">5</text>
		</svg>
	)
}


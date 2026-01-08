/**
 * Killer Sudoku Icon
 *
 * Sudoku with dotted cage regions
 * Represents sudoku with sum constraints
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number
}

export function KillerSudokuIcon({ size = 24, className, ...props }: IconProps) {
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
			{/* Box dividers */}
			<path d="M8.67 2v20M15.33 2v20" strokeWidth="1.5" />
			<path d="M2 8.67h20M2 15.33h20" strokeWidth="1.5" />
			{/* Cage outlines (dotted) */}
			<path
				d="M2 2h6.67v6.67H2z"
				strokeDasharray="2 1"
				fill="currentColor"
				fillOpacity="0.1"
			/>
			<path
				d="M15.33 8.67h6.67v6.67h-6.67z"
				strokeDasharray="2 1"
				fill="currentColor"
				fillOpacity="0.15"
			/>
			{/* Cage sum hint */}
			<text x="3.5" y="5" fontSize="3" fill="currentColor" stroke="none">17</text>
		</svg>
	)
}

export default KillerSudokuIcon

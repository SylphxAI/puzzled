/**
 * Cryptogram Icon
 *
 * Cipher wheel / decoder ring
 * Represents decrypting letter substitutions
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number;
};

export function CryptogramIcon({ size = 24, className, ...props }: IconProps) {
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
			aria-hidden="true"
			{...props}
		>
			{/* Outer ring */}
			<circle cx="12" cy="12" r="9" />
			{/* Inner ring */}
			<circle cx="12" cy="12" r="5" />
			{/* Tick marks around outer ring */}
			<path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
			<path d="M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
			{/* Letters hint */}
			<text
				x="12"
				y="9"
				textAnchor="middle"
				fontSize="3"
				fill="currentColor"
				stroke="none"
			>
				A
			</text>
			<text
				x="12"
				y="16.5"
				textAnchor="middle"
				fontSize="3"
				fill="currentColor"
				stroke="none"
			>
				?
			</text>
			{/* Pointer */}
			<path d="M12 7v3" strokeWidth="2" />
		</svg>
	);
}

/**
 * Game Icons
 *
 * Provides base icon components and constants for game-related icons.
 * Individual game icons should be defined in their respective game modules.
 */

import { Icon } from "./icon";

type GameIconProps = {
	className?: string;
	size?: number;
	"aria-hidden"?: boolean | "true" | "false";
};

// ==========================================
// Branding Icons (used in auth pages)
// ==========================================

export function GamepadIcon({ className, size = 24, ...props }: GameIconProps) {
	return (
		<Icon
			icon="mdi:gamepad-variant"
			className={className}
			width={size}
			height={size}
			{...props}
		/>
	);
}

// Leaderboard Avatar Icons
export const AVATAR_ICONS = [
	"mdi:trophy",
	"mdi:medal",
	"mdi:star",
	"mdi:target",
	"mdi:fire",
	"mdi:crown",
	"mdi:lightning-bolt",
	"mdi:brain",
	"mdi:book-open-variant",
	"mdi:school",
] as const;

export function AvatarIcon({
	index,
	className,
	size = 24,
	...props
}: GameIconProps & { index: number }) {
	const iconName = AVATAR_ICONS[index % AVATAR_ICONS.length] ?? "mdi:trophy";
	return (
		<Icon
			icon={iconName}
			className={className}
			width={size}
			height={size}
			{...props}
		/>
	);
}

// Category Colors for Word Groups (text representation for share)
// Using distinctive Puzzled palette instead of NYT colors
export const CATEGORY_COLORS = {
	0: "rose", // Coral pink (was yellow)
	1: "teal", // Cyan (was green)
	2: "amber", // Gold (was blue)
	3: "fuchsia", // Violet (was purple)
} as const;

// Share text helpers (text-based for clipboard compatibility)
// Using purple/orange for Word Guess (distinctive from NYT green/yellow)
export const SHARE_SQUARES = {
	correct: "🟪", // Purple - Puzzled brand (was green)
	partial: "🟧", // Orange - warm, friendly (was yellow)
	wrong: "⬛",
	// Word Groups category colors
	rose: "🟥", // Coral/Rose
	teal: "🩵", // Teal/Cyan
	amber: "🟨", // Amber/Gold
	fuchsia: "🟪", // Fuchsia/Violet
} as const;

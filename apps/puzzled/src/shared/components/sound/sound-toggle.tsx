"use client";

import { cn } from "@/lib/utils";
import { useSound } from "@/shared/hooks";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

type SoundToggleProps = {
	className?: string;
	showLabel?: boolean;
};

/**
 * Sound Toggle Button
 * Allows users to enable/disable game sound effects.
 * State is persisted to localStorage.
 */
function _SoundToggle({ className, showLabel = false }: SoundToggleProps) {
	const { isMuted, toggleSound, isSupported } = useSound();
	const [mounted, setMounted] = useState(false);

	// Prevent hydration mismatch
	useEffect(() => {
		setMounted(true);
	}, []);

	// Don't render on server or if not supported
	if (!mounted) {
		return (
			<button
				type="button"
				className={cn(
					"flex h-10 items-center justify-center gap-1.5 rounded-full px-2 transition-colors",
					className,
				)}
				disabled
			>
				<Volume2 className="h-5 w-5" />
				{showLabel && <span className="text-sm">Sound</span>}
			</button>
		);
	}

	if (!isSupported) {
		return null;
	}

	const Icon = isMuted ? VolumeX : Volume2;
	const label = isMuted ? "Sound off" : "Sound on";

	return (
		<button
			type="button"
			onClick={toggleSound}
			className={cn(
				"flex h-10 items-center justify-center gap-1.5 rounded-full px-2 transition-colors hover:bg-muted",
				className,
			)}
			title={label}
			aria-label={label}
			aria-pressed={!isMuted}
		>
			<Icon className={cn("h-5 w-5", isMuted && "text-muted-foreground")} />
			{showLabel && <span className="text-sm">{isMuted ? "Off" : "On"}</span>}
		</button>
	);
}

/**
 * Compact version for header - just the icon
 */
export function SoundToggleCompact({ className }: { className?: string }) {
	const { isMuted, toggleSound, isSupported } = useSound();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<button
				type="button"
				className={cn(
					"flex h-10 w-10 items-center justify-center rounded-full",
					className,
				)}
				disabled
			>
				<Volume2 className="h-5 w-5" />
			</button>
		);
	}

	if (!isSupported) {
		return null;
	}

	const Icon = isMuted ? VolumeX : Volume2;
	const label = isMuted
		? "Sound off (click to enable)"
		: "Sound on (click to mute)";

	return (
		<button
			type="button"
			onClick={toggleSound}
			className={cn(
				"flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted",
				className,
			)}
			title={label}
			aria-label={label}
			aria-pressed={!isMuted}
		>
			<Icon className={cn("h-5 w-5", isMuted && "text-muted-foreground")} />
		</button>
	);
}

"use client";

/**
 * @sylphx/ui - Avatar Component
 *
 * Image-based avatar with fallback support.
 * Custom implementation without Radix dependency.
 *
 * @example
 * ```tsx
 * import { Avatar, AvatarImage, AvatarFallback } from '@sylphx/ui'
 *
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="User" />
 *   <AvatarFallback>JD</AvatarFallback>
 * </Avatar>
 * ```
 */

import {
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useState,
} from "react";
import { cn } from "../utils";

// ==================
// Context for managing image load state
// ==================

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

const AvatarContext = createContext<{
	status: ImageLoadingStatus;
	setStatus: (status: ImageLoadingStatus) => void;
}>({
	status: "idle",
	setStatus: () => {},
});

// ==================
// Avatar Root
// ==================

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children */
	children?: React.ReactNode;
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
	({ className, children, ...props }, ref) => {
		const [status, setStatus] = useState<ImageLoadingStatus>("idle");

		return (
			<AvatarContext.Provider value={{ status, setStatus }}>
				<span
					ref={ref}
					className={cn(
						"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
						className,
					)}
					{...props}
				>
					{children}
				</span>
			</AvatarContext.Provider>
		);
	},
);
Avatar.displayName = "Avatar";

// ==================
// Avatar Image
// ==================

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	/** Image source URL */
	src?: string;
	/** Alt text for accessibility */
	alt?: string;
	/** Additional CSS classes */
	className?: string;
}

const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
	({ className, src, alt, onLoad, onError, ...props }, ref) => {
		const { status, setStatus } = useContext(AvatarContext);

		useEffect(() => {
			if (!src) {
				setStatus("error");
				return;
			}

			setStatus("loading");

			// Preload image
			const img = new Image();
			img.src = src;
			img.onload = () => setStatus("loaded");
			img.onerror = () => setStatus("error");

			return () => {
				img.onload = null;
				img.onerror = null;
			};
		}, [src, setStatus]);

		if (status !== "loaded") {
			return null;
		}

		return (
			<img
				ref={ref}
				src={src}
				alt={alt}
				className={cn("aspect-square h-full w-full", className)}
				{...props}
			/>
		);
	},
);
AvatarImage.displayName = "AvatarImage";

// ==================
// Avatar Fallback
// ==================

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children */
	children?: React.ReactNode;
	/** Delay before showing fallback (in ms) */
	delayMs?: number;
}

const AvatarFallback = forwardRef<HTMLSpanElement, AvatarFallbackProps>(
	({ className, children, delayMs = 0, ...props }, ref) => {
		const { status } = useContext(AvatarContext);
		const [canRender, setCanRender] = useState(delayMs === 0);

		useEffect(() => {
			if (delayMs > 0) {
				const timer = setTimeout(() => setCanRender(true), delayMs);
				return () => clearTimeout(timer);
			}
		}, [delayMs]);

		// Only show fallback if image failed to load or is loading
		if (status === "loaded" || !canRender) {
			return null;
		}

		return (
			<span
				ref={ref}
				className={cn(
					"flex h-full w-full items-center justify-center rounded-full bg-muted",
					className,
				)}
				{...props}
			>
				{children}
			</span>
		);
	},
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };

export type { AvatarProps, AvatarImageProps, AvatarFallbackProps };

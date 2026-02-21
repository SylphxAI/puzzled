"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, easing } from "../motion/config";
import { cn } from "../utils";

// ==================
// Tooltip Provider
// ==================

interface TooltipProviderProps {
	/** Delay in ms before showing tooltips */
	delayDuration?: number;
	/** Children */
	children?: React.ReactNode;
}

function TooltipProvider({
	delayDuration = 200,
	children,
}: TooltipProviderProps) {
	return (
		<BaseTooltip.Provider delay={delayDuration}>
			{children}
		</BaseTooltip.Provider>
	);
}

// ==================
// Tooltip Root
// ==================

interface TooltipProps {
	/** Whether the tooltip is open (controlled) */
	open?: boolean;
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean;
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Delay in ms before showing (only works without Provider) */
	delayDuration?: number;
	/** Children */
	children?: React.ReactNode;
}

function Tooltip({ open, defaultOpen, onOpenChange, children }: TooltipProps) {
	return (
		<BaseTooltip.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			{children}
		</BaseTooltip.Root>
	);
}

// ==================
// Tooltip Trigger
// ==================

interface TooltipTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to render as child */
	asChild?: boolean;
}

const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
	({ className, children, asChild }, ref) => (
		<BaseTooltip.Trigger
			ref={ref}
			className={className}
			render={asChild ? (children as React.ReactElement) : undefined}
		>
			{asChild ? undefined : children}
		</BaseTooltip.Trigger>
	),
);
TooltipTrigger.displayName = "TooltipTrigger";

// ==================
// Tooltip Content
// ==================

const MotionDiv = motion.create("div");

interface TooltipContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Side offset */
	sideOffset?: number;
	/** Side */
	side?: "top" | "right" | "bottom" | "left";
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
	({ className, sideOffset = 4, side = "top", children }, ref) => (
		<BaseTooltip.Portal>
			<BaseTooltip.Positioner sideOffset={sideOffset} side={side}>
				<BaseTooltip.Popup
					ref={ref}
					className={cn(
						"z-tooltip overflow-hidden rounded-lg bg-foreground text-sm text-background shadow-md",
						className,
					)}
				>
					<MotionDiv
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="px-3 py-1.5"
					>
						{children}
					</MotionDiv>
				</BaseTooltip.Popup>
			</BaseTooltip.Positioner>
		</BaseTooltip.Portal>
	),
);
TooltipContent.displayName = "TooltipContent";

// ==================
// Simple Tooltip (Convenience Component)
// ==================

type SimpleTooltipProps = {
	content: React.ReactNode;
	children: React.ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	delayDuration?: number;
};

function SimpleTooltip({
	content,
	children,
	side = "top",
	delayDuration = 200,
}: SimpleTooltipProps) {
	return (
		<TooltipProvider delayDuration={delayDuration}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent side={side}>{content}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
	SimpleTooltip,
};

export type {
	TooltipProps,
	TooltipProviderProps,
	TooltipTriggerProps,
	TooltipContentProps,
	SimpleTooltipProps,
};

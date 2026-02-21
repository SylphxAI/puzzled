"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { forwardRef } from "react";
import { cn } from "../utils";

// ==================
// Collapsible Root
// ==================

interface CollapsibleProps {
	/** Whether the collapsible is open (controlled) */
	open?: boolean;
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean;
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Whether the collapsible is disabled */
	disabled?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Children */
	children?: React.ReactNode;
}

const Collapsible = forwardRef<HTMLDivElement, CollapsibleProps>(
	({ className, open, defaultOpen, onOpenChange, disabled, children }, ref) => (
		<BaseCollapsible.Root
			ref={ref}
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			disabled={disabled}
			className={className}
		>
			{children}
		</BaseCollapsible.Root>
	),
);
Collapsible.displayName = "Collapsible";

// ==================
// Collapsible Trigger
// ==================

interface CollapsibleTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to render as child */
	asChild?: boolean;
}

const CollapsibleTrigger = forwardRef<
	HTMLButtonElement,
	CollapsibleTriggerProps
>(({ className, children, asChild }, ref) => (
	<BaseCollapsible.Trigger
		ref={ref}
		className={className}
		render={asChild ? (children as React.ReactElement) : undefined}
	>
		{asChild ? undefined : children}
	</BaseCollapsible.Trigger>
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

// ==================
// Collapsible Content
// ==================

interface CollapsibleContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const CollapsibleContent = forwardRef<HTMLDivElement, CollapsibleContentProps>(
	({ className, children }, ref) => (
		<BaseCollapsible.Panel
			ref={ref}
			className={cn("overflow-hidden", className)}
		>
			{children}
		</BaseCollapsible.Panel>
	),
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

export type {
	CollapsibleProps,
	CollapsibleTriggerProps,
	CollapsibleContentProps,
};

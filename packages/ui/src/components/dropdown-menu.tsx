"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, easing } from "../motion/config";
import { cn } from "../utils";

// Create motion-enhanced div
const MotionDiv = motion.create("div");
const MotionSpan = motion.create("span");

// ==================
// DropdownMenu Root
// ==================

interface DropdownMenuProps {
	/** Whether the menu is open (controlled) */
	open?: boolean;
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean;
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Children */
	children?: React.ReactNode;
}

function DropdownMenu({
	open,
	defaultOpen,
	onOpenChange,
	children,
}: DropdownMenuProps) {
	return (
		<BaseMenu.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			{children}
		</BaseMenu.Root>
	);
}

// ==================
// DropdownMenu Trigger
// ==================

interface DropdownMenuTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to render as child */
	asChild?: boolean;
}

const DropdownMenuTrigger = forwardRef<
	HTMLButtonElement,
	DropdownMenuTriggerProps
>(({ className, children, asChild }, ref) => (
	<BaseMenu.Trigger
		ref={ref}
		className={className}
		render={asChild ? (children as React.ReactElement) : undefined}
	>
		{asChild ? undefined : children}
	</BaseMenu.Trigger>
));
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

// ==================
// DropdownMenu Group
// ==================

interface DropdownMenuGroupProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const DropdownMenuGroup = forwardRef<HTMLDivElement, DropdownMenuGroupProps>(
	({ className, children }, ref) => (
		<BaseMenu.Group ref={ref} className={className}>
			{children}
		</BaseMenu.Group>
	),
);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

// ==================
// DropdownMenu Portal
// ==================

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
	return <BaseMenu.Portal>{children}</BaseMenu.Portal>;
}

// ==================
// DropdownMenu Sub
// ==================

interface DropdownMenuSubProps {
	/** Whether the submenu is open (controlled) */
	open?: boolean;
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean;
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Children */
	children?: React.ReactNode;
}

function DropdownMenuSub({
	open,
	defaultOpen,
	onOpenChange,
	children,
}: DropdownMenuSubProps) {
	return (
		<BaseMenu.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			{children}
		</BaseMenu.Root>
	);
}

// ==================
// DropdownMenu RadioGroup
// ==================

interface DropdownMenuRadioGroupProps {
	/** Controlled value */
	value?: string;
	/** Handler fired when value changes */
	onValueChange?: (value: string) => void;
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const DropdownMenuRadioGroup = forwardRef<
	HTMLDivElement,
	DropdownMenuRadioGroupProps
>(({ className, value, onValueChange, children }, ref) => (
	<BaseMenu.RadioGroup
		ref={ref}
		value={value}
		onValueChange={onValueChange}
		className={className}
	>
		{children}
	</BaseMenu.RadioGroup>
));
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

// ==================
// DropdownMenu SubTrigger
// ==================

interface DropdownMenuSubTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to inset the content */
	inset?: boolean;
}

const DropdownMenuSubTrigger = forwardRef<
	HTMLDivElement,
	DropdownMenuSubTriggerProps
>(({ className, inset, children }, ref) => (
	<BaseMenu.SubmenuTrigger
		ref={ref}
		className={cn(
			// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
			"flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 min-h-11 text-sm outline-none focus:bg-muted data-[popup-open]:bg-muted [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
			inset && "pl-8",
			className,
		)}
	>
		{children}
		<ChevronRight className="ml-auto" />
	</BaseMenu.SubmenuTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

// ==================
// DropdownMenu SubContent
// ==================

interface DropdownMenuSubContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const DropdownMenuSubContent = forwardRef<
	HTMLDivElement,
	DropdownMenuSubContentProps
>(({ className, children }, ref) => (
	<BaseMenu.Portal>
		<BaseMenu.Positioner>
			<BaseMenu.Popup
				ref={ref}
				className={cn(
					"dropdown-sub-content z-popover min-w-[8rem] overflow-hidden rounded-lg border bg-card p-1 text-card-foreground shadow-lg",
					className,
				)}
			>
				{children}
			</BaseMenu.Popup>
		</BaseMenu.Positioner>
	</BaseMenu.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

// ==================
// DropdownMenu Content
// ==================

interface DropdownMenuContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Side offset */
	sideOffset?: number;
	/** Side */
	side?: "top" | "right" | "bottom" | "left";
	/** Alignment */
	align?: "start" | "center" | "end";
}

const DropdownMenuContent = forwardRef<
	HTMLDivElement,
	DropdownMenuContentProps
>(
	(
		{ className, sideOffset = 4, side = "bottom", align = "start", children },
		ref,
	) => (
		<BaseMenu.Portal>
			<BaseMenu.Positioner sideOffset={sideOffset} side={side} align={align}>
				<BaseMenu.Popup
					ref={ref}
					className={cn(
						"z-popover min-w-[8rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg",
						className,
					)}
				>
					<MotionDiv
						initial={{ opacity: 0, scale: 0.95, y: -4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
						className="p-1"
					>
						{children}
					</MotionDiv>
				</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

// ==================
// DropdownMenu Item
// ==================

interface DropdownMenuItemProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to inset the content */
	inset?: boolean;
	/** Whether the item is destructive */
	destructive?: boolean;
	/** Whether the item is disabled */
	disabled?: boolean;
	/** Click handler */
	onClick?: (e?: React.MouseEvent) => void;
	/** Select handler (alias for onClick, for Radix compatibility) */
	onSelect?: (e?: React.MouseEvent) => void;
	/** Whether to render as child element */
	asChild?: boolean;
}

const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
	(
		{
			className,
			inset,
			destructive,
			disabled,
			onClick,
			onSelect,
			asChild,
			children,
		},
		ref,
	) => (
		<BaseMenu.Item
			ref={ref}
			disabled={disabled}
			onClick={onClick ?? onSelect}
			render={asChild ? (children as React.ReactElement) : undefined}
			className={cn(
				// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
				"relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
				inset && "pl-8",
				destructive && "text-destructive focus:text-destructive",
				className,
			)}
		>
			{asChild ? undefined : children}
		</BaseMenu.Item>
	),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

// ==================
// DropdownMenu CheckboxItem
// ==================

interface DropdownMenuCheckboxItemProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether the item is checked */
	checked?: boolean;
	/** Handler fired when checked state changes */
	onCheckedChange?: (checked: boolean) => void;
	/** Whether the item is disabled */
	disabled?: boolean;
}

const DropdownMenuCheckboxItem = forwardRef<
	HTMLDivElement,
	DropdownMenuCheckboxItemProps
>(({ className, children, checked, onCheckedChange, disabled }, ref) => (
	<BaseMenu.CheckboxItem
		ref={ref}
		checked={checked}
		onCheckedChange={onCheckedChange}
		disabled={disabled}
		className={cn(
			// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
			"relative flex cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
	>
		<span className="absolute left-2 flex h-4 w-4 items-center justify-center">
			<BaseMenu.CheckboxItemIndicator keepMounted>
				<MotionSpan
					initial={{ opacity: 0, scale: 0 }}
					animate={
						checked ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }
					}
					transition={{ type: "spring", stiffness: 500, damping: 20 }}
				>
					<Check className="h-4 w-4" />
				</MotionSpan>
			</BaseMenu.CheckboxItemIndicator>
		</span>
		{children}
	</BaseMenu.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

// ==================
// DropdownMenu RadioItem
// ==================

interface DropdownMenuRadioItemProps {
	/** Value of the radio item */
	value: string;
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether the item is disabled */
	disabled?: boolean;
}

const DropdownMenuRadioItem = forwardRef<
	HTMLDivElement,
	DropdownMenuRadioItemProps
>(({ className, children, value, disabled }, ref) => (
	<BaseMenu.RadioItem
		ref={ref}
		value={value}
		disabled={disabled}
		className={cn(
			// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
			"relative flex cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
	>
		<span className="absolute left-2 flex h-4 w-4 items-center justify-center">
			<BaseMenu.RadioItemIndicator>
				<Circle className="h-2 w-2 fill-current" />
			</BaseMenu.RadioItemIndicator>
		</span>
		{children}
	</BaseMenu.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

// ==================
// DropdownMenu Label
// ==================

interface DropdownMenuLabelProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to inset the label */
	inset?: boolean;
}

const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
	({ className, inset, children }, ref) => (
		<BaseMenu.GroupLabel
			ref={ref}
			className={cn(
				"px-3 py-2 text-sm font-semibold",
				inset && "pl-8",
				className,
			)}
		>
			{children}
		</BaseMenu.GroupLabel>
	),
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

// ==================
// DropdownMenu Separator
// ==================

interface DropdownMenuSeparatorProps {
	/** Additional CSS classes */
	className?: string;
}

const DropdownMenuSeparator = forwardRef<
	HTMLDivElement,
	DropdownMenuSeparatorProps
>(({ className }, ref) => (
	<BaseMenu.Separator
		ref={ref}
		className={cn("-mx-1 my-1 h-px bg-border", className)}
	/>
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

// ==================
// DropdownMenu Shortcut
// ==================

const DropdownMenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
	<span
		className={cn(
			"ml-auto text-xs tracking-widest text-muted-foreground",
			className,
		)}
		{...props}
	/>
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
};

export type {
	DropdownMenuProps,
	DropdownMenuTriggerProps,
	DropdownMenuContentProps,
	DropdownMenuItemProps,
	DropdownMenuCheckboxItemProps,
	DropdownMenuRadioItemProps,
	DropdownMenuLabelProps,
	DropdownMenuSeparatorProps,
	DropdownMenuGroupProps,
	DropdownMenuSubProps,
	DropdownMenuSubTriggerProps,
	DropdownMenuSubContentProps,
	DropdownMenuRadioGroupProps,
};

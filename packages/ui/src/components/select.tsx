"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, easing } from "../motion/config";
import { cn } from "../utils";

// Create motion-enhanced div
const MotionDiv = motion.create("div");

// ==================
// Select Root
// ==================

interface SelectProps {
	/** Controlled value */
	value?: string;
	/** Default value (uncontrolled) */
	defaultValue?: string;
	/** Handler fired when value changes */
	onValueChange?: (value: string) => void;
	/** Whether the select is disabled */
	disabled?: boolean;
	/** Whether the select is required */
	required?: boolean;
	/** Name for form submission */
	name?: string;
	/** Children */
	children?: React.ReactNode;
}

function Select({
	value,
	defaultValue,
	onValueChange,
	disabled,
	required,
	name,
	children,
}: SelectProps) {
	// Wrap onValueChange to handle null values
	const handleValueChange = onValueChange
		? (newValue: string | null) => {
				if (newValue !== null) {
					onValueChange(newValue);
				}
			}
		: undefined;

	return (
		<BaseSelect.Root
			value={value}
			defaultValue={defaultValue}
			onValueChange={handleValueChange}
			disabled={disabled}
			required={required}
			name={name}
		>
			{children}
		</BaseSelect.Root>
	);
}

// ==================
// Select Group
// ==================

interface SelectGroupProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const SelectGroup = forwardRef<HTMLDivElement, SelectGroupProps>(
	({ className, children }, ref) => (
		<BaseSelect.Group ref={ref} className={className}>
			{children}
		</BaseSelect.Group>
	),
);
SelectGroup.displayName = "SelectGroup";

// ==================
// Select Value
// ==================

interface SelectValueProps {
	/** Placeholder text when no value is selected */
	placeholder?: string;
	/** Additional CSS classes */
	className?: string;
}

const SelectValue = forwardRef<HTMLSpanElement, SelectValueProps>(
	({ placeholder, className }, ref) => (
		<BaseSelect.Value
			ref={ref}
			placeholder={placeholder}
			className={className}
		/>
	),
);
SelectValue.displayName = "SelectValue";

// ==================
// Select Trigger
// ==================

interface SelectTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** ID for label association */
	id?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
	({ className, children, id }, ref) => (
		<BaseSelect.Trigger
			ref={ref}
			id={id}
			className={cn(
				// h-11 = 44px minimum touch target (WCAG 2.1 AA)
				"flex h-11 w-full items-center justify-between rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm",
				"ring-offset-background transition-colors",
				"hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"[&>span]:line-clamp-1",
				className,
			)}
		>
			{children}
			<BaseSelect.Icon>
				<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
			</BaseSelect.Icon>
		</BaseSelect.Trigger>
	),
);
SelectTrigger.displayName = "SelectTrigger";

// ==================
// Select Scroll Buttons
// ==================

interface SelectScrollButtonProps {
	/** Additional CSS classes */
	className?: string;
}

const SelectScrollUpButton = forwardRef<
	HTMLDivElement,
	SelectScrollButtonProps
>(({ className }, ref) => (
	<BaseSelect.ScrollUpArrow
		ref={ref}
		className={cn(
			"flex cursor-default items-center justify-center py-1",
			className,
		)}
	>
		<ChevronUp className="h-4 w-4" />
	</BaseSelect.ScrollUpArrow>
));
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = forwardRef<
	HTMLDivElement,
	SelectScrollButtonProps
>(({ className }, ref) => (
	<BaseSelect.ScrollDownArrow
		ref={ref}
		className={cn(
			"flex cursor-default items-center justify-center py-1",
			className,
		)}
	>
		<ChevronDown className="h-4 w-4" />
	</BaseSelect.ScrollDownArrow>
));
SelectScrollDownButton.displayName = "SelectScrollDownButton";

// ==================
// Select Content
// ==================

interface SelectContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Position relative to trigger */
	position?: "item-aligned" | "popper";
	/** Side */
	side?: "top" | "right" | "bottom" | "left";
	/** Side offset */
	sideOffset?: number;
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
	(
		{
			className,
			children,
			position = "popper",
			side = "bottom",
			sideOffset = 4,
		},
		ref,
	) => (
		<BaseSelect.Portal>
			<BaseSelect.Positioner side={side} sideOffset={sideOffset}>
				<BaseSelect.Popup
					ref={ref}
					className={cn(
						"relative z-popover max-h-80 min-w-[8rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg",
						className,
					)}
				>
					<MotionDiv
						initial={{ opacity: 0, scale: 0.95, y: -4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={{ duration: duration.fast, ease: easing.easeOut }}
					>
						<SelectScrollUpButton />
						<div className="p-1">{children}</div>
						<SelectScrollDownButton />
					</MotionDiv>
				</BaseSelect.Popup>
			</BaseSelect.Positioner>
		</BaseSelect.Portal>
	),
);
SelectContent.displayName = "SelectContent";

// ==================
// Select Label
// ==================

interface SelectLabelProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const SelectLabel = forwardRef<HTMLDivElement, SelectLabelProps>(
	({ className, children }, ref) => (
		<BaseSelect.GroupLabel
			ref={ref}
			className={cn("px-2 py-1.5 text-sm font-semibold", className)}
		>
			{children}
		</BaseSelect.GroupLabel>
	),
);
SelectLabel.displayName = "SelectLabel";

// ==================
// Select Item
// ==================

interface SelectItemProps {
	/** Value of the item */
	value: string;
	/** Whether the item is disabled */
	disabled?: boolean;
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
	({ className, children, value, disabled }, ref) => (
		<BaseSelect.Item
			ref={ref}
			value={value}
			disabled={disabled}
			className={cn(
				// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
				"relative flex w-full cursor-default select-none items-center rounded-md min-h-11 py-2 pl-8 pr-2 text-sm outline-none",
				"focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				className,
			)}
		>
			<BaseSelect.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center">
				<Check className="h-4 w-4" />
			</BaseSelect.ItemIndicator>
			<BaseSelect.ItemText>{children}</BaseSelect.ItemText>
		</BaseSelect.Item>
	),
);
SelectItem.displayName = "SelectItem";

// ==================
// Select Separator
// ==================

interface SelectSeparatorProps {
	/** Additional CSS classes */
	className?: string;
}

const SelectSeparator = forwardRef<HTMLDivElement, SelectSeparatorProps>(
	({ className }, ref) => (
		<BaseSelect.Separator
			ref={ref}
			className={cn("-mx-1 my-1 h-px bg-border", className)}
		/>
	),
);
SelectSeparator.displayName = "SelectSeparator";

// ==================
// Simple Select (Convenience Component)
// ==================

type SimpleSelectProps = {
	value: string;
	onValueChange: (value: string) => void;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
};

function SimpleSelect({
	value,
	onValueChange,
	options,
	placeholder = "Select...",
	disabled,
	className,
}: SimpleSelectProps) {
	return (
		<Select value={value} onValueChange={onValueChange} disabled={disabled}>
			<SelectTrigger className={className}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export {
	Select,
	SelectGroup,
	SelectValue,
	SelectTrigger,
	SelectContent,
	SelectLabel,
	SelectItem,
	SelectSeparator,
	SelectScrollUpButton,
	SelectScrollDownButton,
	SimpleSelect,
};

export type {
	SelectProps,
	SelectGroupProps,
	SelectValueProps,
	SelectTriggerProps,
	SelectContentProps,
	SelectLabelProps,
	SelectItemProps,
	SelectSeparatorProps,
	SimpleSelectProps,
};

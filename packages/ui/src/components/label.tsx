"use client";

import { Field as BaseField } from "@base-ui/react/field";
import { forwardRef } from "react";
import { cn } from "../utils";

// ==================
// Label
// ==================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
	/** Additional CSS classes */
	className?: string;
	/** Children */
	children?: React.ReactNode;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
	({ className, children, ...props }, ref) => (
		<BaseField.Label
			ref={ref}
			className={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		>
			{children}
		</BaseField.Label>
	),
);
Label.displayName = "Label";

export { Label };

export type { LabelProps };

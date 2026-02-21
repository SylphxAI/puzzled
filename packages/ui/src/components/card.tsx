/**
 * @sylphx/ui - Card Components
 *
 * Flexible card container components for grouping related content.
 * Includes header, title, description, content, and footer sub-components.
 *
 * @example
 * ```tsx
 * import {
 *   Card,
 *   CardHeader,
 *   CardTitle,
 *   CardDescription,
 *   CardContent,
 *   CardFooter
 * } from '@sylphx/ui'
 *
 * // Basic card
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Account Settings</CardTitle>
 *     <CardDescription>Manage your account preferences</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card content goes here...</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Save Changes</Button>
 *   </CardFooter>
 * </Card>
 *
 * // Simple card
 * <Card className="p-6">
 *   <h3>Quick card content</h3>
 * </Card>
 * ```
 *
 * @module @sylphx/ui/card
 */

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../utils";

/**
 * Main card container component.
 *
 * Features:
 * - Rounded corners (16px) with subtle shadow
 * - Hover shadow effect for interactivity
 * - Responsive padding in sub-components
 * - Brand-consistent styling
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardContent>Content</CardContent>
 * </Card>
 * ```
 */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				// Playful roundness (16px) with brand-tinted shadows - Puzzled signature look
				"rounded-2xl border bg-card text-card-foreground",
				"shadow-[var(--shadow-card)] transition-all duration-200",
				"hover:shadow-[var(--shadow-card-hover)]",
				className,
			)}
			{...props}
		/>
	),
);
Card.displayName = "Card";

/**
 * Card header section for title and description.
 *
 * @example
 * ```tsx
 * <CardHeader>
 *   <CardTitle>Title</CardTitle>
 *   <CardDescription>Description</CardDescription>
 * </CardHeader>
 * ```
 */
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
			{...props}
		/>
	),
);
CardHeader.displayName = "CardHeader";

/**
 * Card title component.
 * Renders as an h3 element with proper semantic markup.
 *
 * @example
 * ```tsx
 * <CardTitle>Settings</CardTitle>
 * ```
 */
const CardTitle = forwardRef<
	HTMLParagraphElement,
	HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"text-base font-semibold leading-none tracking-tight sm:text-lg",
			className,
		)}
		{...props}
	/>
));
CardTitle.displayName = "CardTitle";

/**
 * Card description component for supporting text.
 *
 * @example
 * ```tsx
 * <CardDescription>
 *   Manage your notification preferences
 * </CardDescription>
 * ```
 */
const CardDescription = forwardRef<
	HTMLParagraphElement,
	HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-sm text-muted-foreground", className)}
		{...props}
	/>
));
CardDescription.displayName = "CardDescription";

/**
 * Card content container.
 * Has no top padding to flow after CardHeader.
 *
 * @example
 * ```tsx
 * <CardContent>
 *   <form>...</form>
 * </CardContent>
 * ```
 */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("p-4 pt-0 sm:p-6 sm:pt-0", className)}
			{...props}
		/>
	),
);
CardContent.displayName = "CardContent";

/**
 * Card footer for actions.
 * Displays items in a flex row.
 *
 * @example
 * ```tsx
 * <CardFooter>
 *   <Button variant="outline">Cancel</Button>
 *   <Button>Save</Button>
 * </CardFooter>
 * ```
 */
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex items-center p-4 pt-0 sm:p-6 sm:pt-0", className)}
			{...props}
		/>
	),
);
CardFooter.displayName = "CardFooter";

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
};

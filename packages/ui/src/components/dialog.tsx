"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { duration, easing } from "../motion/config";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { cn } from "../utils";

// ==================
// Dialog Root
// ==================

interface DialogProps {
	/** Whether the dialog is open (controlled) */
	open?: boolean;
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean;
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Whether the dialog is modal */
	modal?: boolean | "trap-focus";
	/** Children */
	children?: React.ReactNode;
}

function Dialog({
	open,
	defaultOpen,
	onOpenChange,
	modal = true,
	children,
}: DialogProps) {
	return (
		<BaseDialog.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			modal={modal}
		>
			{children}
		</BaseDialog.Root>
	);
}

// ==================
// Dialog Trigger
// ==================

interface DialogTriggerProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to render as child */
	asChild?: boolean;
}

const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
	({ className, children, asChild }, ref) => (
		<BaseDialog.Trigger
			ref={ref}
			className={className}
			render={asChild ? (children as React.ReactElement) : undefined}
		>
			{asChild ? undefined : children}
		</BaseDialog.Trigger>
	),
);
DialogTrigger.displayName = "DialogTrigger";

// ==================
// Dialog Portal
// ==================

function DialogPortal({ children }: { children: React.ReactNode }) {
	return <BaseDialog.Portal keepMounted={false}>{children}</BaseDialog.Portal>;
}

// ==================
// Dialog Overlay (Backdrop)
// ==================

const MotionBackdrop = motion.create("div");

interface DialogOverlayProps {
	/** Additional CSS classes */
	className?: string;
}

const DialogOverlay = forwardRef<HTMLDivElement, DialogOverlayProps>(
	({ className }, ref) => {
		const prefersReduced = useReducedMotion();

		return (
			<BaseDialog.Backdrop
				ref={ref}
				className={cn("fixed inset-0 z-modal", className)}
			>
				<MotionBackdrop
					initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={prefersReduced ? { opacity: 0 } : { opacity: 0 }}
					transition={
						prefersReduced
							? { duration: 0 }
							: { duration: duration.normal, ease: easing.easeOut }
					}
					className="absolute inset-0 bg-black/50"
				/>
			</BaseDialog.Backdrop>
		);
	},
);
DialogOverlay.displayName = "DialogOverlay";

// ==================
// Dialog Close
// ==================

interface DialogCloseProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Accessible label */
	"aria-label"?: string;
}

const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
	({ className, children, "aria-label": ariaLabel }, ref) => (
		<BaseDialog.Close ref={ref} className={className} aria-label={ariaLabel}>
			{children}
		</BaseDialog.Close>
	),
);
DialogClose.displayName = "DialogClose";

// ==================
// Dialog Content (Popup)
// ==================

const MotionContent = motion.create("div");

interface DialogContentProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
	/** Whether to hide the default close button */
	hideCloseButton?: boolean;
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, hideCloseButton }, ref) => {
		const prefersReduced = useReducedMotion();

		return (
			<DialogPortal>
				<DialogOverlay />
				<BaseDialog.Popup
					ref={ref}
					className={cn(
						"fixed left-1/2 top-1/2 z-modal max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-card shadow-lg",
						className,
					)}
				>
					<MotionContent
						initial={
							prefersReduced
								? { opacity: 1 }
								: { opacity: 0, scale: 0.95, y: -10 }
						}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={
							prefersReduced
								? { duration: 0 }
								: {
										type: "spring",
										stiffness: 400,
										damping: 30,
									}
						}
						className="max-h-[90vh] overflow-auto"
					>
						{children}
						{!hideCloseButton && (
							<BaseDialog.Close
								className={cn(
									// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
									"absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity",
									"hover:bg-muted hover:opacity-100",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									"disabled:pointer-events-none",
								)}
								aria-label="Close dialog"
							>
								<X className="h-4 w-4" aria-hidden="true" />
							</BaseDialog.Close>
						)}
					</MotionContent>
				</BaseDialog.Popup>
			</DialogPortal>
		);
	},
);
DialogContent.displayName = "DialogContent";

// ==================
// Dialog Header
// ==================

function DialogHeader({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex flex-col space-y-1.5 p-6 pb-0", className)}
			{...props}
		/>
	);
}
DialogHeader.displayName = "DialogHeader";

// ==================
// Dialog Footer
// ==================

function DialogFooter({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex justify-end gap-2 p-6 pt-4", className)}
			{...props}
		/>
	);
}
DialogFooter.displayName = "DialogFooter";

// ==================
// Dialog Title
// ==================

interface DialogTitleProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
	({ className, children }, ref) => (
		<BaseDialog.Title
			ref={ref}
			className={cn("text-lg font-semibold", className)}
		>
			{children}
		</BaseDialog.Title>
	),
);
DialogTitle.displayName = "DialogTitle";

// ==================
// Dialog Description
// ==================

interface DialogDescriptionProps {
	/** Children */
	children?: React.ReactNode;
	/** Additional CSS classes */
	className?: string;
}

const DialogDescription = forwardRef<
	HTMLParagraphElement,
	DialogDescriptionProps
>(({ className, children }, ref) => (
	<BaseDialog.Description
		ref={ref}
		className={cn("text-sm text-muted-foreground", className)}
	>
		{children}
	</BaseDialog.Description>
));
DialogDescription.displayName = "DialogDescription";

// ==================
// Dialog Body
// ==================

function DialogBody({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6 pt-4", className)} {...props} />;
}
DialogBody.displayName = "DialogBody";

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
	DialogBody,
};

export type {
	DialogProps,
	DialogTriggerProps,
	DialogOverlayProps,
	DialogCloseProps,
	DialogContentProps,
	DialogTitleProps,
	DialogDescriptionProps,
};

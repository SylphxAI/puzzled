/**
 * @sylphx/ui - InlineEditable Component
 *
 * A click-to-edit component supporting multiple input types with
 * visual feedback for loading, success, and error states.
 *
 * @example
 * ```tsx
 * import { InlineEditable } from '@sylphx/ui'
 *
 * // Basic text editing
 * <InlineEditable
 *   value={name}
 *   onSave={async (value) => await updateName(value)}
 *   type="text"
 *   placeholder="Enter name..."
 * />
 *
 * // Select dropdown
 * <InlineEditable
 *   value={status}
 *   onSave={async (value) => await updateStatus(value)}
 *   type="select"
 *   options={[
 *     { label: 'Active', value: 'active' },
 *     { label: 'Inactive', value: 'inactive' },
 *   ]}
 * />
 *
 * // Boolean switch
 * <InlineEditable
 *   value={enabled}
 *   onSave={async (value) => await updateEnabled(value)}
 *   type="switch"
 * />
 *
 * // With validation
 * <InlineEditable
 *   value={email}
 *   onSave={async (value) => await updateEmail(value)}
 *   type="text"
 *   validate={(value) => {
 *     if (!value.includes('@')) return 'Invalid email address'
 *     return null
 *   }}
 * />
 * ```
 *
 * @module @sylphx/ui/inline-editable
 */

"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { duration, easing } from "../motion/config";
import { cn } from "../utils";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { Switch } from "./switch";

// ============================================================================
// Types
// ============================================================================

interface BaseProps {
	/** Placeholder text for empty values */
	placeholder?: string;
	/** Disable editing */
	disabled?: boolean;
	/** Additional class name for the container */
	className?: string;
	/** Label for accessibility */
	label?: string;
}

export interface InlineEditableTextProps extends BaseProps {
	type: "text";
	value: string;
	onSave: (value: string) => Promise<void>;
	renderValue?: (value: string) => ReactNode;
	validate?: (value: string) => string | null;
	options?: never;
}

export interface InlineEditableTextareaProps extends BaseProps {
	type: "textarea";
	value: string;
	onSave: (value: string) => Promise<void>;
	renderValue?: (value: string) => ReactNode;
	validate?: (value: string) => string | null;
	options?: never;
}

export interface InlineEditableNumberProps extends BaseProps {
	type: "number";
	value: number;
	onSave: (value: number) => Promise<void>;
	renderValue?: (value: number) => ReactNode;
	validate?: (value: number) => string | null;
	options?: never;
}

export interface InlineEditableSelectProps extends BaseProps {
	type: "select";
	value: string;
	onSave: (value: string) => Promise<void>;
	options: Array<{ label: string; value: string }>;
	renderValue?: (value: string) => ReactNode;
	validate?: (value: string) => string | null;
}

export interface InlineEditableSwitchProps extends BaseProps {
	type: "switch";
	value: boolean;
	onSave: (value: boolean) => Promise<void>;
	renderValue?: (value: boolean) => ReactNode;
	validate?: (value: boolean) => string | null;
	options?: never;
}

export type InlineEditableProps =
	| InlineEditableTextProps
	| InlineEditableTextareaProps
	| InlineEditableNumberProps
	| InlineEditableSelectProps
	| InlineEditableSwitchProps;

// ============================================================================
// State Types
// ============================================================================

type EditState = "idle" | "editing" | "saving" | "success" | "error";

// ============================================================================
// Animation Constants
// ============================================================================

const iconTransition = {
	duration: duration.fast,
	ease: easing.easeOut,
};

const successDuration = 1500; // ms to show success state

// ============================================================================
// Text/Textarea/Number Editor Component
// ============================================================================

interface TextEditorProps {
	type: "text" | "textarea" | "number";
	value: string | number;
	initialValue: string | number;
	onSave: (value: string | number) => Promise<void>;
	validate?: (value: string | number) => string | null;
	renderValue?: (value: string | number) => ReactNode;
	placeholder: string;
	disabled: boolean;
	className?: string;
	label?: string;
}

function TextEditor({
	type,
	value,
	initialValue,
	onSave,
	validate,
	renderValue,
	placeholder,
	disabled,
	className,
	label,
}: TextEditorProps) {
	const [state, setState] = useState<EditState>("idle");
	const [editValue, setEditValue] = useState<string | number>(initialValue);
	const [error, setError] = useState<string | null>(null);
	const [isHovered, setIsHovered] = useState(false);

	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const id = useId();

	// Sync external value changes when not editing
	useEffect(() => {
		if (state === "idle") {
			setEditValue(value);
		}
	}, [value, state]);

	// Focus input when entering edit mode
	useEffect(() => {
		if (state === "editing" && inputRef.current) {
			inputRef.current.focus();
			if (type === "text" || type === "number") {
				inputRef.current.select();
			}
		}
	}, [state, type]);

	// Clear success state after delay
	useEffect(() => {
		if (state === "success") {
			const timer = setTimeout(() => {
				setState("idle");
			}, successDuration);
			return () => clearTimeout(timer);
		}
	}, [state]);

	const startEditing = useCallback(() => {
		if (disabled || state !== "idle") return;
		setEditValue(value);
		setError(null);
		setState("editing");
	}, [disabled, state, value]);

	const cancelEditing = useCallback(() => {
		setEditValue(value);
		setError(null);
		setState("idle");
	}, [value]);

	const saveValue = useCallback(async () => {
		if (validate) {
			const validationError = validate(editValue);
			if (validationError) {
				setError(validationError);
				setState("error");
				return;
			}
		}

		if (editValue === value) {
			setState("idle");
			return;
		}

		setState("saving");
		setError(null);

		try {
			await onSave(editValue);
			setState("success");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to save";
			setError(message);
			setState("error");
		}
	}, [editValue, value, validate, onSave]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				cancelEditing();
			} else if (e.key === "Enter" && type !== "textarea") {
				e.preventDefault();
				saveValue();
			} else if (e.key === "Enter" && e.metaKey && type === "textarea") {
				e.preventDefault();
				saveValue();
			}
		},
		[cancelEditing, saveValue, type],
	);

	// Handle click outside to cancel editing
	useEffect(() => {
		if (state !== "editing") return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				cancelEditing();
			}
		};

		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
		}, 0);

		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [state, cancelEditing]);

	const displayValue = (): ReactNode => {
		if (renderValue) {
			return renderValue(value);
		}
		if (type === "number") {
			return value?.toString() ?? placeholder;
		}
		const stringValue = value as string;
		return (
			stringValue || (
				<span className="text-muted-foreground">{placeholder}</span>
			)
		);
	};

	const renderStatusIcon = () => (
		<AnimatePresence mode="wait">
			{state === "saving" && (
				<motion.span
					key="saving"
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.8 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</motion.span>
			)}
			{state === "success" && (
				<motion.span
					key="success"
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.5 }}
					transition={{ type: "spring", stiffness: 400, damping: 15 }}
					className="inline-flex text-success"
				>
					<Check className="h-4 w-4" />
				</motion.span>
			)}
			{(state === "idle" || state === "error") && isHovered && !disabled && (
				<motion.span
					key="edit"
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.6 }}
					exit={{ opacity: 0 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
				</motion.span>
			)}
		</AnimatePresence>
	);

	return (
		<div
			ref={containerRef}
			className={cn(
				"group relative inline-flex items-center gap-1.5",
				disabled && "opacity-60 cursor-not-allowed",
				className,
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<AnimatePresence mode="wait">
				{state === "editing" || state === "saving" || state === "error" ? (
					<motion.div
						key="editing"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={iconTransition}
						className="flex items-center gap-1.5"
					>
						{type === "textarea" ? (
							<textarea
								ref={inputRef as React.RefObject<HTMLTextAreaElement>}
								id={id}
								value={editValue as string}
								onChange={(e) => setEditValue(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={state === "saving"}
								placeholder={placeholder}
								rows={3}
								className={cn(
									"min-h-[80px] min-w-[200px] rounded-md border bg-background px-2 py-1.5 text-sm",
									"placeholder:text-muted-foreground",
									"focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
									"disabled:opacity-50",
									state === "error" && "border-error focus:ring-error/50",
								)}
								aria-label={label}
								aria-invalid={state === "error"}
								aria-describedby={error ? `${id}-error` : undefined}
							/>
						) : (
							<input
								ref={inputRef as React.RefObject<HTMLInputElement>}
								id={id}
								type={type === "number" ? "number" : "text"}
								value={editValue}
								onChange={(e) => {
									if (type === "number") {
										setEditValue(e.target.valueAsNumber);
									} else {
										setEditValue(e.target.value);
									}
								}}
								onKeyDown={handleKeyDown}
								disabled={state === "saving"}
								placeholder={placeholder}
								className={cn(
									"h-8 min-w-[120px] rounded-md border bg-background px-2 py-1 text-sm",
									"placeholder:text-muted-foreground",
									"focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
									"disabled:opacity-50",
									state === "error" && "border-error focus:ring-error/50",
								)}
								aria-label={label}
								aria-invalid={state === "error"}
								aria-describedby={error ? `${id}-error` : undefined}
							/>
						)}

						<div className="flex items-center gap-0.5">
							<button
								type="button"
								onClick={saveValue}
								disabled={state === "saving"}
								className={cn(
									"inline-flex h-8 w-8 items-center justify-center rounded-md",
									"text-muted-foreground hover:text-foreground hover:bg-muted/50",
									"focus:outline-none focus:ring-2 focus:ring-primary/50",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									"transition-colors",
								)}
								aria-label="Save"
							>
								{state === "saving" ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Check className="h-4 w-4" />
								)}
							</button>
							<button
								type="button"
								onClick={cancelEditing}
								disabled={state === "saving"}
								className={cn(
									"inline-flex h-8 w-8 items-center justify-center rounded-md",
									"text-muted-foreground hover:text-foreground hover:bg-muted/50",
									"focus:outline-none focus:ring-2 focus:ring-primary/50",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									"transition-colors",
								)}
								aria-label="Cancel"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</motion.div>
				) : (
					<motion.button
						key="display"
						type="button"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={iconTransition}
						onClick={startEditing}
						disabled={disabled}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-left",
							"transition-colors",
							!disabled && "hover:bg-muted/50 cursor-pointer",
							disabled && "cursor-not-allowed",
						)}
						aria-label={
							label ?? `Edit ${type === "number" ? "number" : "text"}`
						}
					>
						<span className="min-w-0">{displayValue()}</span>
						{renderStatusIcon()}
					</motion.button>
				)}
			</AnimatePresence>

			{error && state === "error" && (
				<motion.span
					id={`${id}-error`}
					initial={{ opacity: 0, y: -4 }}
					animate={{ opacity: 1, y: 0 }}
					className="absolute left-0 top-full mt-1 text-xs text-error"
					role="alert"
				>
					{error}
				</motion.span>
			)}
		</div>
	);
}

// ============================================================================
// Switch Editor Component
// ============================================================================

interface SwitchEditorProps {
	value: boolean;
	onSave: (value: boolean) => Promise<void>;
	validate?: (value: boolean) => string | null;
	disabled: boolean;
	className?: string;
	label?: string;
}

function SwitchEditor({
	value,
	onSave,
	validate,
	disabled,
	className,
	label,
}: SwitchEditorProps) {
	const [state, setState] = useState<EditState>("idle");
	const [editValue, setEditValue] = useState(value);
	const [error, setError] = useState<string | null>(null);
	const [isHovered, setIsHovered] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);
	const id = useId();

	useEffect(() => {
		if (state === "idle") {
			setEditValue(value);
		}
	}, [value, state]);

	useEffect(() => {
		if (state === "success") {
			const timer = setTimeout(() => {
				setState("idle");
			}, successDuration);
			return () => clearTimeout(timer);
		}
	}, [state]);

	const handleSwitchChange = useCallback(
		async (checked: boolean) => {
			if (disabled) return;

			if (validate) {
				const validationError = validate(checked);
				if (validationError) {
					setError(validationError);
					setState("error");
					return;
				}
			}

			setEditValue(checked);
			setState("saving");
			setError(null);

			try {
				await onSave(checked);
				setState("success");
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to save";
				setError(message);
				setState("error");
				setEditValue(value);
			}
		},
		[disabled, validate, onSave, value],
	);

	const renderStatusIcon = () => (
		<AnimatePresence mode="wait">
			{state === "saving" && (
				<motion.span
					key="saving"
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.8 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</motion.span>
			)}
			{state === "success" && (
				<motion.span
					key="success"
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.5 }}
					transition={{ type: "spring", stiffness: 400, damping: 15 }}
					className="inline-flex text-success"
				>
					<Check className="h-4 w-4" />
				</motion.span>
			)}
			{(state === "idle" || state === "error") && isHovered && !disabled && (
				<motion.span
					key="edit"
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.6 }}
					exit={{ opacity: 0 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
				</motion.span>
			)}
		</AnimatePresence>
	);

	return (
		<div
			ref={containerRef}
			className={cn(
				"inline-flex items-center gap-2",
				disabled && "opacity-60 cursor-not-allowed",
				className,
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<Switch
				id={id}
				checked={editValue}
				onCheckedChange={handleSwitchChange}
				disabled={disabled || state === "saving"}
				aria-label={label}
			/>
			{renderStatusIcon()}
			{error && state === "error" && (
				<span className="text-sm text-error" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}

// ============================================================================
// Select Editor Component
// ============================================================================

interface SelectEditorProps {
	value: string;
	onSave: (value: string) => Promise<void>;
	options: Array<{ label: string; value: string }>;
	validate?: (value: string) => string | null;
	renderValue?: (value: string) => ReactNode;
	placeholder: string;
	disabled: boolean;
	className?: string;
	label?: string;
}

function SelectEditor({
	value,
	onSave,
	options,
	validate,
	placeholder,
	disabled,
	className,
	label,
}: SelectEditorProps) {
	const [state, setState] = useState<EditState>("idle");
	const [editValue, setEditValue] = useState(value);
	const [error, setError] = useState<string | null>(null);
	const [isHovered, setIsHovered] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (state === "idle") {
			setEditValue(value);
		}
	}, [value, state]);

	useEffect(() => {
		if (state === "success") {
			const timer = setTimeout(() => {
				setState("idle");
			}, successDuration);
			return () => clearTimeout(timer);
		}
	}, [state]);

	const handleSelectChange = useCallback(
		async (newValue: string) => {
			if (disabled) return;

			if (validate) {
				const validationError = validate(newValue);
				if (validationError) {
					setError(validationError);
					setState("error");
					return;
				}
			}

			if (newValue === value) {
				return;
			}

			setEditValue(newValue);
			setState("saving");
			setError(null);

			try {
				await onSave(newValue);
				setState("success");
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to save";
				setError(message);
				setState("error");
				setEditValue(value);
			}
		},
		[disabled, validate, value, onSave],
	);

	const renderStatusIcon = () => (
		<AnimatePresence mode="wait">
			{state === "saving" && (
				<motion.span
					key="saving"
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.8 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</motion.span>
			)}
			{state === "success" && (
				<motion.span
					key="success"
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.5 }}
					transition={{ type: "spring", stiffness: 400, damping: 15 }}
					className="inline-flex text-success"
				>
					<Check className="h-4 w-4" />
				</motion.span>
			)}
			{(state === "idle" || state === "error") && isHovered && !disabled && (
				<motion.span
					key="edit"
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.6 }}
					exit={{ opacity: 0 }}
					transition={iconTransition}
					className="inline-flex"
				>
					<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
				</motion.span>
			)}
		</AnimatePresence>
	);

	return (
		<div
			ref={containerRef}
			className={cn(
				"inline-flex items-center gap-2",
				disabled && "opacity-60 cursor-not-allowed",
				className,
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<Select
				value={editValue}
				onValueChange={handleSelectChange}
				disabled={disabled || state === "saving"}
			>
				<SelectTrigger
					className={cn(
						"h-auto min-h-9 border-transparent bg-transparent px-2 py-1",
						"hover:bg-muted/50 hover:border-border/50",
						"focus:border-primary focus:bg-background",
						state === "error" && "border-error",
					)}
					aria-label={label}
				>
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
			{renderStatusIcon()}
			{error && state === "error" && (
				<span className="text-sm text-error" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}

// ============================================================================
// InlineEditable Component
// ============================================================================

/**
 * InlineEditable - Click-to-edit component with multiple input types
 *
 * Features:
 * - Click-to-edit behavior with pencil icon on hover
 * - Support for text, textarea, select, switch, and number inputs
 * - Keyboard support: Enter to save, Escape to cancel, Tab navigation
 * - Visual feedback: loading spinner, success checkmark, error state
 * - Custom validation support
 * - Custom value rendering
 * - Accessible with proper ARIA attributes
 */
export function InlineEditable(props: InlineEditableProps) {
	const {
		type,
		placeholder = "Click to edit...",
		disabled = false,
		className,
		label,
	} = props;

	if (type === "switch") {
		return (
			<SwitchEditor
				value={props.value}
				onSave={props.onSave}
				validate={props.validate}
				disabled={disabled}
				className={className}
				label={label}
			/>
		);
	}

	if (type === "select") {
		return (
			<SelectEditor
				value={props.value}
				onSave={props.onSave}
				options={props.options}
				validate={props.validate}
				renderValue={props.renderValue}
				placeholder={placeholder}
				disabled={disabled}
				className={className}
				label={label}
			/>
		);
	}

	// Text, textarea, number
	return (
		<TextEditor
			type={type}
			value={props.value}
			initialValue={props.value}
			onSave={props.onSave as (value: string | number) => Promise<void>}
			validate={
				props.validate as
					| ((value: string | number) => string | null)
					| undefined
			}
			renderValue={
				props.renderValue as ((value: string | number) => ReactNode) | undefined
			}
			placeholder={placeholder}
			disabled={disabled}
			className={className}
			label={label}
		/>
	);
}

InlineEditable.displayName = "InlineEditable";

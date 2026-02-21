/**
 * @sylphx/ui - Switch Component
 *
 * Accessible toggle switch built on Base UI primitives.
 * Uses inline styles for checked/unchecked states to avoid
 * Tailwind v4 tree-shaking issues with data-[state=*] utilities.
 *
 * @example
 * ```tsx
 * import { Switch } from '@sylphx/ui'
 *
 * // Basic switch
 * <Switch />
 *
 * // Controlled switch
 * const [enabled, setEnabled] = useState(false)
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 *
 * // With label
 * <Switch label="Dark mode" />
 *
 * // With label and description
 * <Switch
 *   label="Email notifications"
 *   description="Receive emails about account activity"
 * />
 * ```
 *
 * @module @sylphx/ui/switch
 */

"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { forwardRef, useId } from "react";
import { cn } from "../utils";

/**
 * Props for the Switch component.
 */
interface SwitchProps {
	/** Whether the switch is checked (controlled) */
	checked?: boolean;
	/** Default checked state (uncontrolled) */
	defaultChecked?: boolean;
	/** Handler fired when the switch is toggled */
	onCheckedChange?: (checked: boolean) => void;
	/** Whether the switch is disabled */
	disabled?: boolean;
	/** Whether the switch is required */
	required?: boolean;
	/** Name for form submission */
	name?: string;
	/** Value for form submission */
	value?: string;
	/** ID for label association */
	id?: string;
	/** Label text displayed next to the switch */
	label?: string;
	/** Description text displayed below the label */
	description?: string;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Toggle switch component for binary on/off settings.
 *
 * Uses Base UI for accessibility (keyboard, ARIA, focus management).
 * Visual states use CSS custom properties + attribute selectors defined
 * in a <style> tag to avoid Tailwind v4/Turbopack tree-shaking issues.
 */
const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
	(
		{
			className,
			label,
			description,
			id: providedId,
			checked,
			defaultChecked,
			onCheckedChange,
			disabled,
			required,
			name,
			value,
		},
		ref,
	) => {
		const generatedId = useId();
		const id = providedId || generatedId;

		const switchElement = (
			<BaseSwitch.Root
				ref={ref}
				id={id}
				name={name}
				value={value}
				checked={checked}
				defaultChecked={defaultChecked}
				onCheckedChange={onCheckedChange}
				disabled={disabled}
				required={required}
				className={cn("switch-root", className)}
			>
				<BaseSwitch.Thumb className="switch-thumb" />
			</BaseSwitch.Root>
		);

		if (!label && !description) {
			return switchElement;
		}

		return (
			<div className="flex items-center gap-3">
				{switchElement}
				<label htmlFor={id} className="cursor-pointer select-none">
					{label && <span className="text-sm font-medium">{label}</span>}
					{description && (
						<p className="text-sm text-muted-foreground">{description}</p>
					)}
				</label>
			</div>
		);
	},
);

Switch.displayName = "Switch";

export { Switch };
export type { SwitchProps };

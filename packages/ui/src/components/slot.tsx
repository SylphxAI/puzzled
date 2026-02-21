/**
 * @sylphx/ui - Slot Component
 *
 * Merges its props onto its immediate child. Used for polymorphic components
 * that need to pass props to their child element (like Button with asChild).
 *
 * This is a lightweight implementation that replicates @radix-ui/react-slot
 * functionality without the Radix dependency.
 *
 * @example
 * ```tsx
 * // Button renders as child element with merged props
 * <Button asChild>
 *   <a href="/dashboard">Dashboard</a>
 * </Button>
 * ```
 */

import { Children, cloneElement, forwardRef, isValidElement } from "react";

function mergeRefs<T>(
	...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
	return (node) => {
		for (const ref of refs) {
			if (typeof ref === "function") {
				ref(node);
			} else if (ref != null) {
				(ref as React.MutableRefObject<T | null>).current = node;
			}
		}
	};
}

function mergeProps(
	slotProps: Record<string, unknown>,
	childProps: Record<string, unknown>,
): Record<string, unknown> {
	const overrideProps: Record<string, unknown> = { ...childProps };

	for (const propName in childProps) {
		const slotPropValue = slotProps[propName];
		const childPropValue = childProps[propName];

		const isHandler = /^on[A-Z]/.test(propName);

		if (isHandler) {
			// Merge event handlers
			if (slotPropValue && childPropValue) {
				overrideProps[propName] = (...args: unknown[]) => {
					(childPropValue as (...args: unknown[]) => void)(...args);
					(slotPropValue as (...args: unknown[]) => void)(...args);
				};
			} else if (slotPropValue) {
				overrideProps[propName] = slotPropValue;
			}
		} else if (propName === "style") {
			// Merge styles
			overrideProps[propName] = {
				...(slotPropValue as object),
				...(childPropValue as object),
			};
		} else if (propName === "className") {
			// Merge classNames
			overrideProps[propName] = [slotPropValue, childPropValue]
				.filter(Boolean)
				.join(" ");
		}
	}

	return { ...slotProps, ...overrideProps };
}

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
	children?: React.ReactNode;
}

const Slot = forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
	const { children, ...slotProps } = props;
	const childrenArray = Children.toArray(children);
	const child = childrenArray[0];

	if (!isValidElement(child)) {
		return null;
	}

	const childProps = child.props as Record<string, unknown>;
	const childRef = (child as { ref?: React.Ref<unknown> }).ref;

	return cloneElement(child, {
		...mergeProps(slotProps, childProps),
		ref: forwardedRef ? mergeRefs(forwardedRef, childRef) : childRef,
	} as React.Attributes);
});

Slot.displayName = "Slot";

export { Slot };
export type { SlotProps };

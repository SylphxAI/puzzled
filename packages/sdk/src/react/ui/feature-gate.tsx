/**
 * Feature Gate Component
 *
 * Declarative component for showing/hiding content based on feature flags.
 * Supports loading states, fallbacks, and A/B test variants.
 */

"use client";

import {
	type CSSProperties,
	type ReactNode,
	useContext,
	useState,
} from "react";
import { Z_INDEX_CRITICAL_OVERLAY } from "../../constants";
import {
	type FeatureFlag,
	FeatureFlagContext,
	type FlagValue,
	useFeatureFlag,
} from "../feature-flag-hooks";
import type { ThemeVariables } from "./styles";
import { baseStyles, defaultTheme, mergeStyles } from "./styles";

// ============================================
// FeatureGate
// ============================================

export interface FeatureGateProps {
	/** Feature flag key */
	flag: string;
	/** Content to show when flag is enabled */
	children: ReactNode;
	/** Content to show when flag is disabled */
	fallback?: ReactNode;
	/** Content to show while loading */
	loadingFallback?: ReactNode;
	/** Show loading state */
	showLoading?: boolean;
	/** Invert the gate (show children when flag is OFF) */
	invert?: boolean;
	/** Theme variables */
	theme?: ThemeVariables;
}

/**
 * Feature Gate component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FeatureGate flag="new-dashboard">
 *   <NewDashboard />
 * </FeatureGate>
 *
 * // With fallback
 * <FeatureGate
 *   flag="new-checkout"
 *   fallback={<OldCheckout />}
 * >
 *   <NewCheckout />
 * </FeatureGate>
 *
 * // Inverted (show when flag is OFF)
 * <FeatureGate flag="maintenance-mode" invert>
 *   <NormalContent />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
	flag,
	children,
	fallback = null,
	loadingFallback,
	showLoading = false,
	invert = false,
	theme = defaultTheme,
}: FeatureGateProps) {
	const { isEnabled, isLoading } = useFeatureFlag(flag);

	// Show loading state
	if (isLoading && showLoading) {
		if (loadingFallback) {
			return <>{loadingFallback}</>;
		}
		return <FeatureGateLoading theme={theme} />;
	}

	// Determine if gate should be open
	const shouldShow = invert ? !isEnabled : isEnabled;

	if (shouldShow) {
		return <>{children}</>;
	}

	return <>{fallback}</>;
}

// ============================================
// FeatureVariant
// ============================================

export interface FeatureVariantProps {
	/** Feature flag key */
	flag: string;
	/** Map of variant name to component */
	variants: Record<string, ReactNode>;
	/** Default content if no variant matches */
	defaultVariant?: ReactNode;
	/** Content to show while loading */
	loadingFallback?: ReactNode;
	/** Show loading state */
	showLoading?: boolean;
	/** Theme variables */
	theme?: ThemeVariables;
}

/**
 * Feature Variant component for A/B testing
 *
 * @example
 * ```tsx
 * <FeatureVariant
 *   flag="checkout-experiment"
 *   variants={{
 *     control: <OriginalCheckout />,
 *     'variant-a': <NewCheckoutA />,
 *     'variant-b': <NewCheckoutB />,
 *   }}
 *   defaultVariant={<OriginalCheckout />}
 * />
 * ```
 */
export function FeatureVariant({
	flag,
	variants,
	defaultVariant = null,
	loadingFallback,
	showLoading = false,
	theme = defaultTheme,
}: FeatureVariantProps) {
	const { variant, isLoading } = useFeatureFlag(flag);

	// Show loading state
	if (isLoading && showLoading) {
		if (loadingFallback) {
			return <>{loadingFallback}</>;
		}
		return <FeatureGateLoading theme={theme} />;
	}

	// Find matching variant
	if (variant && variant in variants) {
		return <>{variants[variant]}</>;
	}

	return <>{defaultVariant}</>;
}

// ============================================
// FeatureValue
// ============================================

export interface FeatureValueProps<T extends FlagValue = string> {
	/** Feature flag key */
	flag: string;
	/** Render function that receives the flag value */
	children: (value: T, isLoading: boolean) => ReactNode;
	/** Default value if flag not found */
	defaultValue?: T;
}

/**
 * Feature Value component for non-boolean flags
 *
 * @example
 * ```tsx
 * // String value
 * <FeatureValue flag="hero-title" defaultValue="Welcome">
 *   {(title) => <h1>{title}</h1>}
 * </FeatureValue>
 *
 * // Number value
 * <FeatureValue flag="max-items" defaultValue={10}>
 *   {(maxItems) => <ItemList max={maxItems} />}
 * </FeatureValue>
 *
 * // Object value
 * <FeatureValue flag="theme-config" defaultValue={{ primary: '#000' }}>
 *   {(config) => <ThemedComponent colors={config} />}
 * </FeatureValue>
 * ```
 */
export function FeatureValue<T extends FlagValue = string>({
	flag,
	children,
	defaultValue,
}: FeatureValueProps<T>) {
	const { value, isLoading } = useFeatureFlag<T>(flag, { defaultValue });
	return <>{children(value, isLoading)}</>;
}

// ============================================
// Loading Component
// ============================================

function FeatureGateLoading({ theme }: { theme: ThemeVariables }) {
	const styles = baseStyles(theme);

	const containerStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: "1rem",
	};

	return (
		<div style={containerStyle}>
			<span style={styles.spinner} />
		</div>
	);
}

// ============================================
// FlagDevTools
// ============================================

export interface FlagDevToolsProps {
	/** Theme variables */
	theme?: ThemeVariables;
	/** Position on screen */
	position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
	/** Initially collapsed */
	defaultCollapsed?: boolean;
	/** Custom class name */
	className?: string;
}

/**
 * Development tools for feature flags
 * Shows all flags and allows overriding values
 *
 * @example
 * ```tsx
 * // Only show in development
 * {process.env.NODE_ENV === 'development' && (
 *   <FlagDevTools position="bottom-right" />
 * )}
 * ```
 */
export function FlagDevTools({
	theme = defaultTheme,
	position = "bottom-right",
	defaultCollapsed = true,
	className,
}: FlagDevToolsProps) {
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
	const context = useContext(FeatureFlagContext);
	const styles = baseStyles(theme);

	if (!context) {
		return null;
	}

	const { flags, overrides, setOverride, clearOverrides, isLoading } = context;

	const positionStyles: Record<string, CSSProperties> = {
		"bottom-right": { bottom: "1rem", right: "1rem" },
		"bottom-left": { bottom: "1rem", left: "1rem" },
		"top-right": { top: "1rem", right: "1rem" },
		"top-left": { top: "1rem", left: "1rem" },
	};

	const containerStyle: CSSProperties = mergeStyles(
		{
			position: "fixed",
			zIndex: Z_INDEX_CRITICAL_OVERLAY,
			fontFamily: theme.fontFamily,
			fontSize: theme.fontSizeSm,
		},
		positionStyles[position],
	);

	const panelStyle: CSSProperties = mergeStyles(styles.card, {
		width: "320px",
		maxHeight: "400px",
		overflow: "auto",
	});

	const headerStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "0.75rem 1rem",
		borderBottom: `1px solid ${theme.colorBorder}`,
		backgroundColor: theme.colorMuted,
	};

	const flagListStyle: CSSProperties = {
		padding: "0.5rem",
	};

	const flagItemStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "0.5rem",
		borderRadius: theme.borderRadiusSm,
	};

	if (isCollapsed) {
		return (
			<div style={containerStyle} className={className}>
				<button
					type="button"
					onClick={() => setIsCollapsed(false)}
					style={mergeStyles(styles.button, styles.buttonPrimary, {
						padding: "0.5rem 0.75rem",
						fontSize: theme.fontSizeXs,
					})}
				>
					<FlagIcon /> Flags
				</button>
			</div>
		);
	}

	const flagEntries: [string, FeatureFlag][] = Array.from(flags.entries());

	return (
		<div style={containerStyle} className={className}>
			<div style={panelStyle}>
				<div style={headerStyle}>
					<span
						style={{
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
						}}
					>
						<FlagIcon /> Feature Flags
					</span>
					<div style={{ display: "flex", gap: "0.5rem" }}>
						{Object.keys(overrides).length > 0 && (
							<button
								type="button"
								onClick={clearOverrides}
								style={mergeStyles(styles.button, styles.buttonGhost, {
									padding: "0.25rem 0.5rem",
									fontSize: theme.fontSizeXs,
								})}
							>
								Clear
							</button>
						)}
						<button
							type="button"
							onClick={() => setIsCollapsed(true)}
							style={mergeStyles(styles.button, styles.buttonGhost, {
								padding: "0.25rem",
							})}
						>
							<CloseIcon />
						</button>
					</div>
				</div>

				{isLoading ? (
					<div style={{ padding: "2rem", textAlign: "center" }}>
						<span style={styles.spinner} />
					</div>
				) : flagEntries.length === 0 ? (
					<div
						style={{
							padding: "2rem",
							textAlign: "center",
							color: theme.colorMutedForeground,
						}}
					>
						No flags loaded
					</div>
				) : (
					<div style={flagListStyle}>
						{flagEntries.map(([key, flag]) => {
							const hasOverride = key in overrides;
							const currentValue = hasOverride ? overrides[key] : flag.enabled;

							return (
								<div
									key={key}
									style={mergeStyles(flagItemStyle, {
										backgroundColor: hasOverride
											? `${theme.colorWarning}15`
											: "transparent",
									})}
								>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div
											style={{
												fontWeight: 500,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{key}
										</div>
										{flag.variant && (
											<div
												style={{
													fontSize: theme.fontSizeXs,
													color: theme.colorMutedForeground,
												}}
											>
												Variant: {flag.variant}
											</div>
										)}
									</div>
									<Toggle
										checked={Boolean(currentValue)}
										onChange={(checked) => setOverride(key, checked)}
										theme={theme}
									/>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================
// Helper Components
// ============================================

interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	theme: ThemeVariables;
}

function Toggle({ checked, onChange, theme }: ToggleProps) {
	const style: CSSProperties = {
		position: "relative",
		width: "36px",
		height: "20px",
		backgroundColor: checked ? theme.colorPrimary : theme.colorMuted,
		borderRadius: "10px",
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		border: "none",
		padding: 0,
		flexShrink: 0,
	};

	const knobStyle: CSSProperties = {
		position: "absolute",
		top: "2px",
		left: checked ? "18px" : "2px",
		width: "16px",
		height: "16px",
		backgroundColor: "#fff",
		borderRadius: "50%",
		boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
		transition: "left 0.2s ease",
	};

	return (
		<button type="button" onClick={() => onChange(!checked)} style={style}>
			<span style={knobStyle} />
		</button>
	);
}

function FlagIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
			<line x1="4" y1="22" x2="4" y2="15" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

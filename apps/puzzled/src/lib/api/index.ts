/**
 * Puzzled API Module
 *
 * Exports API client, hooks, and provider for use throughout the app.
 */

export type { ApiError as ApiErrorType } from "./client";
// Client
export { ApiError, api } from "./client";

// Hooks
export * from "./hooks";
export { queryKeys } from "./hooks";

// Provider
export { ApiProvider } from "./provider";

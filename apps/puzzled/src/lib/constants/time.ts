/**
 * Time Constants (SSOT)
 *
 * Centralized time calculations to eliminate magic numbers.
 * All durations are in milliseconds unless specified otherwise.
 */

// Base units
const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

// In seconds (for Redis TTLs, etc.)
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const _WEEK_SECONDS = 7 * DAY_SECONDS;

/**
 * Get a Date representing N days ago from now (or from a reference date)
 */
export function daysAgo(days: number, from: Date = new Date()): Date {
	return new Date(from.getTime() - days * DAY_MS);
}

/**
 * Get a Date representing N days from now (or from a reference date)
 */
function _daysFromNow(days: number, from: Date = new Date()): Date {
	return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Get a Date representing N minutes ago from now (or from a reference date)
 */
export function minutesAgo(minutes: number, from: Date = new Date()): Date {
	return new Date(from.getTime() - minutes * MINUTE_MS);
}

/**
 * Get a Date representing N hours ago from now (or from a reference date)
 */
export function hoursAgo(hours: number, from: Date = new Date()): Date {
	return new Date(from.getTime() - hours * HOUR_MS);
}

/**
 * Get a Date representing N hours from now (or from a reference date)
 */
function _hoursFromNow(hours: number, from: Date = new Date()): Date {
	return new Date(from.getTime() + hours * HOUR_MS);
}

/**
 * Convert days to milliseconds
 */
function _daysToMs(days: number): number {
	return days * DAY_MS;
}

/**
 * Convert days to seconds (for TTLs)
 */
function _daysToSeconds(days: number): number {
	return days * DAY_SECONDS;
}

/**
 * Convert hours to seconds (for TTLs)
 */
function _hoursToSeconds(hours: number): number {
	return hours * HOUR_SECONDS;
}

/**
 * Convert minutes to seconds (for TTLs)
 */
function _minutesToSeconds(minutes: number): number {
	return minutes * MINUTE_SECONDS;
}

/**
 * Convert hours to milliseconds
 */
function _hoursToMs(hours: number): number {
	return hours * HOUR_MS;
}

/**
 * Convert minutes to milliseconds
 */
function _minutesToMs(minutes: number): number {
	return minutes * MINUTE_MS;
}

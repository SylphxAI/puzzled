/**
 * Support questions arrive in this order: getting back in, money, the daily
 * habit, access, then data. Every answer is checked against the code that
 * implements it; anything a person must decide points back at the inbox.
 */
export const FAQ_KEYS = [
	'signIn',
	'guest',
	'cancel',
	'afterCancel',
	'refunds',
	'dayStart',
	'streak',
	'accessibility',
	'data',
] as const

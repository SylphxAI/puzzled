import { getTodaysFreeGame } from '@/lib/free-rotation'
import { redirect } from '@/lib/i18n/routing'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/daily`: today's free puzzle. Links from other products (Tryit) land here;
 * the query string (campaign tags) is kept so the landing can be attributed.
 */
export default async function DailyPage({ params, searchParams }: Props) {
	const { locale } = await params
	const query: Record<string, string> = {}
	for (const [key, value] of Object.entries(await searchParams)) {
		const first = Array.isArray(value) ? value[0] : value
		if (first !== undefined) query[key] = first
	}
	redirect({ href: { pathname: `/games/${getTodaysFreeGame()}`, query }, locale })
}

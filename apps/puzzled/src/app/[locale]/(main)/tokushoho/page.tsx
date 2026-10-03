import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { MarketingHero } from '@/features/marketing/components'
import { LegalDocument, type LegalSection } from '@/features/marketing/components/legal-document'
import { COMPANY_PHONE, LEGAL_EMAIL } from '@/lib/config/app'
import { buildPageMetadata } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
}

const TITLE = '特定商取引法に基づく表記'
const LEAD = 'Puzzled Plus の販売条件に関する、特定商取引法に基づく表示です。'

/**
 * Japanese seller disclosure (特定商取引法に基づく表記). It is a Japan-market
 * legal page, so it exists only under /ja and is not part of the translated
 * catalogue or the hreflang sitemap.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params
	return buildPageMetadata({ locale, path: '/tokushoho', title: TITLE, description: LEAD })
}

export default async function TokushohoPage({ params }: Props) {
	const { locale } = await params
	if (locale !== 'ja') notFound()
	setRequestLocale(locale)

	const sections: LegalSection[] = [
		{
			id: 'seller',
			title: '販売業者',
			paragraphs: ['Sylphx Limited(イングランド・ウェールズ登記、会社番号 16438428)'],
		},
		{
			id: 'responsible',
			title: '運営統括責任者',
			paragraphs: [
				'請求があった場合、遅滞なく開示します。下記のメールアドレスまでご連絡ください。',
			],
		},
		{
			id: 'address',
			title: '所在地',
			paragraphs: ['128 City Road, London EC1V 2NX, United Kingdom'],
		},
		{
			id: 'contact',
			title: '連絡先',
			paragraphs: [
				'メールでのお問い合わせを基本とします。電話でのご連絡をご希望の場合は、メールでお知らせください。',
			],
			contactEmail: LEGAL_EMAIL,
			contactPhone: COMPANY_PHONE,
		},
		{
			id: 'price',
			title: '販売価格',
			paragraphs: [
				'料金はお支払い前に、購入ページ(料金ページ)に税込(VAT が適用される場合は含む)で表示されます。',
			],
		},
		{
			id: 'extra',
			title: '商品代金以外の必要料金',
			paragraphs: [
				'インターネット接続にかかる通信料はお客様のご負担となります。そのほかの追加料金はありません。',
			],
		},
		{
			id: 'payment',
			title: 'お支払い方法・時期',
			paragraphs: [
				'クレジットカード等(Stripe 経由)でお支払いいただけます。ご購読時と、毎月または毎年の各更新期間の開始時にお支払いが発生します。',
			],
		},
		{
			id: 'delivery',
			title: '提供時期',
			paragraphs: ['お支払いの完了後、直ちにご利用いただけます。'],
		},
		{
			id: 'cancel',
			title: '返品・キャンセル',
			paragraphs: [
				'デジタルコンテンツの性質上、提供開始後の返品・返金はできません。ただし、法律で定められている場合や、提供したものが正常に動作しなかった場合はこの限りではありません。ご購読の更新は、設定 > サブスクリプションからいつでも停止でき、お支払い済みの期間が終わるまでご利用いただけます。',
			],
		},
		{
			id: 'env',
			title: '動作環境',
			paragraphs: [
				'最新のブラウザを備えたインターネット接続環境で、スマートフォン・タブレット・パソコンからご利用いただけます。',
			],
		},
	]

	return (
		<main className="flex-1">
			<MarketingHero eyebrow="法的情報" title={TITLE} lead={LEAD} />
			<LegalDocument
				locale={locale}
				lastUpdatedLabel="最終更新日"
				tocTitle="目次"
				sections={sections}
			/>
		</main>
	)
}

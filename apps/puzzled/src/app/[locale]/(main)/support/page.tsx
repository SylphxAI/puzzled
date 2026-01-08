import { Clock, FileText, HelpCircle, Mail, MessageSquare } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/config/app'
import { Link } from '@/lib/i18n/routing'
import { Footer, Header } from '@/shared/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'support' })

	return {
		title: t('title'),
		description: t('description'),
	}
}

export default async function SupportPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('support')

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-8">
				<div className="mx-auto w-full max-w-4xl space-y-8">
					{/* Header */}
					<div className="text-center">
						<h1 className="text-3xl font-bold">{t('title')}</h1>
						<p className="mt-2 text-muted-foreground">{t('description')}</p>
					</div>

					{/* Contact Options */}
					<div className="grid gap-6 md:grid-cols-2">
						{/* Email Support */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Mail className="h-5 w-5 text-primary" />
									{t('email.title')}
								</CardTitle>
								<CardDescription>{t('email.description')}</CardDescription>
							</CardHeader>
							<CardContent>
								<a
									href={`mailto:${SUPPORT_EMAIL}`}
									className="inline-flex items-center gap-2 text-primary hover:underline"
								>
									{SUPPORT_EMAIL}
								</a>
								<p className="mt-2 text-sm text-muted-foreground">
									<Clock className="mr-1 inline h-4 w-4" />
									{t('email.responseTime')}
								</p>
							</CardContent>
						</Card>

						{/* FAQ */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HelpCircle className="h-5 w-5 text-primary" />
									{t('faq.title')}
								</CardTitle>
								<CardDescription>{t('faq.description')}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<FAQItem question={t('faq.q1.question')} answer={t('faq.q1.answer')} />
								<FAQItem question={t('faq.q2.question')} answer={t('faq.q2.answer')} />
								<FAQItem question={t('faq.q3.question')} answer={t('faq.q3.answer')} />
							</CardContent>
						</Card>
					</div>

					{/* Additional Resources */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-primary" />
								{t('resources.title')}
							</CardTitle>
							<CardDescription>{t('resources.description')}</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-3">
								<Link
									href="/privacy"
									className="flex items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted"
								>
									<FileText className="h-5 w-5 text-muted-foreground" />
									<span>{t('resources.privacy')}</span>
								</Link>
								<Link
									href="/terms"
									className="flex items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted"
								>
									<FileText className="h-5 w-5 text-muted-foreground" />
									<span>{t('resources.terms')}</span>
								</Link>
								<Link
									href="/pricing"
									className="flex items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted"
								>
									<MessageSquare className="h-5 w-5 text-muted-foreground" />
									<span>{t('resources.pricing')}</span>
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Contact Form Notice */}
					<div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
						<MessageSquare className="mx-auto h-8 w-8 text-primary" />
						<h3 className="mt-2 font-semibold">{t('contact.title')}</h3>
						<p className="mt-1 text-sm text-muted-foreground">{t('contact.description')}</p>
						<a
							href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} Support Request`)}`}
							className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							{t('contact.cta')}
						</a>
					</div>
				</div>
			</main>
			<Footer />
		</>
	)
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
	return (
		<details className="group rounded-lg border p-3">
			<summary className="cursor-pointer font-medium">{question}</summary>
			<p className="mt-2 text-sm text-muted-foreground">{answer}</p>
		</details>
	)
}

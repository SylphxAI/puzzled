import { Check, Crown } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'

/**
 * Evergreen explainer for the catalog: how a Puzzled day works, and what the
 * premium plan adds on top of the free daily module. Rendered on every catalog
 * request, so a visitor who lands here first still learns the ritual.
 */
export async function CatalogExplainer({ gameCount }: { gameCount: number }) {
	const t = await getTranslations('catalog')
	const steps = [1, 2, 3].map((index) => ({
		title: t(`ritual.step${index}Title`),
		body: t(`ritual.step${index}Body`, { count: gameCount }),
	}))
	const premiumItems = [
		t('premiumPanel.item1', { count: gameCount }),
		t('premiumPanel.item2'),
		t('premiumPanel.item3'),
		t('premiumPanel.item4'),
	]

	return (
		<section className="section-block border-t border-border/60">
			<div className="page-shell-wide grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
				<div>
					<h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
						{t('ritual.title')}
					</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground">{t('ritual.body')}</p>

					<ol className="mt-6 space-y-3">
						{steps.map((step, index) => (
							<li
								key={step.title}
								className="flex gap-3.5 rounded-2xl border border-border/70 bg-card p-4"
							>
								<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-extrabold text-primary tnum">
									{index + 1}
								</span>
								<div>
									<h3 className="font-display text-base font-bold">{step.title}</h3>
									<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
								</div>
							</li>
						))}
					</ol>
				</div>

				<div className="surface-ink relative h-fit overflow-hidden rounded-3xl p-6 md:p-8">
					<div
						className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40"
						aria-hidden="true"
					/>
					<div className="relative">
						<p className="chip bg-white/12 text-white">
							<Crown className="h-3 w-3" aria-hidden="true" />
							{t('premiumPanel.eyebrow')}
						</p>
						<h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
							{t('premiumPanel.title')}
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-white/75">{t('premiumPanel.body')}</p>
						<ul className="mt-5 space-y-2.5 text-sm text-white/85">
							{premiumItems.map((item) => (
								<li key={item} className="flex items-start gap-2.5">
									<Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
									<span>{item}</span>
								</li>
							))}
						</ul>
						<Link
							href="/pricing"
							className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 font-semibold text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
						>
							{t('premiumPanel.cta')}
						</Link>
						<p className="mt-3 text-xs leading-relaxed text-white/60">{t('premiumPanel.note')}</p>
					</div>
				</div>
			</div>
		</section>
	)
}

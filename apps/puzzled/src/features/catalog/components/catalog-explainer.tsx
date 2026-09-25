import { getTranslations } from 'next-intl/server'

/**
 * Evergreen explainer for the catalog: how a Puzzled day works. Rendered on
 * every catalog request, so a visitor who lands here first still learns the
 * ritual.
 */
export async function CatalogExplainer({ gameCount }: { gameCount: number }) {
	const t = await getTranslations('catalog')
	const steps = [1, 2, 3].map((index) => ({
		title: t(`ritual.step${index}Title`),
		body: t(`ritual.step${index}Body`, { count: gameCount }),
	}))

	return (
		<section className="section-block border-t border-border/60">
			<div className="page-shell-wide">
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
			</div>
		</section>
	)
}

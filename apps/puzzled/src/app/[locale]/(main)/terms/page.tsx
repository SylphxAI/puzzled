import { LEGAL_EMAIL } from "@/lib/config/app";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("legal.terms");
	return {
		title: t("title"),
	};
}

export default function TermsPage() {
	const t = useTranslations("legal.terms");

	return (
		<div className="flex flex-1 flex-col">
			<div className="border-b px-4 py-3">
				<h1 className="text-lg font-bold">{t("title")}</h1>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-6">
				<div className="mx-auto max-w-2xl space-y-6">
					<p className="text-sm text-muted-foreground">
						{t("lastUpdated")}: December 15, 2024
					</p>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.acceptance.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.acceptance.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.service.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.service.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.accounts.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.accounts.content")}
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t("sections.accounts.items.accurate")}</li>
							<li>{t("sections.accounts.items.secure")}</li>
							<li>{t("sections.accounts.items.responsible")}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.subscription.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.subscription.content")}
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t("sections.subscription.items.billing")}</li>
							<li>{t("sections.subscription.items.cancel")}</li>
							<li>{t("sections.subscription.items.refund")}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.conduct.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.conduct.content")}
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
							<li>{t("sections.conduct.items.legal")}</li>
							<li>{t("sections.conduct.items.respect")}</li>
							<li>{t("sections.conduct.items.noCheat")}</li>
						</ul>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.ip.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.ip.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.disclaimer.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.disclaimer.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.liability.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.liability.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.changes.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.changes.content")}
						</p>
					</section>

					<section>
						<h2 className="text-base font-semibold">
							{t("sections.contact.title")}
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("sections.contact.content")}
						</p>
						<p className="mt-2 text-sm">
							<a
								href={`mailto:${LEGAL_EMAIL}`}
								className="text-primary hover:underline"
							>
								{LEGAL_EMAIL}
							</a>
						</p>
					</section>
				</div>
			</div>
		</div>
	);
}

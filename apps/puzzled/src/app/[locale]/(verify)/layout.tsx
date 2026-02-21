// Force dynamic rendering - verification pages should never be statically generated
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

type Props = {
	children: React.ReactNode;
};

/**
 * Verification pages layout
 *
 * For step-up authentication pages that need to be accessed by
 * logged-in users who haven't completed MFA verification yet.
 *
 * No auth checks here - each page handles its own requirements.
 */
export default function VerifyLayout({ children }: Props) {
	return <>{children}</>;
}

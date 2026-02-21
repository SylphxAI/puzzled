import { getServerBaseUrl } from "@/lib/utils";
import type { MetadataRoute } from "next";

const BASE_URL = getServerBaseUrl();

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/*/checkout/", "/*/success/"],
			},
		],
		sitemap: `${BASE_URL}/sitemap.xml`,
	};
}

//! Canonical links for Money and mail, with both production browser origins.
pub const DEFAULT_PUBLIC_URL: &str = "https://tryit.fun";
const LEGACY_PUBLIC_URL: &str = "https://puzzled.gg";

pub fn parse_public_origin(raw: &str, production: bool) -> Result<String, &'static str> {
    let url = reqwest::Url::parse(raw).map_err(|_| "invalid_public_origin")?;
    let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if (url.scheme() != "https" && !(url.scheme() == "http" && !production && loopback))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || url.host_str().is_none()
    {
        return Err("invalid_public_origin");
    }
    Ok(url.origin().ascii_serialization())
}

pub fn public_origin() -> Result<String, &'static str> {
    let raw = std::env::var("PUZZLED_PUBLIC_URL").unwrap_or_else(|_| DEFAULT_PUBLIC_URL.into());
    parse_public_origin(
        &raw,
        !cfg!(debug_assertions) || std::env::var("NODE_ENV").is_ok_and(|v| v == "production"),
    )
}

pub fn admits_browser(headers: &axum::http::HeaderMap, origin: &str) -> bool {
    let values: Vec<_> = headers.get_all(axum::http::header::ORIGIN).iter().collect();
    if values.len() != 1 {
        return false;
    }
    let Ok(value) = values[0].to_str() else {
        return false;
    };
    // Only the two production hosts share admission during the rebrand. Custom
    // and local deployments still trust exactly their configured origin. This
    // does not admit cross-site fetches or change host-only cookie scope.
    let production_origins = [DEFAULT_PUBLIC_URL, LEGACY_PUBLIC_URL];
    let matches_origin = value == origin
        || (production_origins.contains(&origin) && production_origins.contains(&value));
    if !matches_origin || value.bytes().any(|b| !(33..=126).contains(&b)) || value.contains(',') {
        return false;
    }
    let fetch_sites: Vec<_> = headers.get_all("sec-fetch-site").iter().collect();
    if fetch_sites.len() > 1
        || fetch_sites
            .first()
            .is_some_and(|v| v.as_bytes() != b"same-origin")
    {
        return false;
    }
    headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .next()
                .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("application/json"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn browser_headers(
        origin: &str,
    ) -> Result<axum::http::HeaderMap, axum::http::header::InvalidHeaderValue> {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("origin", origin.parse()?);
        headers.insert("content-type", "application/json; charset=utf-8".parse()?);
        headers.insert("sec-fetch-site", "same-origin".parse()?);
        Ok(headers)
    }

    #[test]
    fn both_production_origins_are_admitted_without_changing_canonical_links(
    ) -> Result<(), Box<dyn std::error::Error>> {
        assert_eq!(DEFAULT_PUBLIC_URL, "https://tryit.fun");
        for configured in [DEFAULT_PUBLIC_URL, LEGACY_PUBLIC_URL] {
            assert_eq!(parse_public_origin(configured, true)?, configured);
            for incoming in [DEFAULT_PUBLIC_URL, LEGACY_PUBLIC_URL] {
                assert!(admits_browser(&browser_headers(incoming)?, configured));
            }
        }
        Ok(())
    }

    #[test]
    fn custom_and_local_deployments_keep_exact_origin_admission(
    ) -> Result<(), Box<dyn std::error::Error>> {
        for configured in ["https://puzzled.test", "http://localhost:3000"] {
            assert_eq!(parse_public_origin(configured, false)?, configured);
            assert!(admits_browser(&browser_headers(configured)?, configured));
            for incoming in [
                DEFAULT_PUBLIC_URL,
                LEGACY_PUBLIC_URL,
                "https://elsewhere.invalid",
            ] {
                assert!(!admits_browser(&browser_headers(incoming)?, configured));
                assert!(!admits_browser(&browser_headers(configured)?, incoming));
            }
        }
        assert!(parse_public_origin("http://localhost:3000", true).is_err());
        Ok(())
    }

    #[test]
    fn production_aliases_do_not_relax_origin_or_fetch_safeguards(
    ) -> Result<(), Box<dyn std::error::Error>> {
        for configured in [DEFAULT_PUBLIC_URL, LEGACY_PUBLIC_URL] {
            for incoming in [
                "null",
                "https://elsewhere.invalid",
                "http://tryit.fun",
                "http://puzzled.gg",
                "https://tryit.fun:8443",
                "https://puzzled.gg:8443",
                "https://www.tryit.fun",
                "https://tryit.fun.evil.invalid",
                "https://tryit.fun/",
                "https://puzzled.gg/",
                "https://TRYIT.FUN",
                "https://puzzled.gg, https://tryit.fun",
                " https://tryit.fun",
            ] {
                assert!(
                    !admits_browser(&browser_headers(incoming)?, configured),
                    "{incoming}"
                );
            }
            for incoming in [DEFAULT_PUBLIC_URL, LEGACY_PUBLIC_URL] {
                let original = browser_headers(incoming)?;
                let mut headers = original.clone();
                headers.append("origin", incoming.parse()?);
                assert!(!admits_browser(&headers, configured));
                headers = original.clone();
                headers.remove("origin");
                headers.insert("host", "tryit.fun".parse()?);
                headers.insert("x-forwarded-host", "puzzled.gg".parse()?);
                assert!(!admits_browser(&headers, configured));
                for site in ["same-site", "cross-site", "none"] {
                    headers = original.clone();
                    headers.insert("sec-fetch-site", site.parse()?);
                    assert!(!admits_browser(&headers, configured));
                }
                headers = original.clone();
                headers.append("sec-fetch-site", "same-origin".parse()?);
                assert!(!admits_browser(&headers, configured));
                headers = original.clone();
                headers.remove("sec-fetch-site");
                assert!(admits_browser(&headers, configured));
                headers = original.clone();
                headers.remove("content-type");
                assert!(!admits_browser(&headers, configured));
                headers.insert("content-type", "text/plain".parse()?);
                assert!(!admits_browser(&headers, configured));
            }
        }
        Ok(())
    }

    #[test]
    fn origin_policy_is_canonical_and_never_uses_request_host() {
        assert_eq!(
            parse_public_origin("https://tryit.fun/", true),
            Ok(DEFAULT_PUBLIC_URL.to_string())
        );
        for value in [
            "http://puzzled.gg",
            "https://user@puzzled.gg",
            "https://puzzled.gg/a",
            "https://puzzled.gg/?a=b",
            "https://puzzled.gg/#x",
        ] {
            assert!(parse_public_origin(value, true).is_err());
        }
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("host", "internal.invalid".parse().unwrap());
        headers.insert("content-type", "application/json".parse().unwrap());
        assert!(!admits_browser(&headers, DEFAULT_PUBLIC_URL));
        headers.insert("origin", DEFAULT_PUBLIC_URL.parse().unwrap());
        assert!(admits_browser(&headers, DEFAULT_PUBLIC_URL));
        headers.append("origin", DEFAULT_PUBLIC_URL.parse().unwrap());
        assert!(!admits_browser(&headers, DEFAULT_PUBLIC_URL));
    }
}

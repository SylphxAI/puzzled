//! The product's one configured public origin, shared by browser and Money.
pub const DEFAULT_PUBLIC_URL: &str = "https://puzzled.gg";

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
    if value != origin || value.bytes().any(|b| !(33..=126).contains(&b)) || value.contains(',') {
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
    #[test]
    fn origin_policy_is_canonical_and_never_uses_request_host() {
        assert_eq!(
            parse_public_origin("https://puzzled.gg/", true).unwrap(),
            DEFAULT_PUBLIC_URL
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

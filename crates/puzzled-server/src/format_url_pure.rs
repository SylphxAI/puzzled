//! Pure format + base-URL residual dual-oracle of
//! `apps/puzzled/src/lib/utils.ts` (`formatNumber`, `getBaseUrl`, `getServerBaseUrl`).
//!
//! Locale `Intl.NumberFormat` full ICU remains FE residual; en-US grouping densed.
//! Window/env host injection for URL resolution. NO authority_rust / ts_deleted.

/// Format integer with en-US thousands separators (dual-oracle of Intl en).
#[must_use]
pub fn format_number_en(num: i64) -> String {
    let neg = num < 0;
    let mut n = num.unsigned_abs();
    if n == 0 {
        return "0".into();
    }
    let mut parts = Vec::new();
    while n > 0 {
        let chunk = n % 1000;
        n /= 1000;
        if n > 0 {
            parts.push(format!("{chunk:03}"));
        } else {
            parts.push(chunk.to_string());
        }
    }
    parts.reverse();
    let body = parts.join(",");
    if neg {
        format!("-{body}")
    } else {
        body
    }
}

/// Host-provided env facts for base URL resolution (no process env read here).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BaseUrlEnv {
    pub next_public_app_url: Option<String>,
    pub vercel_url: Option<String>,
    pub port: Option<String>,
}

/// Resolve absolute server base URL dual-oracle of getServerBaseUrl.
#[must_use]
pub fn get_server_base_url(env: &BaseUrlEnv) -> String {
    if let Some(u) = env
        .next_public_app_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return u.to_owned();
    }
    if let Some(v) = env
        .vercel_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let host = v.strip_prefix("https://").unwrap_or(v);
        return format!("https://{host}");
    }
    "http://localhost:3000".into()
}

/// Resolve getBaseUrl dual-oracle.
/// `in_browser` + `origin` injected by host; mode relative|origin.
#[must_use]
pub fn get_base_url(
    in_browser: bool,
    origin: Option<&str>,
    mode_origin: bool,
    env: &BaseUrlEnv,
) -> String {
    if in_browser {
        if mode_origin {
            return origin.unwrap_or("").to_owned();
        }
        return String::new();
    }
    // SSR/server path: same as getServerBaseUrl but port-aware localhost fallback
    if let Some(u) = env
        .next_public_app_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return u.to_owned();
    }
    if let Some(v) = env
        .vercel_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let host = v.strip_prefix("https://").unwrap_or(v);
        return format!("https://{host}");
    }
    let port = env
        .port
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("3000");
    format!("http://localhost:{port}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_number_en_grouping() {
        assert_eq!(format_number_en(0), "0");
        assert_eq!(format_number_en(12), "12");
        assert_eq!(format_number_en(1234), "1,234");
        assert_eq!(format_number_en(1_000_000), "1,000,000");
        assert_eq!(format_number_en(-42_000), "-42,000");
    }

    #[test]
    fn base_url_resolution() {
        let env = BaseUrlEnv {
            next_public_app_url: Some("https://puzzled.app".into()),
            vercel_url: Some("x.vercel.app".into()),
            port: Some("4000".into()),
        };
        assert_eq!(get_server_base_url(&env), "https://puzzled.app");
        assert_eq!(get_base_url(true, Some("https://o"), false, &env), "");
        assert_eq!(
            get_base_url(true, Some("https://o"), true, &env),
            "https://o"
        );
        assert_eq!(get_base_url(false, None, false, &env), "https://puzzled.app");

        let env2 = BaseUrlEnv {
            next_public_app_url: None,
            vercel_url: Some("idle.vercel.app".into()),
            port: None,
        };
        assert_eq!(get_server_base_url(&env2), "https://idle.vercel.app");

        let env3 = BaseUrlEnv {
            next_public_app_url: None,
            vercel_url: None,
            port: Some("3001".into()),
        };
        assert_eq!(get_base_url(false, None, false, &env3), "http://localhost:3001");
        assert_eq!(get_server_base_url(&env3), "http://localhost:3000");
    }
}

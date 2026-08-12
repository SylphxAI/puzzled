/// Database URL selection mirrors `apps/puzzled/src/lib/db` runtime env (ADR-168 S1).
///
/// On Platform (`SYLPHX=1`), managed Postgres hostnames under `*.sylphx.net` are
/// rewritten to the in-cluster ExternalName service in `sylphx-dns` so free-floor
/// ritual persist does not depend on public DNS/gateway hairpin from the pod
/// (live residual: pool timed out on past-oxen-*.sylphx.net while
/// `pg-*-pooler` was healthy in-cluster).
pub fn select_database_url() -> Option<String> {
    let on_sylphx = std::env::var("SYLPHX")
        .ok()
        .is_some_and(|value| !value.trim().is_empty() && value != "0");

    if on_sylphx {
        if let Ok(url) = std::env::var("POSTGRES_URL") {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(prefer_incluster_managed_host(trimmed));
            }
        }
    }

    for key in ["DATABASE_URL", "POSTGRES_URL"] {
        if let Ok(url) = std::env::var(key) {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(if on_sylphx {
                    prefer_incluster_managed_host(trimmed)
                } else {
                    trimmed.to_string()
                });
            }
        }
    }

    None
}

/// `slug.sylphx.net` → `slug.sylphx-dns.svc.cluster.local` (Platform managed DNS).
///
/// Only rewrites the host label; credentials, path, and query (sslmode) preserved.
#[must_use]
pub fn prefer_incluster_managed_host(url: &str) -> String {
    const SUFFIX: &str = ".sylphx.net";
    // URL form: scheme://[userinfo@]host[:port][/path][?query]
    let Some(scheme_sep) = url.find("://") else {
        return url.to_string();
    };
    let after_scheme = scheme_sep + 3;
    let rest = &url[after_scheme..];
    let (authority, tail) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => match rest.find('?') {
            Some(i) => (&rest[..i], &rest[i..]),
            None => (rest, ""),
        },
    };
    // authority = [userinfo@]host[:port]
    let (userinfo, hostport) = match authority.rfind('@') {
        Some(i) => (&authority[..=i], &authority[i + 1..]),
        None => ("", authority),
    };
    let (host, port) = match hostport.rsplit_once(':') {
        Some((h, p)) if !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) => (h, Some(p)),
        _ => (hostport, None),
    };
    let host_l = host.to_ascii_lowercase();
    if !host_l.ends_with(SUFFIX) {
        return url.to_string();
    }
    let slug = &host_l[..host_l.len() - SUFFIX.len()];
    if slug.is_empty() || slug.contains('.') {
        // Multi-label hosts under sylphx.net are left alone (not the managed slug form).
        return url.to_string();
    }
    let new_host = format!("{slug}.sylphx-dns.svc.cluster.local");
    let mut out = String::with_capacity(url.len() + 32);
    out.push_str(&url[..after_scheme]);
    out.push_str(userinfo);
    out.push_str(&new_host);
    if let Some(p) = port {
        out.push(':');
        out.push_str(p);
    }
    out.push_str(tail);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn env_test_guard() -> MutexGuard<'static, ()> {
        ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    struct EnvRestore {
        keys: Vec<String>,
        values: Vec<Option<String>>,
    }

    impl EnvRestore {
        fn snapshot(keys: &[&str]) -> Self {
            let keys: Vec<String> = keys.iter().map(|key| (*key).to_string()).collect();
            let values = keys.iter().map(|key| std::env::var(key).ok()).collect();
            Self { keys, values }
        }
    }

    impl Drop for EnvRestore {
        fn drop(&mut self) {
            for (key, value) in self.keys.iter().zip(self.values.iter()) {
                match value {
                    Some(value) => std::env::set_var(key, value),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    #[test]
    fn prefers_postgres_url_on_sylphx() {
        let _guard = env_test_guard();
        let _restore = EnvRestore::snapshot(&["SYLPHX", "POSTGRES_URL", "DATABASE_URL"]);
        std::env::set_var("SYLPHX", "1");
        std::env::set_var("POSTGRES_URL", "postgresql://in-cluster/puzzled");
        std::env::set_var("DATABASE_URL", "postgresql://external/puzzled");

        assert_eq!(
            select_database_url().as_deref(),
            Some("postgresql://in-cluster/puzzled")
        );
    }

    #[test]
    fn rewrites_sylphx_net_host_on_platform() {
        let _guard = env_test_guard();
        let _restore = EnvRestore::snapshot(&["SYLPHX", "POSTGRES_URL", "DATABASE_URL"]);
        std::env::set_var("SYLPHX", "1");
        std::env::remove_var("POSTGRES_URL");
        std::env::set_var(
            "DATABASE_URL",
            "postgresql://app:secret@past-oxen-ejfa3h.sylphx.net:5432/app?sslmode=require",
        );
        assert_eq!(
            select_database_url().as_deref(),
            Some(
                "postgresql://app:secret@past-oxen-ejfa3h.sylphx-dns.svc.cluster.local:5432/app?sslmode=require"
            )
        );
    }

    #[test]
    fn prefer_incluster_leaves_non_managed_hosts() {
        assert_eq!(
            prefer_incluster_managed_host("postgresql://u:p@db.example.com:5432/app"),
            "postgresql://u:p@db.example.com:5432/app"
        );
        assert_eq!(
            prefer_incluster_managed_host(
                "postgresql://u:p@past-oxen-ejfa3h.sylphx-dns.svc.cluster.local:5432/app"
            ),
            "postgresql://u:p@past-oxen-ejfa3h.sylphx-dns.svc.cluster.local:5432/app"
        );
    }
}

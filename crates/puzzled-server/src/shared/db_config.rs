/// Database URL selection mirrors `apps/puzzled/src/lib/db` runtime env (ADR-168 S1).
pub fn select_database_url() -> Option<String> {
    let on_sylphx = std::env::var("SYLPHX")
        .ok()
        .is_some_and(|value| !value.trim().is_empty() && value != "0");

    if on_sylphx {
        if let Ok(url) = std::env::var("POSTGRES_URL") {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    for key in ["DATABASE_URL", "POSTGRES_URL"] {
        if let Ok(url) = std::env::var(key) {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
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
}

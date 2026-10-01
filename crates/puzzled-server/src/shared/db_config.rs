use std::future::Future;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgConnection;

const WRITER_PROBE: &str = "SELECT NOT pg_is_in_recovery() AND current_setting('transaction_read_only') = 'off' AS writable";

/// Extend the existing pool, preserving its sizing, startup and acquisition budget.
/// Writer validation is the health round trip; a separate ping is redundant.
/// No statement is replayed if a writer is demoted after checkout.
pub fn writer_pool_options(options: PgPoolOptions) -> PgPoolOptions {
    let budget = options.get_acquire_timeout();
    options
        .test_before_acquire(false)
        .after_connect(move |connection, _| Box::pin(probe_writer(connection, budget)))
        .before_acquire(move |connection, _| {
            Box::pin(async move { Ok(probe_writer(connection, budget).await.is_ok()) })
        })
}

async fn probe_writer(connection: &mut PgConnection, budget: Duration) -> Result<(), sqlx::Error> {
    require_writer(
        sqlx::query_scalar::<_, bool>(WRITER_PROBE).fetch_one(connection),
        budget,
    )
    .await
}

async fn require_writer(
    probe: impl Future<Output = Result<bool, sqlx::Error>>,
    budget: Duration,
) -> Result<(), sqlx::Error> {
    match tokio::time::timeout(budget, probe).await {
        Ok(Ok(true)) => Ok(()),
        Ok(Ok(false)) => Err(sqlx::Error::Protocol(
            "database connection is not writable".into(),
        )),
        Ok(Err(error)) => Err(error),
        Err(_) => Err(sqlx::Error::PoolTimedOut),
    }
}

/// Database URL selection mirrors `apps/puzzled/src/lib/db` runtime env (ADR-168 S1).
///
/// Platform injects `DATABASE_URL` / `POSTGRES_URL` as the product contract
/// (`*.sylphx.net`). This crate consumes that URL as-is. Rewriting to
/// `.svc.cluster.local` is a customer topology leak (ADR-3402).
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

    #[test]
    fn keeps_injected_sylphx_net_host() {
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
            Some("postgresql://app:secret@past-oxen-ejfa3h.sylphx.net:5432/app?sslmode=require")
        );
    }

    #[test]
    fn writer_options_preserve_existing_pool_configuration() {
        let original = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(15))
            .max_lifetime(Some(Duration::from_secs(600)));
        let original_idle = original.get_idle_timeout();
        let original_min = original.get_min_connections();
        let guarded = writer_pool_options(original);
        assert_eq!(guarded.get_idle_timeout(), original_idle);
        assert_eq!(guarded.get_min_connections(), original_min);
        assert_eq!(guarded.get_max_connections(), 5);
        assert_eq!(guarded.get_acquire_timeout(), Duration::from_secs(15));
        assert_eq!(guarded.get_max_lifetime(), Some(Duration::from_secs(600)));
        assert!(!guarded.get_test_before_acquire());
    }

    #[tokio::test]
    async fn writer_probe_fails_closed() {
        let budget = Duration::from_millis(10);
        assert!(require_writer(async { Ok(true) }, budget).await.is_ok());
        // Recovery and transaction-readonly both produce false from WRITER_PROBE.
        assert!(require_writer(async { Ok(false) }, budget).await.is_err());
        assert!(
            require_writer(async { Err(sqlx::Error::RowNotFound) }, budget)
                .await
                .is_err()
        );
        assert!(matches!(
            require_writer(std::future::pending(), budget).await,
            Err(sqlx::Error::PoolTimedOut)
        ));
    }

    #[allow(clippy::unwrap_used)]
    #[tokio::test]
    async fn writer_pool_recycles_readonly_and_never_replays_a_failed_write() {
        let Some(fixture) = crate::test_support::fresh_database().await else {
            return;
        };
        let options = (*fixture.connect_options()).clone();
        fixture.close().await;
        use sqlx::Connection;

        let pool = writer_pool_options(
            PgPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(2)),
        )
        .connect_with(options.clone())
        .await
        .unwrap();
        let mut connection = pool.acquire().await.unwrap();
        let first: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *connection)
            .await
            .unwrap();
        drop(connection);
        let mut connection = pool.acquire().await.unwrap();
        let reused: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *connection)
            .await
            .unwrap();
        assert_eq!(first, reused, "healthy writer should be reused");

        // This changes only our borrowed disposable direct-test session.
        sqlx::query("SET default_transaction_read_only = on")
            .execute(&mut *connection)
            .await
            .unwrap();
        connection.ping().await.unwrap();
        drop(connection);
        let mut connection = pool.acquire().await.unwrap();
        let replacement: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *connection)
            .await
            .unwrap();
        assert_ne!(
            first, replacement,
            "a successful ping does not prove writer role"
        );
        probe_writer(&mut connection, Duration::from_secs(2))
            .await
            .unwrap();

        // Demotion after checkout cannot be made atomic with a role probe.
        // The one failed operation surfaces 25006; no query wrapper retries it.
        sqlx::query("SET default_transaction_read_only = on")
            .execute(&mut *connection)
            .await
            .unwrap();
        let error = sqlx::query("CREATE TABLE writer_pool_must_not_replay (id integer)")
            .execute(&mut *connection)
            .await
            .unwrap_err();
        assert_eq!(
            error
                .as_database_error()
                .and_then(|error| error.code())
                .as_deref(),
            Some("25006")
        );
        drop(connection);
        let mut connection = pool.acquire().await.unwrap();
        let independent: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *connection)
            .await
            .unwrap();
        assert_ne!(replacement, independent);
        probe_writer(&mut connection, Duration::from_secs(2))
            .await
            .unwrap();
        let replayed: bool =
            sqlx::query_scalar("SELECT to_regclass('writer_pool_must_not_replay') IS NOT NULL")
                .fetch_one(&mut *connection)
                .await
                .unwrap();
        assert!(
            !replayed,
            "failed DDL must never be replayed on the replacement writer"
        );
        drop(connection);
        pool.close().await;

        // New connections do not run before_acquire: after_connect must refuse them.
        let readonly = options.options([("default_transaction_read_only", "on")]);
        let result = tokio::time::timeout(
            Duration::from_secs(2),
            writer_pool_options(
                PgPoolOptions::new()
                    .max_connections(1)
                    .acquire_timeout(Duration::from_millis(150)),
            )
            .connect_with(readonly),
        )
        .await
        .unwrap();
        assert!(matches!(result, Err(sqlx::Error::PoolTimedOut)));
    }
}

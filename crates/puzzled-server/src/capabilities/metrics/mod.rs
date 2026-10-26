//! Scheduled, persisted product reports. No personal row is returned or logged.
//! Finishes remain exclusively game_sessions; a landing cannot assert a finish.
use chrono::{DateTime, Duration, Utc};
use policy::Day;
pub use puzzled_core::product_policy::metrics as policy;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub async fn count_on(connection: &mut sqlx::PgConnection, event: &str) -> Result<(), sqlx::Error> {
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(Utc::now()).to_string();
    sqlx::query("INSERT INTO metric_counters (day_key,event,count) VALUES ($1,$2,1) ON CONFLICT (day_key,event) DO UPDATE SET count = metric_counters.count + 1")
        .bind(day).bind(event).execute(connection).await?;
    Ok(())
}

pub async fn count(pool: &PgPool, event: &str) {
    let result = async {
        let mut connection = pool.acquire().await?;
        count_on(&mut connection, event).await
    }
    .await;
    if result.is_err() {
        capture_failed();
    }
}

pub fn capture_failed() {
    crate::shared::signals::issue(
        crate::shared::signals::Kind::ToolFailed,
        "metrics_capture",
        "write_failed",
    );
}

/// Record an observed signed-in audience, not a billing authority. Called only
/// from an existing subscription read: never adds Money to the free floor.
pub async fn audience(pool: &PgPool, user_id: &str, paid: bool) {
    let Ok(uid) = Uuid::parse_str(user_id) else {
        return;
    };
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(Utc::now()).to_string();
    if sqlx::query("INSERT INTO metric_audiences (user_id, day_key, paid) VALUES ($1,$2,$3) ON CONFLICT (user_id,day_key) DO UPDATE SET paid = metric_audiences.paid OR excluded.paid")
        .bind(uid).bind(day).bind(paid).execute(pool).await.is_err() { capture_failed(); }
}

pub async fn landing_on(
    connection: &mut sqlx::PgConnection,
    uid: Uuid,
    share: Uuid,
) -> Result<bool, sqlx::Error> {
    let day = puzzled_core::puzzle_play::daily_time::product_day_key(Utc::now()).to_string();
    let result = sqlx::query("INSERT INTO share_landings (user_id,share_id,day_key) SELECT $1,id,$3 FROM result_shares WHERE id = $2 AND user_id <> $1 ON CONFLICT DO NOTHING")
        .bind(uid).bind(share).bind(day).execute(connection).await?;
    Ok(result.rows_affected() > 0)
}

/// Guest adoption preserves attribution without duplicating a landing.
pub async fn adopt(
    connection: &mut sqlx::PgConnection,
    account: Uuid,
    guest: Uuid,
) -> Result<(), String> {
    sqlx::query("INSERT INTO share_landings (user_id,share_id,day_key,landed_at) SELECT $2,share_id,day_key,landed_at FROM share_landings WHERE user_id = $1 ON CONFLICT (user_id,share_id,day_key) DO UPDATE SET landed_at = least(share_landings.landed_at, excluded.landed_at)")
        .bind(guest).bind(account).execute(&mut *connection).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM share_landings WHERE user_id = $1")
        .bind(guest)
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn reports(pool: &PgPool) -> Result<Vec<(Day, String)>, String> {
    let rows =
        sqlx::query("SELECT report, generated_at FROM metric_days ORDER BY day_key DESC LIMIT 35")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
    rows.into_iter()
        .map(|r| {
            let value: serde_json::Value = r.try_get("report").map_err(|e| e.to_string())?;
            let generated: DateTime<Utc> = r.try_get("generated_at").map_err(|e| e.to_string())?;
            Ok((
                serde_json::from_value(value).map_err(|e| e.to_string())?,
                generated.to_rfc3339(),
            ))
        })
        .collect()
}

pub async fn rollup(pool: &PgPool, now: DateTime<Utc>) -> Result<usize, String> {
    use puzzled_core::puzzle_play::{daily_time::product_day_key, game_slugs::all_game_slugs};
    let today = product_day_key(now);
    let closed = product_day_key(now - Duration::minutes(15)) - Duration::days(1);
    let start = today - Duration::days(34);
    let release = [
        "SYLPHX_GIT_COMMIT_SHA",
        "GIT_COMMIT_SHA",
        "GIT_SHA",
        "GITHUB_SHA",
    ]
    .into_iter()
    .find_map(|key| {
        std::env::var(key)
            .ok()
            .filter(|value| value.len() == 40 && value.bytes().all(|b| b.is_ascii_hexdigit()))
    })
    .unwrap_or_default();
    let result: Result<usize, sqlx::Error> = async {
        let mut tx = pool.begin().await?;
        sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ").execute(&mut *tx).await?;
        sqlx::query("SET LOCAL statement_timeout = '30s'").execute(&mut *tx).await?;
        let lock: bool = sqlx::query_scalar("SELECT pg_try_advisory_xact_lock(789123542)").fetch_one(&mut *tx).await?;
        if !lock { return Ok(0); }
        let explanations: Option<serde_json::Value> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = 'metrics_explained_days'")
            .fetch_optional(&mut *tx).await?;
        let old: Vec<(String, serde_json::Value)> = sqlx::query_as("SELECT day_key,report FROM metric_days WHERE day_key >= $1")
            .bind(start.to_string()).fetch_all(&mut *tx).await?;
        let old: std::collections::BTreeMap<_, _> = old.into_iter().filter_map(|(k,v)| serde_json::from_value::<Day>(v).ok().map(|v|(k,v))).collect();
        let rows = sqlx::query(include_str!("rollup.sql"))
            .bind(start.to_string()).bind(today.to_string()).fetch_all(&mut *tx).await?;
        let mut days = std::collections::BTreeMap::<String, Day>::new();
        for r in rows {
            let key: String = r.try_get("day_key")?;
            let historical = old.get(&key);
            let current = key == today.to_string();
            let mut day = Day {
                complete: key <= closed.to_string(),
                catalog_size: if current { all_game_slugs().len() as i64 } else { historical.map_or(0, |d| d.catalog_size) },
                release: if current { release.clone() } else { historical.map_or(String::new(), |d| d.release.clone()) },
                daily_puzzle_completers: r.try_get("daily_puzzle_completers")?,
                signed_in_completers: r.try_get("signed_in_completers")?,
                daily_entertainment_completers: r.try_get("daily_entertainment_completers")?,
                weekly_ritualists: r.try_get("weekly_ritualists")?,
                d7_cohort: r.try_get("d7_cohort")?, d7_returned: r.try_get("d7_returned")?,
                share_landings: r.try_get("share_landings")?, share_landing_completers: r.try_get("share_landing_completers")?,
                shares: r.try_get("shares")?, free_finish_ok: r.try_get("free_finish_ok")?, free_finish_failed: r.try_get("free_finish_failed")?,
                paid_active: r.try_get("paid_active")?, paid_completers: r.try_get("paid_completers")?,
                free_active: r.try_get("free_active")?, free_completers: r.try_get("free_completers")?,
                day_key: key.clone(), ..Day::default()
            };
            let date = chrono::NaiveDate::parse_from_str(&key, "%Y-%m-%d").map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
            let explained = explanations.as_ref().and_then(|v| v.as_array()).is_some_and(|v| v.iter().any(|v| v.as_str() == Some(&key)));
            if day.complete {
                day.alerts = policy::alerts(&day, days.get(&(date - Duration::days(1)).to_string()), days.get(&(date - Duration::days(7)).to_string()), explained);
            }
            let value = serde_json::to_value(&day).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
            sqlx::query("INSERT INTO metric_days (day_key,report,generated_at) VALUES ($1,$2,$3) ON CONFLICT (day_key) DO UPDATE SET report = excluded.report, generated_at = excluded.generated_at")
                .bind(&key).bind(value).bind(now).execute(&mut *tx).await?;
            if key == closed.to_string() {
                for signal in &day.alerts {
                    sqlx::query("INSERT INTO metric_alert_outbox (day_key,signal) VALUES ($1,$2) ON CONFLICT DO NOTHING")
                        .bind(&key).bind(signal).execute(&mut *tx).await?;
                }
            }
            days.insert(key, day);
        }
        for (table, cutoff) in [("share_landings", start - Duration::days(6)), ("metric_audiences", start), ("metric_counters", start)] {
            sqlx::query(sqlx::AssertSqlSafe(format!("DELETE FROM {table} WHERE day_key < $1")))
                .bind(cutoff.to_string()).execute(&mut *tx).await?;
        }
        tx.commit().await?;
        Ok(days.len())
    }.await;
    let count = result.map_err(|e| e.to_string())?;
    // Durable at-least-once outbox: log first, then acknowledge. A crash may
    // repeat a fingerprint, never silently lose one. Platform deduplicates it.
    let pending: Vec<(String,String)> = sqlx::query_as("SELECT day_key,signal FROM metric_alert_outbox WHERE emitted_at IS NULL ORDER BY day_key,signal")
        .fetch_all(pool).await.map_err(|e| e.to_string())?;
    for (day, signal) in pending {
        crate::shared::signals::issue(
            crate::shared::signals::Kind::MetricRegression,
            &signal,
            "threshold_crossed",
        );
        sqlx::query(
            "UPDATE metric_alert_outbox SET emitted_at = now() WHERE day_key = $1 AND signal = $2",
        )
        .bind(day)
        .bind(signal)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(count)
}

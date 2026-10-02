//! SQL adapters for streak freeze persistence.

use chrono::NaiveDate;
use puzzled_core::gamification::personal_streak::{settle_freezes, Settlement};
use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
use sqlx::PgPool;
use uuid::Uuid;

fn parse_user_id(user_id: &str) -> Result<Uuid, String> {
    user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))
}

/// A player's freeze counters. A player with no row holds none, and covers
/// missed days automatically until they turn that off.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FreezeRow {
    pub available: i32,
    pub used: i32,
    pub auto_enabled: bool,
}

impl Default for FreezeRow {
    fn default() -> Self {
        Self {
            available: 0,
            used: 0,
            auto_enabled: true,
        }
    }
}

/// Load a player's freeze counters (defaults when there is no row).
pub async fn load_freeze_row(pool: &PgPool, user_id: &str) -> Result<FreezeRow, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let value = load_freeze_row_on_connection(&mut tx, user_id).await?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(value)
}

pub async fn load_freeze_row_on_connection(
    connection: &mut sqlx::PgConnection,
    user_id: &str,
) -> Result<FreezeRow, String> {
    let uid = parse_user_id(user_id)?;
    let row: Option<(i32, i32, bool)> = sqlx::query_as(
        "SELECT freezes_available, freezes_used, auto_freeze_enabled \
         FROM user_freeze_data WHERE user_id = $1 LIMIT 1",
    )
    .bind(uid)
    .fetch_optional(&mut *connection)
    .await
    .map_err(|e| e.to_string())?;
    Ok(row
        .map(|(available, used, auto_enabled)| FreezeRow {
            available,
            used,
            auto_enabled,
        })
        .unwrap_or_default())
}

async fn day_column_on_connection(
    connection: &mut sqlx::PgConnection,
    sql: &'static str,
    uid: Uuid,
) -> Result<Vec<NaiveDate>, String> {
    let rows: Vec<(NaiveDate,)> = sqlx::query_as(sql)
        .bind(uid)
        .fetch_all(&mut *connection)
        .await
        .map_err(|e| format!("streak freeze read failed: {e}"))?;
    Ok(rows.into_iter().map(|(day,)| day).collect())
}

const FROZEN_DAYS_SQL: &str = "SELECT day_key FROM streak_freeze_uses WHERE user_id = $1";
const AWARDED_DAYS_SQL: &str = "SELECT day_key FROM streak_freeze_awards WHERE user_id = $1";

/// Earn and use freezes as of `today` and return the counters and every
/// covered day afterwards.
///
/// A read decides first; only when something must change does it lock the
/// player's counters, decide again on what it finds under the lock, and write
/// the awards, the covered days and the counters in one transaction. Two
/// requests at once therefore earn a milestone and cover a day once.
pub async fn settle_player_freezes(
    pool: &PgPool,
    user_id: &str,
    today: NaiveDate,
    played: &[NaiveDate],
) -> Result<(FreezeRow, Vec<NaiveDate>), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let value = settle_player_freezes_on_connection(&mut tx, user_id, today, played).await?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(value)
}

pub async fn settle_player_freezes_on_connection(
    connection: &mut sqlx::PgConnection,
    user_id: &str,
    today: NaiveDate,
    played: &[NaiveDate],
) -> Result<(FreezeRow, Vec<NaiveDate>), String> {
    let uid = parse_user_id(user_id)?;
    let row = load_freeze_row_on_connection(connection, user_id).await?;
    let mut frozen = day_column_on_connection(connection, FROZEN_DAYS_SQL, uid).await?;
    let awarded = day_column_on_connection(connection, AWARDED_DAYS_SQL, uid).await?;
    let available = u32::try_from(row.available.max(0)).unwrap_or(0);
    let plan = settle_freezes(
        today,
        played,
        &frozen,
        &awarded,
        available,
        row.auto_enabled,
    );
    if plan.is_empty() {
        return Ok((row, frozen));
    }

    sqlx::query(
        "INSERT INTO user_freeze_data (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    )
    .bind(uid)
    .execute(&mut *connection)
    .await
    .map_err(|e| format!("freeze row create failed: {e}"))?;
    let locked: (i32, i32, bool) = sqlx::query_as(
        "SELECT freezes_available, freezes_used, auto_freeze_enabled \
         FROM user_freeze_data WHERE user_id = $1 FOR UPDATE",
    )
    .bind(uid)
    .fetch_one(&mut *connection)
    .await
    .map_err(|e| format!("freeze row lock failed: {e}"))?;
    let locked = FreezeRow {
        available: locked.0,
        used: locked.1,
        auto_enabled: locked.2,
    };
    let awarded: Vec<NaiveDate> = sqlx::query_as::<_, (NaiveDate,)>(AWARDED_DAYS_SQL)
        .bind(uid)
        .fetch_all(&mut *connection)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(day,)| day)
        .collect();
    frozen = sqlx::query_as::<_, (NaiveDate,)>(FROZEN_DAYS_SQL)
        .bind(uid)
        .fetch_all(&mut *connection)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(day,)| day)
        .collect();
    let held = u32::try_from(locked.available.max(0)).unwrap_or(0);
    let plan = settle_freezes(today, played, &frozen, &awarded, held, locked.auto_enabled);
    if plan.is_empty() {
        return Ok((locked, frozen));
    }
    persist(connection, uid, &plan, held).await?;

    let used = i32::try_from(plan.cover_days.len()).unwrap_or(i32::MAX);
    frozen.extend(plan.cover_days.iter().copied());
    Ok((
        FreezeRow {
            available: i32::try_from(plan.available_after).unwrap_or(i32::MAX),
            used: locked.used.saturating_add(used),
            auto_enabled: locked.auto_enabled,
        },
        frozen,
    ))
}

async fn persist(
    connection: &mut sqlx::PgConnection,
    uid: Uuid,
    plan: &Settlement,
    held: u32,
) -> Result<(), String> {
    // Only the milestones this transaction really inserts add to the count.
    let mut room = puzzled_core::gamification::personal_streak::FREEZE_CAP.saturating_sub(held);
    let mut granted = 0u32;
    for day in &plan.award_days {
        let grant = room > 0 && granted < plan.granted;
        let inserted = sqlx::query(
            "INSERT INTO streak_freeze_awards (user_id, day_key, granted) VALUES ($1, $2, $3) \
             ON CONFLICT (user_id, day_key) DO NOTHING",
        )
        .bind(uid)
        .bind(day)
        .bind(grant)
        .execute(&mut *connection)
        .await
        .map_err(|e| format!("freeze award failed: {e}"))?
        .rows_affected();
        if inserted == 1 && grant {
            granted += 1;
            room -= 1;
        }
    }
    for day in &plan.cover_days {
        sqlx::query(
            "INSERT INTO streak_freeze_uses (user_id, day_key) VALUES ($1, $2) \
             ON CONFLICT (user_id, day_key) DO NOTHING",
        )
        .bind(uid)
        .bind(day)
        .execute(&mut *connection)
        .await
        .map_err(|e| format!("freeze use failed: {e}"))?;
    }
    let covered = i32::try_from(plan.cover_days.len()).unwrap_or(i32::MAX);
    sqlx::query(
        "UPDATE user_freeze_data SET \
           freezes_available = freezes_available + $2 - $3, \
           freezes_used = freezes_used + $3, updated_at = now() \
         WHERE user_id = $1",
    )
    .bind(uid)
    .bind(i32::try_from(granted).unwrap_or(i32::MAX))
    .bind(covered)
    .execute(&mut *connection)
    .await
    .map_err(|e| format!("freeze counters failed: {e}"))?;
    Ok(())
}

/// Move a guest's freezes onto the account when the guest signs in: covered
/// and earned days merge, held freezes add up to the most allowed, and the
/// guest's rows remain as provenance; the credential is revoked by adoption.
pub async fn adopt_guest_freezes(
    connection: &mut sqlx::PgConnection,
    account: Uuid,
    guest: Uuid,
) -> Result<(), String> {
    for table in ["streak_freeze_uses", "streak_freeze_awards"] {
        let sql = if table == "streak_freeze_uses" {
            "INSERT INTO streak_freeze_uses (user_id, day_key) \
             SELECT $2, day_key FROM streak_freeze_uses WHERE user_id = $1 \
             ON CONFLICT (user_id, day_key) DO NOTHING"
        } else {
            "INSERT INTO streak_freeze_awards (user_id, day_key, granted) \
             SELECT $2, day_key, granted FROM streak_freeze_awards WHERE user_id = $1 \
             ON CONFLICT (user_id, day_key) DO NOTHING"
        };
        sqlx::query(sql)
            .bind(guest)
            .bind(account)
            .execute(&mut *connection)
            .await
            .map_err(|e| format!("guest {table} adoption failed: {e}"))?;
    }
    sqlx::query(
        "INSERT INTO user_freeze_data (user_id, freezes_available, freezes_used) \
         SELECT $2, LEAST(freezes_available, $3), freezes_used FROM user_freeze_data WHERE user_id = $1 \
         ON CONFLICT (user_id) DO UPDATE SET \
           freezes_available = LEAST(user_freeze_data.freezes_available + EXCLUDED.freezes_available, $3), \
           freezes_used = user_freeze_data.freezes_used + EXCLUDED.freezes_used, updated_at = now()",
    )
    .bind(guest)
    .bind(account)
    .bind(i32::try_from(puzzled_core::gamification::personal_streak::FREEZE_CAP).unwrap_or(2))
    .execute(&mut *connection)
    .await
    .map_err(|e| format!("guest freeze counters adoption failed: {e}"))?;
    Ok(())
}

/// Upsert freeze counters for a user.
pub async fn upsert_freeze_data(
    pool: &PgPool,
    user_id: &str,
    freezes_available: i32,
    freezes_used: i32,
    auto_freeze_enabled: bool,
) -> Result<(), String> {
    let uid =
        user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))?;
    sqlx::query(
        r#"
        INSERT INTO user_freeze_data (user_id, freezes_available, freezes_used, auto_freeze_enabled, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id) DO UPDATE SET
            freezes_available = EXCLUDED.freezes_available,
            freezes_used = EXCLUDED.freezes_used,
            auto_freeze_enabled = EXCLUDED.auto_freeze_enabled,
            updated_at = now()
        "#,
    )
    .bind(uid)
    .bind(freezes_available)
    .bind(freezes_used)
    .bind(auto_freeze_enabled)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

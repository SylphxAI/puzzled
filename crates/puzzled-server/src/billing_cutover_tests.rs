//! Reader removal must refuse any legacy record before rollout.
use crate::test_support::fresh_database;

const VERIFY: &str = include_str!(
    "../../../apps/puzzled/atlas/migrations/20261025000000_verify_dormant_billing_empty.sql"
);
#[tokio::test]
async fn reader_removal_refuses_every_kind_of_legacy_record() {
    for insert in [
        None,
        Some("INSERT INTO billing_customers (user_id, stripe_customer_id) VALUES (gen_random_uuid(), 'cus_legacy')"),
        Some("INSERT INTO billing_subscriptions (stripe_subscription_id, stripe_customer_id, plan_id, status, current_period_end, started_at) VALUES ('sub_legacy', 'cus_legacy', 'individual_monthly', 'active', now() + interval '1 month', now())"),
        Some("INSERT INTO billing_ledger (source_id, kind, stripe_customer_id, currency, amount_minor, occurred_at) VALUES ('in_legacy', 'payment', 'cus_legacy', 'usd', 499, now())"),
    ] {
        let Some(pool) = fresh_database().await else { return; };
        if let Some(insert) = insert {
            sqlx::raw_sql(sqlx::AssertSqlSafe(insert)).execute(&pool).await.unwrap();
        }
        let result = sqlx::raw_sql(sqlx::AssertSqlSafe(VERIFY)).execute(&pool).await;
        if insert.is_some() {
            assert!(result.unwrap_err().to_string().contains("legacy billing records remain"));
            let tables: i64 = sqlx::query_scalar("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('billing_customers', 'billing_subscriptions', 'billing_ledger')").fetch_one(&pool).await.unwrap();
            assert_eq!(tables, 3, "a refusal must keep all three tables");
            let rows: i64 = sqlx::query_scalar("SELECT (SELECT count(*) FROM billing_customers) + (SELECT count(*) FROM billing_subscriptions) + (SELECT count(*) FROM billing_ledger)").fetch_one(&pool).await.unwrap();
            assert_eq!(rows, 1, "a refusal must preserve the record");
        } else {
            result.unwrap();
            let tables: i64 = sqlx::query_scalar("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('billing_customers', 'billing_subscriptions', 'billing_ledger')").fetch_one(&pool).await.unwrap();
            assert_eq!(tables, 3, "the old serving release still needs these tables");
            let families: i64 = sqlx::query_scalar("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('family_groups', 'family_members', 'checkout_consents', 'plus_trials')").fetch_one(&pool).await.unwrap();
            assert_eq!(families, 4, "product access data stays intact");
        }
        pool.close().await;
    }
}

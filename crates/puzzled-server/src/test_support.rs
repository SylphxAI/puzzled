//! Shared test helpers: a throwaway migrated Postgres and a signed Platform JWT.
//! Needs `PUZZLED_TEST_DATABASE_URL` (CI sets it and `PUZZLED_REQUIRE_DB_TESTS=1`,
//! so a missing database fails there instead of skipping).

use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub(crate) async fn fresh_database() -> Option<PgPool> {
    let Ok(admin_url) = std::env::var("PUZZLED_TEST_DATABASE_URL") else {
        assert!(
            std::env::var("PUZZLED_REQUIRE_DB_TESTS").is_err(),
            "PUZZLED_TEST_DATABASE_URL is required here"
        );
        eprintln!("skipping database test: PUZZLED_TEST_DATABASE_URL is not set");
        return None;
    };
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_url)
        .await
        .unwrap();
    let name = format!("puzzled_test_{}", uuid::Uuid::now_v7().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap();
    let mut url = reqwest::Url::parse(&admin_url).unwrap();
    url.set_path(&format!("/{name}"));
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(url.as_str())
        .await
        .unwrap();
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../apps/puzzled/atlas/migrations");
    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e == "sql"))
        .collect();
    files.sort();
    for file in files {
        let sql = std::fs::read_to_string(&file).unwrap();
        sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .execute(&pool)
            .await
            .unwrap_or_else(|e| panic!("{}: {e}", file.display()));
    }
    Some(pool)
}

pub(crate) fn token(sub: &str) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    let priv_pem = include_str!("../testdata/platform_jwt_test_priv.pem");
    let pub_pem = include_str!("../testdata/platform_jwt_test_pub.pem");
    crate::capabilities::identity_access::adapters::platform_jwt::install_test_decoding_key_pem(
        pub_pem,
    )
    .unwrap();
    let claims = json!({"sub": sub, "name": "Player", "email": "player@example.com",
                        "exp": chrono::Utc::now().timestamp() + 3600});
    encode(
        &Header::new(jsonwebtoken::Algorithm::RS256),
        &claims,
        &EncodingKey::from_rsa_pem(priv_pem.as_bytes()).unwrap(),
    )
    .unwrap()
}

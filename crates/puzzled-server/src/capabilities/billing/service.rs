//! Who holds Puzzled Plus: Sylphx Money's answer, plus the family plans
//! Puzzled itself keeps (Money has no seat members).

use sqlx::PgPool;

use super::adapters::billing_db;
use crate::capabilities::money::{access, Money};

/// Is `user_id` a Platform account (a UUID), not a guest-day id?
#[must_use]
pub fn is_account_id(user_id: &str) -> bool {
    uuid::Uuid::parse_str(user_id).is_ok()
}

/// Where the account's access comes from.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Entitlement {
    pub entitled: bool,
    /// Owner of the family plan that grants access, when access comes from one.
    pub family_owner: Option<String>,
}

/// The account's access: Money's `plus` answer, or a place in a family whose
/// owner holds the `family` feature in Money. Without Money, or when Money
/// cannot answer, no one is entitled (fail closed).
pub async fn access(
    pool: &PgPool,
    money: Option<&Money>,
    user_id: &str,
) -> Result<Entitlement, String> {
    let Some(money) = money else {
        return Ok(Entitlement::default());
    };
    if !is_account_id(user_id) {
        return Ok(Entitlement::default());
    }
    if access::is_premium(money, user_id).await {
        return Ok(Entitlement {
            entitled: true,
            family_owner: None,
        });
    }
    if let Some(owner) = billing_db::family_owner_of(pool, user_id).await? {
        if access::family_active(money, &owner).await {
            return Ok(Entitlement {
                entitled: true,
                family_owner: Some(owner),
            });
        }
    }
    Ok(Entitlement::default())
}

//! Who holds what, as Money answers it. The feature keys are the ones Money's
//! `price_catalogs/default` declares; every entitlement read in Puzzled goes
//! through these.

use super::client::{Money, MoneyError};

/// Every game, the archive and stats.
pub const FEATURE_PLUS: &str = "plus";
/// A family plan: seats shared with invited members.
pub const FEATURE_FAMILY: &str = "family";
/// A `limit` feature: how many people one price covers, the owner included.
pub const FEATURE_SEATS: &str = "seats";

/// Does `user_id` hold Puzzled Plus now? Fails closed: a Money error is `false`.
pub async fn is_premium(money: &Money, user_id: &str) -> bool {
    money.check(user_id, FEATURE_PLUS).await.entitled
}

/// Does `owner` hold a family plan now?
pub async fn family_active(money: &Money, owner: &str) -> bool {
    money.check(owner, FEATURE_FAMILY).await.entitled
}

/// The seats `owner`'s plan covers (owner included). `Err`: Money could not
/// answer, so nothing may be decided from it; `Ok(None)`: Money answered and
/// the owner holds no `seats` limit.
pub async fn seats(money: &Money, owner: &str) -> Result<Option<u32>, MoneyError> {
    let grant = money.try_check(owner, FEATURE_SEATS).await?;
    Ok(grant.entitled.then_some(grant.limit).flatten())
}

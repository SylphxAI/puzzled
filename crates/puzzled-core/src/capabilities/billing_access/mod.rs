//! Capability `billing_access` functional core: who may play what, and the
//! Puzzled Plus plan facts. The shell supplies the stored subscription facts
//! and the clock; nothing here reads Stripe or the database.

pub mod policy;

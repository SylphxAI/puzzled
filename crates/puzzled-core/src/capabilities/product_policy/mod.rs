//! Capability `product_policy` functional core.


pub mod domain;

pub use domain::app_config;
pub use domain::domain_enums;
pub use domain::error_codes;
pub use domain::flags_hash;
pub use domain::format_url;
pub use domain::html_escape;
pub use domain::i18n_locale;
pub use domain::llm_json_parse;
pub use domain::sdk_resilience;
pub use domain::storage_keys;
pub use domain::time_constants;
pub use domain::user_profile_limits;
pub use domain::validation_limits;


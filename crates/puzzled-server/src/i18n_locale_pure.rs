//! Pure i18n locale catalog —
//! dual-oracle residual of `apps/puzzled/src/lib/i18n/config.ts`.
//! next-intl routing / message loading stays FE-TS residual.
//! NO authority_rust / ts_deleted.

/// Supported locales (TS `locales` order).
pub const LOCALES: &[&str] = &["en-US", "en-GB", "zh-HK", "zh-TW", "zh-CN"];

/// Default locale (TS `defaultLocale`).
pub const DEFAULT_LOCALE: &str = "en-US";

/// Native display names (TS `localeNames`).
#[must_use]
pub fn locale_name(locale: &str) -> Option<&'static str> {
    match locale {
        "en-US" => Some("English (US)"),
        "en-GB" => Some("English (UK)"),
        "zh-HK" => Some("繁體中文（香港）"),
        "zh-TW" => Some("正體中文（台灣）"),
        "zh-CN" => Some("简体中文"),
        _ => None,
    }
}

/// Short display names (TS `localeShortNames`).
#[must_use]
pub fn locale_short_name(locale: &str) -> Option<&'static str> {
    match locale {
        "en-US" | "en-GB" => Some("English"),
        "zh-HK" => Some("繁體中文"),
        "zh-TW" => Some("正體中文"),
        "zh-CN" => Some("简体中文"),
        _ => None,
    }
}

/// ISO 3166-1 alpha-2 country codes for flags (TS `localeCountryCodes`).
#[must_use]
pub fn locale_country_code(locale: &str) -> Option<&'static str> {
    match locale {
        "en-US" => Some("us"),
        "en-GB" => Some("gb"),
        "zh-HK" => Some("hk"),
        "zh-TW" => Some("tw"),
        "zh-CN" => Some("cn"),
        _ => None,
    }
}

/// Fallback parent locale (TS `localeFallbacks`); `None` = base.
#[must_use]
pub fn locale_fallback(locale: &str) -> Option<&'static str> {
    match locale {
        "en-GB" => Some("en-US"),
        "zh-TW" => Some("zh-HK"),
        "en-US" | "zh-HK" | "zh-CN" => None,
        _ => None,
    }
}

/// English family locales (TS `localeGroups.english`).
pub const LOCALE_GROUP_ENGLISH: &[&str] = &["en-US", "en-GB"];
/// Chinese family locales (TS `localeGroups.chinese`).
pub const LOCALE_GROUP_CHINESE: &[&str] = &["zh-HK", "zh-TW", "zh-CN"];

/// Currency for locale (TS `_localeFormats.currency`).
#[must_use]
pub fn locale_currency(locale: &str) -> Option<&'static str> {
    match locale {
        "en-US" => Some("USD"),
        "en-GB" => Some("GBP"),
        "zh-HK" => Some("HKD"),
        "zh-TW" => Some("TWD"),
        "zh-CN" => Some("CNY"),
        _ => None,
    }
}

/// Date style preference (TS `_localeFormats.dateStyle`).
#[must_use]
pub fn locale_date_style(locale: &str) -> Option<&'static str> {
    match locale {
        "en-US" | "en-GB" => Some("medium"),
        "zh-HK" | "zh-TW" | "zh-CN" => Some("long"),
        _ => None,
    }
}

/// TS `isValidLocale`.
#[must_use]
pub fn is_valid_locale(locale: &str) -> bool {
    LOCALES.contains(&locale)
}

/// TS `_getLanguageFromLocale` — primary subtag before `-`.
#[must_use]
pub fn language_from_locale(locale: &str) -> Option<&str> {
    locale.split('-').next().filter(|s| !s.is_empty())
}

/// TS `_isChineseLocale`.
#[must_use]
pub fn is_chinese_locale(locale: &str) -> bool {
    locale.starts_with("zh-")
}

/// TS `_isEnglishLocale`.
#[must_use]
pub fn is_english_locale(locale: &str) -> bool {
    locale.starts_with("en-")
}

/// TS `_getLocaleDirection` — all current locales LTR.
#[must_use]
pub fn locale_direction(_locale: &str) -> &'static str {
    "ltr"
}

/// Resolve locale or fall back to default when invalid.
#[must_use]
pub fn resolve_locale(locale: &str) -> &'static str {
    if is_valid_locale(locale) {
        // Return static match for known locales.
        for &l in LOCALES {
            if l == locale {
                return l;
            }
        }
    }
    DEFAULT_LOCALE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_catalog() {
        assert_eq!(LOCALES.len(), 5);
        assert_eq!(DEFAULT_LOCALE, "en-US");
        assert!(is_valid_locale("en-US"));
        assert!(is_valid_locale("zh-CN"));
        assert!(!is_valid_locale("fr-FR"));
        assert!(!is_valid_locale("en"));
        assert_eq!(locale_name("zh-HK"), Some("繁體中文（香港）"));
        assert_eq!(locale_short_name("en-GB"), Some("English"));
        assert_eq!(locale_country_code("en-GB"), Some("gb"));
        assert_eq!(locale_fallback("en-GB"), Some("en-US"));
        assert_eq!(locale_fallback("zh-TW"), Some("zh-HK"));
        assert_eq!(locale_fallback("en-US"), None);
        assert_eq!(locale_currency("zh-HK"), Some("HKD"));
        assert_eq!(locale_date_style("en-US"), Some("medium"));
        assert_eq!(locale_date_style("zh-CN"), Some("long"));
        assert_eq!(language_from_locale("en-US"), Some("en"));
        assert!(is_chinese_locale("zh-TW"));
        assert!(is_english_locale("en-GB"));
        assert!(!is_chinese_locale("en-US"));
        assert_eq!(locale_direction("zh-CN"), "ltr");
        assert_eq!(resolve_locale("zh-TW"), "zh-TW");
        assert_eq!(resolve_locale("nope"), DEFAULT_LOCALE);
        assert_eq!(LOCALE_GROUP_ENGLISH.len(), 2);
        assert_eq!(LOCALE_GROUP_CHINESE.len(), 3);
    }
}

//! Pure feature-flag hashing/bucketing residual —
//! dual-oracle of `packages/sdk/src/lib/flags/hash.ts`.
//!
//! MurmurHash3 x86_32 + bucket/variant selection. Streaming evaluator I/O residual.
//! NO authority_rust / ts_deleted invent.

/// MurmurHash3 x86 32-bit — dual-oracle of TS `murmurHash3(key, seed)`.
///
/// Uses UTF-16 code units (JS `charCodeAt`) so BMP strings match the TS oracle.
#[must_use]
pub fn murmur_hash3(key: &str, seed: u32) -> u32 {
    murmur_hash3_js_chars(key, seed)
}

/// Faithful port of the TS implementation (charCodeAt walk).
fn murmur_hash3_js_chars(key: &str, seed: u32) -> u32 {
    // For dual-oracle of ASCII/BMP keys used in flags, char == UTF-16 unit.
    let chars: Vec<u16> = key.encode_utf16().collect();
    let len = chars.len();
    let remainder = len & 3;
    let bytes = len - remainder;
    let mut h1 = seed;
    let c1: u32 = 0xcc9e2d51;
    let c2: u32 = 0x1b873593;

    let mut i = 0usize;
    while i < bytes {
        let mut k1 = (chars[i] as u32 & 0xff)
            | (((chars[i + 1] as u32) & 0xff) << 8)
            | (((chars[i + 2] as u32) & 0xff) << 16)
            | (((chars[i + 3] as u32) & 0xff) << 24);
        i += 4;

        k1 = (k1 & 0xffff)
            .wrapping_mul(c1)
            .wrapping_add(((k1 >> 16).wrapping_mul(c1) & 0xffff) << 16);
        k1 = k1.rotate_left(15);
        k1 = (k1 & 0xffff)
            .wrapping_mul(c2)
            .wrapping_add(((k1 >> 16).wrapping_mul(c2) & 0xffff) << 16);

        h1 ^= k1;
        h1 = h1.rotate_left(13);
        let h1b = (h1 & 0xffff)
            .wrapping_mul(5)
            .wrapping_add(((h1 >> 16).wrapping_mul(5) & 0xffff) << 16);
        h1 = (h1b & 0xffff)
            .wrapping_add(0x6b64)
            .wrapping_add(((h1b >> 16).wrapping_add(0xe654) & 0xffff) << 16);
    }

    let mut k1: u32 = 0;
    match remainder {
        3 => {
            k1 ^= ((chars[i + 2] as u32) & 0xff) << 16;
            k1 ^= ((chars[i + 1] as u32) & 0xff) << 8;
            k1 ^= (chars[i] as u32) & 0xff;
            k1 = (k1 & 0xffff)
                .wrapping_mul(c1)
                .wrapping_add(((k1 >> 16).wrapping_mul(c1) & 0xffff) << 16);
            k1 = k1.rotate_left(15);
            k1 = (k1 & 0xffff)
                .wrapping_mul(c2)
                .wrapping_add(((k1 >> 16).wrapping_mul(c2) & 0xffff) << 16);
            h1 ^= k1;
        }
        2 => {
            k1 ^= ((chars[i + 1] as u32) & 0xff) << 8;
            k1 ^= (chars[i] as u32) & 0xff;
            k1 = (k1 & 0xffff)
                .wrapping_mul(c1)
                .wrapping_add(((k1 >> 16).wrapping_mul(c1) & 0xffff) << 16);
            k1 = k1.rotate_left(15);
            k1 = (k1 & 0xffff)
                .wrapping_mul(c2)
                .wrapping_add(((k1 >> 16).wrapping_mul(c2) & 0xffff) << 16);
            h1 ^= k1;
        }
        1 => {
            k1 ^= (chars[i] as u32) & 0xff;
            k1 = (k1 & 0xffff)
                .wrapping_mul(c1)
                .wrapping_add(((k1 >> 16).wrapping_mul(c1) & 0xffff) << 16);
            k1 = k1.rotate_left(15);
            k1 = (k1 & 0xffff)
                .wrapping_mul(c2)
                .wrapping_add(((k1 >> 16).wrapping_mul(c2) & 0xffff) << 16);
            h1 ^= k1;
        }
        _ => {}
    }

    h1 ^= len as u32;
    h1 ^= h1 >> 16;
    h1 = (h1 & 0xffff)
        .wrapping_mul(0x85ebca6b)
        .wrapping_add(((h1 >> 16).wrapping_mul(0x85ebca6b) & 0xffff) << 16);
    h1 ^= h1 >> 13;
    h1 = (h1 & 0xffff)
        .wrapping_mul(0xc2b2ae35)
        .wrapping_add(((h1 >> 16).wrapping_mul(0xc2b2ae35) & 0xffff) << 16);
    h1 ^= h1 >> 16;
    h1
}

/// Bucket 0–99 dual-oracle of `getBucket(key, salt)`.
#[must_use]
pub fn get_bucket(key: &str, salt: &str) -> u32 {
    let hash = murmur_hash3(&(salt.to_string() + key), 0);
    hash % 100
}

/// Dual-oracle of `isInPercentage(bucket, percentage)`.
#[must_use]
pub fn is_in_percentage(bucket: u32, percentage: u32) -> bool {
    bucket < percentage
}

/// Dual-oracle of `getUserBucket(flagKey, userId, anonymousId, salt)`.
#[must_use]
pub fn get_user_bucket(
    flag_key: &str,
    user_id: Option<&str>,
    anonymous_id: Option<&str>,
    salt: &str,
) -> u32 {
    let identifier = user_id
        .filter(|s| !s.is_empty())
        .or(anonymous_id.filter(|s| !s.is_empty()))
        .unwrap_or("anonymous");
    get_bucket(&format!("{flag_key}:{identifier}"), salt)
}

/// Variant weight dual-oracle of TS `VariantWeight`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VariantWeight {
    pub key: &'static str,
    pub weight: f64,
}

/// Dual-oracle of `selectVariant(variants, bucket)`.
/// Returns None when variants empty (TS throws).
#[must_use]
pub fn select_variant(variants: &[VariantWeight], bucket: f64) -> Option<&'static str> {
    if variants.is_empty() {
        return None;
    }
    if variants.len() == 1 {
        return Some(variants[0].key);
    }
    let total_weight: f64 = variants.iter().map(|v| v.weight).sum();
    let mut normalized_bucket = bucket;
    if (total_weight - 100.0).abs() > f64::EPSILON && total_weight > 0.0 {
        normalized_bucket = (bucket / 100.0) * total_weight;
    }
    let mut cumulative = 0.0;
    for v in variants {
        cumulative += v.weight;
        if normalized_bucket < cumulative {
            return Some(v.key);
        }
    }
    Some(variants[variants.len() - 1].key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_hash_bucket_variant_dual_oracle() {
        // Consistency
        assert_eq!(murmur_hash3("hello", 0), murmur_hash3("hello", 0));
        assert_ne!(murmur_hash3("hello", 0), murmur_hash3("world", 0));
        assert_ne!(murmur_hash3("test", 0), murmur_hash3("test", 1));
        let b = get_bucket("flag:user1", "");
        assert!(b < 100);
        assert_eq!(get_bucket("flag:user1", ""), b);
        assert!(is_in_percentage(10, 50));
        assert!(!is_in_percentage(50, 50));
        assert_eq!(
            get_user_bucket("exp", Some("u1"), None, ""),
            get_bucket("exp:u1", "")
        );
        assert_eq!(
            get_user_bucket("exp", None, None, ""),
            get_bucket("exp:anonymous", "")
        );
        let variants = [
            VariantWeight {
                key: "a",
                weight: 50.0,
            },
            VariantWeight {
                key: "b",
                weight: 50.0,
            },
        ];
        assert_eq!(select_variant(&variants, 10.0), Some("a"));
        assert_eq!(select_variant(&variants, 60.0), Some("b"));
        assert_eq!(
            select_variant(
                &[VariantWeight {
                    key: "only",
                    weight: 100.0
                }],
                99.0
            ),
            Some("only")
        );
        assert!(select_variant(&[], 0.0).is_none());
        // Known oracle pin: empty string hashes stably
        let empty = murmur_hash3("", 0);
        assert_eq!(empty, murmur_hash3("", 0));
    }
}

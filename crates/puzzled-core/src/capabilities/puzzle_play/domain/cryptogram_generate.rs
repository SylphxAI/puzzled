//! Deterministic cryptogram generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/cryptogram/generator.ts`.

use std::collections::BTreeMap;

use serde_json::{json, Value};

use super::cryptogram::unique_encrypted_letters;
use super::cryptogram_quotes::QUOTES;
use super::random::{seeded_random, shuffle_array};

const ALPHABET: &[char] = &[
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];
const MAX_HINTS: u32 = 3;

fn create_cipher(seed: i64) -> BTreeMap<char, char> {
    let mut random = seeded_random(seed);
    let shuffled = shuffle_array(ALPHABET, &mut random);
    ALPHABET
        .iter()
        .zip(shuffled)
        .map(|(plain, encrypted)| (*plain, encrypted))
        .collect()
}

fn encrypt_text(text: &str, cipher: &BTreeMap<char, char>) -> String {
    text.chars()
        .map(|ch| {
            let upper = ch.to_ascii_uppercase();
            if upper.is_ascii_uppercase() {
                cipher.get(&upper).copied().unwrap_or(upper)
            } else {
                ch
            }
        })
        .collect()
}

/// Generate client ciphertext + server cipher for a seed.
#[must_use]
pub fn generate_cryptogram_puzzle(seed: i64) -> (Value, Value) {
    let quote = &QUOTES[(seed.unsigned_abs() as usize) % QUOTES.len()];
    let cipher = create_cipher(seed);
    let encrypted = encrypt_text(quote.text, &cipher);
    let reverse: BTreeMap<String, String> = cipher
        .iter()
        .map(|(plain, encrypted)| (encrypted.to_string(), plain.to_string()))
        .collect();
    let cipher_json: BTreeMap<String, String> = cipher
        .iter()
        .map(|(plain, encrypted)| (plain.to_string(), encrypted.to_string()))
        .collect();
    (
        json!({
            "encryptedText": encrypted,
            "author": quote.author,
            "category": quote.category,
            "uniqueLetters": unique_encrypted_letters(&encrypted).len(),
            "maxHints": MAX_HINTS,
        }),
        json!({
            "originalText": quote.text.to_ascii_uppercase(),
            "cipher": cipher_json,
            "reverseCipher": reverse,
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_cryptogram_puzzle(5), generate_cryptogram_puzzle(5));
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let cases = [
            (
                0,
                "NYZ LECQ OSQ NL IL XPZSN OLPG BD NL CLVZ OYSN QLW IL.",
                "Steve Jobs",
                "Inspiration",
                17,
                "THE ONLY WAY TO DO GREAT WORK IS TO LOVE WHAT YOU DO.",
            ),
            (
                1,
                "SF AVI HSUUKI LJ USJJSMTKAE KSIQ LYYLCATFSAE.",
                "Albert Einstein",
                "Inspiration",
                16,
                "IN THE MIDDLE OF DIFFICULTY LIES OPPORTUNITY.",
            ),
            (
                5,
                "JTN YSMG JWCN HAIEYP AI AS XSYHASL GYC XSYH SYJTASL.",
                "Socrates",
                "Wisdom",
                16,
                "THE ONLY TRUE WISDOM IS IN KNOWING YOU KNOW NOTHING.",
            ),
            (
                42,
                "TUAKOJN THWUAC KGN LUZX.",
                "Virgil",
                "Courage",
                14,
                "FORTUNE FAVORS THE BOLD.",
            ),
        ];
        for (seed, encrypted, author, category, unique, original) in cases {
            let (data, solution) = generate_cryptogram_puzzle(seed);
            assert_eq!(data["encryptedText"], encrypted, "seed {seed}");
            assert_eq!(data["author"], author);
            assert_eq!(data["category"], category);
            assert_eq!(data["uniqueLetters"], unique);
            assert_eq!(data["maxHints"], MAX_HINTS);
            assert!(data.get("cipher").is_none());
            assert_eq!(solution["originalText"], original);
        }
    }
}

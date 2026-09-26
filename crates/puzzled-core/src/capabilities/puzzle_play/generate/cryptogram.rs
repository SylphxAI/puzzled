//! Daily generator for `cryptogram`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/cryptogram/generator.ts` + `types.ts`),
//! checked against `tests/fixtures/generate/cryptogram.json`.
//!
//! The quote is `QUOTES[|seed| % len]`; the cipher is the alphabet shuffled
//! with the frozen LCG seeded by the same seed.

use std::collections::{BTreeMap, BTreeSet};

use serde_json::{json, Value};

use crate::puzzle_play::random::{seeded_random, shuffle_array};

const MAX_HINTS: u32 = 3;
const ALPHABET: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// `(text, author, category)`, in the TS order.
const QUOTES: &[(&str, &str, &str)] = &[
    ("The only way to do great work is to love what you do.", "Steve Jobs", "Inspiration"),
    ("In the middle of difficulty lies opportunity.", "Albert Einstein", "Inspiration"),
    ("Be the change you wish to see in the world.", "Mahatma Gandhi", "Inspiration"),
    ("The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt", "Inspiration"),
    ("Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill", "Inspiration"),
    ("The only true wisdom is in knowing you know nothing.", "Socrates", "Wisdom"),
    ("Knowledge speaks, but wisdom listens.", "Jimi Hendrix", "Wisdom"),
    ("The unexamined life is not worth living.", "Socrates", "Wisdom"),
    ("We are what we repeatedly do. Excellence is not an act but a habit.", "Aristotle", "Wisdom"),
    ("To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", "Ralph Waldo Emerson", "Wisdom"),
    ("Imagination is more important than knowledge.", "Albert Einstein", "Science"),
    ("The good thing about science is that it is true whether or not you believe in it.", "Neil deGrasse Tyson", "Science"),
    ("Nothing in life is to be feared, it is only to be understood.", "Marie Curie", "Science"),
    ("The important thing is not to stop questioning.", "Albert Einstein", "Science"),
    ("Science is a way of thinking much more than it is a body of knowledge.", "Carl Sagan", "Science"),
    ("It is never too late to be what you might have been.", "George Eliot", "Literature"),
    ("The only thing we have to fear is fear itself.", "Franklin D. Roosevelt", "Literature"),
    ("To be or not to be, that is the question.", "William Shakespeare", "Literature"),
    ("All that glitters is not gold.", "William Shakespeare", "Literature"),
    ("It was the best of times, it was the worst of times.", "Charles Dickens", "Literature"),
    ("Life is what happens when you are busy making other plans.", "John Lennon", "Life"),
    ("In three words I can sum up everything I have learned about life: it goes on.", "Robert Frost", "Life"),
    ("The purpose of our lives is to be happy.", "Dalai Lama", "Life"),
    ("Life is really simple, but we insist on making it complicated.", "Confucius", "Life"),
    ("Get busy living or get busy dying.", "Stephen King", "Life"),
    ("The secret of getting ahead is getting started.", "Mark Twain", "Success"),
    ("I have not failed. I have just found ten thousand ways that will not work.", "Thomas Edison", "Success"),
    ("It does not matter how slowly you go as long as you do not stop.", "Confucius", "Success"),
    ("The best time to plant a tree was twenty years ago. The second best time is now.", "Chinese Proverb", "Success"),
    ("Do what you can, with what you have, where you are.", "Theodore Roosevelt", "Success"),
    ("Creativity is intelligence having fun.", "Albert Einstein", "Creativity"),
    ("The chief enemy of creativity is good sense.", "Pablo Picasso", "Creativity"),
    ("Every child is an artist. The problem is how to remain an artist once we grow up.", "Pablo Picasso", "Creativity"),
    ("You can not use up creativity. The more you use, the more you have.", "Maya Angelou", "Creativity"),
    ("Creativity takes courage.", "Henri Matisse", "Creativity"),
    ("I think, therefore I am.", "Rene Descartes", "Philosophy"),
    ("The only thing I know is that I know nothing.", "Socrates", "Philosophy"),
    ("Man is condemned to be free.", "Jean-Paul Sartre", "Philosophy"),
    ("Happiness is not something ready made. It comes from your own actions.", "Dalai Lama", "Philosophy"),
    ("He who has a why to live can bear almost any how.", "Friedrich Nietzsche", "Philosophy"),
    ("Courage is not the absence of fear, but rather the judgment that something else is more important than fear.", "Ambrose Redmoon", "Courage"),
    ("You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.", "Eleanor Roosevelt", "Courage"),
    ("Fortune favors the bold.", "Virgil", "Courage"),
    ("Life shrinks or expands in proportion to one's courage.", "Anais Nin", "Courage"),
    ("Have the courage to follow your heart and intuition.", "Steve Jobs", "Courage"),
    ("I am so clever that sometimes I do not understand a single word of what I am saying.", "Oscar Wilde", "Humor"),
    ("The only mystery in life is why the kamikaze pilots wore helmets.", "Al McGuire", "Humor"),
    ("I refuse to join any club that would have me as a member.", "Groucho Marx", "Humor"),
    ("Behind every great man is a woman rolling her eyes.", "Jim Carrey", "Humor"),
    ("A day without sunshine is like, you know, night.", "Steve Martin", "Humor"),
];

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let len = i64::try_from(QUOTES.len()).map_err(|e| e.to_string())?;
    let index = usize::try_from(seed.abs() % len).map_err(|e| e.to_string())?;
    let (text, author, category) = QUOTES
        .get(index)
        .copied()
        .ok_or_else(|| "cryptogram: index out of range".to_string())?;

    let letters: Vec<char> = ALPHABET.chars().collect();
    let shuffled = shuffle_array(&letters, &mut seeded_random(seed));
    let cipher: BTreeMap<char, char> = letters.iter().copied().zip(shuffled).collect();
    let reverse: BTreeMap<char, char> = cipher.iter().map(|(k, v)| (*v, *k)).collect();

    let upper = text.to_ascii_uppercase();
    let encrypted: String = upper
        .chars()
        .map(|c| {
            if c.is_ascii_uppercase() {
                cipher.get(&c).copied().unwrap_or(c)
            } else {
                c
            }
        })
        .collect();
    let unique: BTreeSet<char> = encrypted.chars().filter(char::is_ascii_uppercase).collect();

    let to_json = |map: &BTreeMap<char, char>| -> Value {
        Value::Object(
            map.iter()
                .map(|(k, v)| (k.to_string(), Value::String(v.to_string())))
                .collect(),
        )
    };
    Ok((
        json!({
            "encryptedText": encrypted,
            "author": author,
            "category": category,
            "uniqueLetters": unique.len(),
            "maxHints": MAX_HINTS,
        }),
        json!({
            "originalText": upper,
            "cipher": to_json(&cipher),
            "reverseCipher": to_json(&reverse),
        }),
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check: every encrypted letter guessed right, no hints.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({
        "guesses": solution.get("reverseCipher").cloned().unwrap_or_else(|| json!({})),
        "hintsUsed": 0,
    })
}

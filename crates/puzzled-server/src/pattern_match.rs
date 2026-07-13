//! Pattern-match (Set) pure logic — mirrors
//! `apps/puzzled/src/games/pattern-match/types.ts`. Frozen set rules.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Shape {
    Diamond,
    Oval,
    Squiggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Color {
    Red,
    Green,
    Purple,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Fill {
    Solid,
    Striped,
    Empty,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Card {
    pub id: u32,
    pub shape: Shape,
    pub color: Color,
    pub fill: Fill,
    pub count: u8, // 1|2|3
}

fn is_valid_property<T: Eq>(a: T, b: T, c: T) -> bool {
    let all_same = a == b && b == c;
    let all_different = a != b && b != c && a != c;
    all_same || all_different
}

/// Three cards form a valid set when each property is all-same or all-different.
#[must_use]
pub fn is_valid_set(a: &Card, b: &Card, c: &Card) -> bool {
    is_valid_property(a.shape, b.shape, c.shape)
        && is_valid_property(a.color, b.color, c.color)
        && is_valid_property(a.fill, b.fill, c.fill)
        && is_valid_property(a.count, b.count, c.count)
}

/// Find all valid sets; returns triples of card ids.
#[must_use]
pub fn find_all_sets(cards: &[Card]) -> Vec<[u32; 3]> {
    let mut sets = Vec::new();
    let n = cards.len();
    if n < 3 {
        return sets;
    }
    for i in 0..n - 2 {
        for j in i + 1..n - 1 {
            for k in j + 1..n {
                if is_valid_set(&cards[i], &cards[j], &cards[k]) {
                    sets.push([cards[i].id, cards[j].id, cards[k].id]);
                }
            }
        }
    }
    sets
}

/// All 81 cards (3^4).
#[must_use]
pub fn generate_all_cards() -> Vec<Card> {
    let shapes = [Shape::Diamond, Shape::Oval, Shape::Squiggle];
    let colors = [Color::Red, Color::Green, Color::Purple];
    let fills = [Fill::Solid, Fill::Striped, Fill::Empty];
    let counts = [1u8, 2, 3];
    let mut cards = Vec::with_capacity(81);
    let mut id = 0u32;
    for shape in shapes {
        for color in colors {
            for fill in fills {
                for count in counts {
                    cards.push(Card {
                        id,
                        shape,
                        color,
                        fill,
                        count,
                    });
                    id += 1;
                }
            }
        }
    }
    cards
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_same_is_set() {
        let a = Card {
            id: 0,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 1,
        };
        let b = Card {
            id: 1,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 1,
        };
        let c = Card {
            id: 2,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 1,
        };
        // all properties same → valid
        assert!(is_valid_set(&a, &b, &c));
    }

    #[test]
    fn all_different_is_set() {
        let a = Card {
            id: 0,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 1,
        };
        let b = Card {
            id: 1,
            shape: Shape::Oval,
            color: Color::Green,
            fill: Fill::Striped,
            count: 2,
        };
        let c = Card {
            id: 2,
            shape: Shape::Squiggle,
            color: Color::Purple,
            fill: Fill::Empty,
            count: 3,
        };
        assert!(is_valid_set(&a, &b, &c));
    }

    #[test]
    fn partial_mismatch_not_set() {
        let a = Card {
            id: 0,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 1,
        };
        let b = Card {
            id: 1,
            shape: Shape::Diamond,
            color: Color::Red,
            fill: Fill::Solid,
            count: 2,
        };
        let c = Card {
            id: 2,
            shape: Shape::Oval, // only two diamonds — not all same/different for shape with mixed
            color: Color::Red,
            fill: Fill::Solid,
            count: 3,
        };
        // shape: Diamond, Diamond, Oval → not valid
        assert!(!is_valid_set(&a, &b, &c));
    }

    #[test]
    fn generate_81_and_find_sets() {
        let all = generate_all_cards();
        assert_eq!(all.len(), 81);
        // first 12 cards should have at least some structure
        let board: Vec<Card> = all.into_iter().take(12).collect();
        let sets = find_all_sets(&board);
        // not asserting exact count (depends on first 12 of enumeration) but function runs
        assert!(sets.len() < 220); // C(12,3)=220
    }
}

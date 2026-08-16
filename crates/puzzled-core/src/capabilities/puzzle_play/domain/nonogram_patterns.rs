//! Frozen nonogram pixel-art pool — order matches the TypeScript generator.

pub struct Pattern {
    pub theme: &'static str,
    pub grid: [[bool; 10]; 10],
}

pub const PATTERNS: &[Pattern] = &[
    Pattern {
        theme: "Heart",
        grid: [
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [true, true, true, true, false, false, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Star",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, false, false, false, false, false, false, false, false, true,
            ],
        ],
    },
    Pattern {
        theme: "Moon",
        grid: [
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, true, true, true, true, false, false, false, false, false,
            ],
            [
                false, true, true, true, false, false, false, false, false, false,
            ],
            [
                true, true, true, true, false, false, false, false, false, false,
            ],
            [
                true, true, true, true, false, false, false, false, false, false,
            ],
            [
                false, true, true, true, false, false, false, false, false, false,
            ],
            [
                false, true, true, true, true, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Sun",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                true, false, false, false, true, true, false, false, false, true,
            ],
            [
                false, true, false, true, true, true, true, false, true, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, true, false, true, true, true, true, false, true, false,
            ],
            [
                true, false, false, false, true, true, false, false, false, true,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Lightning",
        grid: [
            [
                false, false, false, false, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, true, true, true, true, false, false, false, false, false,
            ],
            [
                true, true, true, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, false, true, true, false, false, false,
            ],
            [
                false, false, false, false, false, false, true, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Cloud",
        grid: [
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, true, true, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, true, true, true, true, true, false, true, true, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Raindrop",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Smiley",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Wink",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, false, false, true, true],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Sad",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [true, true, false, true, true, true, true, false, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Cool",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, false, false, false, true, true, false, false, false, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Ghost",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                true, false, false, false, true, true, false, false, false, true,
            ],
        ],
    },
    Pattern {
        theme: "Skull",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, false, true, true, false, true, false, false,
            ],
            [
                false, false, true, false, true, true, false, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "House",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
        ],
    },
    Pattern {
        theme: "Castle",
        grid: [
            [
                true, false, true, false, false, false, false, true, false, true,
            ],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [true, true, true, false, true, true, false, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
        ],
    },
    Pattern {
        theme: "Tower",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, false, false, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, false, false, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Church",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                true, true, false, true, false, false, true, false, true, true,
            ],
            [true, true, true, true, false, false, true, true, true, true],
        ],
    },
    Pattern {
        theme: "Tree",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Flower",
        grid: [
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, true, true, false, true, true, false, true, true, false,
            ],
            [true, true, false, true, true, true, true, false, true, true],
            [true, false, true, true, true, true, true, true, false, true],
            [true, false, true, true, true, true, true, true, false, true],
            [true, true, false, true, true, true, true, false, true, true],
            [
                false, true, true, false, true, true, false, true, true, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Mushroom",
        grid: [
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, true, false, true, true, true, true, false, true, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Mountain",
        grid: [
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, false, false, true, false, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, true, false, false, false, false, true, false, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, false, false, false, false, false, false, true, false,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
        ],
    },
    Pattern {
        theme: "Leaf",
        grid: [
            [
                false, false, false, false, false, false, false, false, true, false,
            ],
            [
                false, false, false, false, false, false, true, true, false, false,
            ],
            [
                false, false, true, true, true, true, true, false, false, false,
            ],
            [
                false, true, true, true, true, true, true, false, false, false,
            ],
            [
                true, true, true, true, true, true, false, false, false, false,
            ],
            [
                true, true, true, true, true, false, false, false, false, false,
            ],
            [
                true, true, true, true, false, false, false, false, false, false,
            ],
            [
                false, true, true, false, false, false, false, false, false, false,
            ],
            [
                false, false, true, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Fish",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                true, false, true, true, false, true, true, true, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, false],
            [
                true, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Bird",
        grid: [
            [
                false, false, false, true, true, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, true, true, true, true, true, true, false, false, false,
            ],
            [
                true, true, false, true, true, true, true, true, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, true, true, true, false,
            ],
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, true, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Cat",
        grid: [
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, false, false, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Dog",
        grid: [
            [
                false, true, true, false, false, false, false, false, false, false,
            ],
            [true, true, true, true, true, true, true, true, false, false],
            [
                true, true, false, false, true, true, true, true, true, false,
            ],
            [true, true, false, false, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, false, false],
            [
                false, true, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Bunny",
        grid: [
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Butterfly",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [true, false, true, true, true, true, true, true, false, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, false, true, true, true, true, true, true, false, true],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [
                true, true, false, false, true, true, false, false, true, true,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Arrow",
        grid: [
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, true, true, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, false, false, false, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, true],
            [
                false, false, true, true, true, false, false, false, false, false,
            ],
            [
                false, false, false, true, true, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Cup",
        grid: [
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Umbrella",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Key",
        grid: [
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, true, true, false, false, true, true, false, false, false,
            ],
            [
                false, true, false, false, false, false, true, false, false, false,
            ],
            [
                false, true, true, false, false, true, true, false, false, false,
            ],
            [false, false, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, false, false, true, false, false, false,
            ],
            [
                false, false, false, false, false, false, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, true, false, false, false,
            ],
            [
                false, false, false, false, false, false, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Lock",
        grid: [
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, true, false, false, false, false, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Gift",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Bell",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Crown",
        grid: [
            [
                false, false, true, false, false, false, false, true, false, false,
            ],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, true, false, true, true, true, true, false, true, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Boat",
        grid: [
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, true, false, false,
            ],
            [
                false, false, false, false, true, true, true, true, true, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Car",
        grid: [
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, false, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, true, true, false, false, false, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Plane",
        grid: [
            [
                false, false, false, false, false, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, false, false, false, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Rocket",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, false, false, true, true, true, true, false, false, true,
            ],
            [
                false, false, false, true, false, false, true, false, false, false,
            ],
            [
                false, false, false, true, false, false, true, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "A",
        grid: [
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "X",
        grid: [
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, false, false, true, true, false, false,
            ],
            [
                false, true, true, false, false, false, false, true, true, false,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
        ],
    },
    Pattern {
        theme: "O",
        grid: [
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, true, false, false, false, false, false, false, true, true,
            ],
            [
                true, true, true, false, false, false, false, true, true, true,
            ],
            [
                false, true, true, true, false, false, true, true, true, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "1",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Apple",
        grid: [
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Cake",
        grid: [
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, false, true, false, false, false, false, false,
            ],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [
                true, false, true, false, true, true, false, true, false, true,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Pizza",
        grid: [
            [
                false, false, false, false, false, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, true, false, false, false,
            ],
            [
                false, false, false, true, false, true, false, true, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, true, false,
            ],
            [
                false, true, true, false, true, true, false, true, true, true,
            ],
            [false, true, true, true, true, true, true, true, true, true],
            [true, true, false, true, true, true, true, false, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, false, false, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Plus",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Diamond",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Anchor",
        grid: [
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [true, true, true, true, true, true, true, true, true, true],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, true, false, false, true, true, false, false, true, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
        ],
    },
    Pattern {
        theme: "Hourglass",
        grid: [
            [true, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, false, true, true, false, false, false, false,
            ],
            [
                false, false, false, true, true, true, true, false, false, false,
            ],
            [
                false, false, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [true, true, true, true, true, true, true, true, true, true],
        ],
    },
    Pattern {
        theme: "Flag",
        grid: [
            [
                false, true, true, true, true, true, true, true, false, false,
            ],
            [false, true, true, true, true, true, true, true, true, false],
            [false, true, true, true, true, true, true, true, true, true],
            [false, true, true, true, true, true, true, true, true, false],
            [
                false, true, true, true, true, true, true, true, false, false,
            ],
            [
                false, true, false, false, false, false, false, false, false, false,
            ],
            [
                false, true, false, false, false, false, false, false, false, false,
            ],
            [
                false, true, false, false, false, false, false, false, false, false,
            ],
            [
                false, true, false, false, false, false, false, false, false, false,
            ],
            [
                false, true, false, false, false, false, false, false, false, false,
            ],
        ],
    },
];

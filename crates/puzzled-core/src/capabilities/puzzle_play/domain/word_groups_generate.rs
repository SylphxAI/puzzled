//! Deterministic word-groups generator (free-floor fallback).
//!
//! Mirrors `apps/puzzled/src/games/word-groups/config.ts#generatePuzzle`
//! (curated original bank + frozen LCG shuffle). Used when the content
//! store has no `daily_puzzles` row for the product day — same pattern as
//! sudoku and crossword (RITUAL-AND-MODULE-PROTOCOL allowed fallback).
//!
//! Client payload is the shuffled word list only. Category groupings stay
//! in the server solution and are checked by SubmitGuess.

use serde_json::{json, Value};

use super::random_lcg::{shuffle_array, SeededRandom};
use super::word_groups::{MAX_MISTAKES, TOTAL_CATEGORIES, WORDS_PER_CATEGORY};

struct BankCategory {
    name: &'static str,
    words: [&'static str; WORDS_PER_CATEGORY],
    level: u8,
}

struct BankPuzzle {
    categories: [BankCategory; TOTAL_CATEGORIES],
}

const BANK: &[BankPuzzle] = &[
    BankPuzzle {
        categories: [
            BankCategory {
                name: "FRUITS",
                words: ["APPLE", "BANANA", "ORANGE", "GRAPE"],
                level: 0,
            },
            BankCategory {
                name: "COLORS",
                words: ["RED", "BLUE", "GREEN", "YELLOW"],
                level: 1,
            },
            BankCategory {
                name: "PLANETS",
                words: ["MARS", "VENUS", "SATURN", "JUPITER"],
                level: 2,
            },
            BankCategory {
                name: "CARD SUITS",
                words: ["HEART", "DIAMOND", "CLUB", "SPADE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "PETS",
                words: ["DOG", "CAT", "HAMSTER", "RABBIT"],
                level: 0,
            },
            BankCategory {
                name: "MUSIC GENRES",
                words: ["ROCK", "JAZZ", "POP", "BLUES"],
                level: 1,
            },
            BankCategory {
                name: "BODY PARTS",
                words: ["HEAD", "HAND", "FOOT", "BACK"],
                level: 2,
            },
            BankCategory {
                name: "_____ BOARD",
                words: ["CHALK", "SKATE", "SURF", "SNOW"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BREAKFAST FOODS",
                words: ["BACON", "EGGS", "TOAST", "PANCAKE"],
                level: 0,
            },
            BankCategory {
                name: "TYPES OF DANCE",
                words: ["SALSA", "TANGO", "WALTZ", "SWING"],
                level: 1,
            },
            BankCategory {
                name: "CHESS PIECES",
                words: ["KING", "QUEEN", "ROOK", "KNIGHT"],
                level: 2,
            },
            BankCategory {
                name: "GO ___",
                words: ["FISH", "FIGURE", "BANANAS", "GETTER"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "WEATHER",
                words: ["RAIN", "SNOW", "WIND", "HAIL"],
                level: 0,
            },
            BankCategory {
                name: "SPORTS EQUIPMENT",
                words: ["BALL", "RACKET", "HELMET", "GLOVE"],
                level: 1,
            },
            BankCategory {
                name: "COMPUTER PARTS",
                words: ["MOUSE", "SCREEN", "CHIP", "DRIVE"],
                level: 2,
            },
            BankCategory {
                name: "THINGS WITH KEYS",
                words: ["PIANO", "LOCK", "MAP", "KEYBOARD"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "VEGETABLES",
                words: ["CARROT", "POTATO", "ONION", "PEPPER"],
                level: 0,
            },
            BankCategory {
                name: "MOVIE GENRES",
                words: ["ACTION", "COMEDY", "HORROR", "DRAMA"],
                level: 1,
            },
            BankCategory {
                name: "GREEK LETTERS",
                words: ["ALPHA", "BETA", "GAMMA", "DELTA"],
                level: 2,
            },
            BankCategory {
                name: "THINGS THAT CRASH",
                words: ["WAVE", "PARTY", "STOCK", "SYSTEM"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "COUNTRIES",
                words: ["FRANCE", "JAPAN", "BRAZIL", "EGYPT"],
                level: 0,
            },
            BankCategory {
                name: "PRECIOUS STONES",
                words: ["RUBY", "EMERALD", "SAPPHIRE", "DIAMOND"],
                level: 1,
            },
            BankCategory {
                name: "UNITS OF TIME",
                words: ["SECOND", "MINUTE", "HOUR", "WEEK"],
                level: 2,
            },
            BankCategory {
                name: "_____ JACK",
                words: ["BLACK", "LUMBER", "CRACKER", "FLAP"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "OCEAN CREATURES",
                words: ["SHARK", "WHALE", "DOLPHIN", "OCTOPUS"],
                level: 0,
            },
            BankCategory {
                name: "MUSICAL INSTRUMENTS",
                words: ["GUITAR", "PIANO", "VIOLIN", "DRUMS"],
                level: 1,
            },
            BankCategory {
                name: "OLYMPIC SPORTS",
                words: ["SWIMMING", "FENCING", "ARCHERY", "DIVING"],
                level: 2,
            },
            BankCategory {
                name: "TYPES OF SHOT",
                words: ["MOON", "CHEAP", "LONG", "SNAP"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "CITRUS FRUITS",
                words: ["LEMON", "LIME", "GRAPEFRUIT", "TANGERINE"],
                level: 0,
            },
            BankCategory {
                name: "CAR BRANDS",
                words: ["FORD", "HONDA", "TOYOTA", "BMW"],
                level: 1,
            },
            BankCategory {
                name: "ELEMENTS",
                words: ["GOLD", "SILVER", "IRON", "COPPER"],
                level: 2,
            },
            BankCategory {
                name: "WORDS BEFORE \"HOUSE\"",
                words: ["WHITE", "GREEN", "POWER", "DOG"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "DESSERTS",
                words: ["CAKE", "PIE", "COOKIE", "BROWNIE"],
                level: 0,
            },
            BankCategory {
                name: "SOCIAL MEDIA",
                words: ["TWITTER", "FACEBOOK", "INSTAGRAM", "TIKTOK"],
                level: 1,
            },
            BankCategory {
                name: "CARD GAMES",
                words: ["POKER", "BRIDGE", "RUMMY", "BLACKJACK"],
                level: 2,
            },
            BankCategory {
                name: "WORDS WITH DOUBLE O",
                words: ["MOON", "BOOK", "FOOT", "COOL"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "KITCHEN APPLIANCES",
                words: ["OVEN", "BLENDER", "TOASTER", "MICROWAVE"],
                level: 0,
            },
            BankCategory {
                name: "SUPERHEROES",
                words: ["BATMAN", "SUPERMAN", "SPIDERMAN", "IRONMAN"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF BREAD",
                words: ["SOURDOUGH", "BAGUETTE", "CIABATTA", "BRIOCHE"],
                level: 2,
            },
            BankCategory {
                name: "_____ LIGHT",
                words: ["FLASH", "HIGH", "SPOT", "LIME"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "FLOWERS",
                words: ["ROSE", "TULIP", "DAISY", "LILY"],
                level: 0,
            },
            BankCategory {
                name: "PIZZA TOPPINGS",
                words: ["PEPPERONI", "MUSHROOM", "OLIVE", "SAUSAGE"],
                level: 1,
            },
            BankCategory {
                name: "SHAKESPEARE PLAYS",
                words: ["HAMLET", "OTHELLO", "MACBETH", "TEMPEST"],
                level: 2,
            },
            BankCategory {
                name: "THINGS THAT ARE CUT",
                words: ["DEAL", "CORNER", "CLASS", "RUG"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SEASONS",
                words: ["SPRING", "SUMMER", "FALL", "WINTER"],
                level: 0,
            },
            BankCategory {
                name: "US STATES",
                words: ["TEXAS", "FLORIDA", "ALASKA", "CALIFORNIA"],
                level: 1,
            },
            BankCategory {
                name: "POKER TERMS",
                words: ["FOLD", "RAISE", "CALL", "BLUFF"],
                level: 2,
            },
            BankCategory {
                name: "COLD _____",
                words: ["TURKEY", "SHOULDER", "FEET", "CASE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BEVERAGES",
                words: ["COFFEE", "TEA", "JUICE", "SODA"],
                level: 0,
            },
            BankCategory {
                name: "DOG BREEDS",
                words: ["POODLE", "BEAGLE", "BULLDOG", "HUSKY"],
                level: 1,
            },
            BankCategory {
                name: "SPACE TERMS",
                words: ["ORBIT", "GALAXY", "ASTEROID", "COMET"],
                level: 2,
            },
            BankCategory {
                name: "THINGS WITH RINGS",
                words: ["SATURN", "TREE", "PHONE", "CIRCUS"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "FOOTWEAR",
                words: ["BOOTS", "SNEAKERS", "SANDALS", "HEELS"],
                level: 0,
            },
            BankCategory {
                name: "CURRENCIES",
                words: ["DOLLAR", "EURO", "YEN", "POUND"],
                level: 1,
            },
            BankCategory {
                name: "MAGIC WORDS",
                words: ["ABRACADABRA", "PRESTO", "ALAKAZAM", "HOCUS"],
                level: 2,
            },
            BankCategory {
                name: "TYPES OF POOL",
                words: ["CAR", "GENE", "SWIMMING", "TYPING"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "NUTS",
                words: ["ALMOND", "WALNUT", "CASHEW", "PECAN"],
                level: 0,
            },
            BankCategory {
                name: "STREAMING SERVICES",
                words: ["NETFLIX", "HULU", "DISNEY", "AMAZON"],
                level: 1,
            },
            BankCategory {
                name: "WIND INSTRUMENTS",
                words: ["FLUTE", "CLARINET", "SAXOPHONE", "TRUMPET"],
                level: 2,
            },
            BankCategory {
                name: "BREAK A _____",
                words: ["LEG", "SWEAT", "RECORD", "PROMISE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "TROPICAL FRUITS",
                words: ["MANGO", "PAPAYA", "COCONUT", "PINEAPPLE"],
                level: 0,
            },
            BankCategory {
                name: "BOARD GAMES",
                words: ["CHESS", "MONOPOLY", "SCRABBLE", "CLUE"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF WAVES",
                words: ["RADIO", "SOUND", "BRAIN", "HEAT"],
                level: 2,
            },
            BankCategory {
                name: "_____ BALL",
                words: ["BASE", "VOLLEY", "BASKET", "SNOW"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "FAST FOOD CHAINS",
                words: ["MCDONALDS", "WENDYS", "SUBWAY", "TACO"],
                level: 0,
            },
            BankCategory {
                name: "MYTHICAL CREATURES",
                words: ["DRAGON", "UNICORN", "PHOENIX", "GRIFFIN"],
                level: 1,
            },
            BankCategory {
                name: "FILM NOIR ELEMENTS",
                words: ["SHADOW", "FEMME", "SMOKE", "RAIN"],
                level: 2,
            },
            BankCategory {
                name: "RED _____",
                words: ["CARPET", "HERRING", "FLAG", "TAPE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "DAIRY PRODUCTS",
                words: ["MILK", "CHEESE", "YOGURT", "BUTTER"],
                level: 0,
            },
            BankCategory {
                name: "ZODIAC SIGNS",
                words: ["LEO", "VIRGO", "ARIES", "TAURUS"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF TRIANGLE",
                words: ["RIGHT", "ACUTE", "OBTUSE", "SCALENE"],
                level: 2,
            },
            BankCategory {
                name: "_____ MARKET",
                words: ["SUPER", "FLEA", "STOCK", "BLACK"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "ASIAN CUISINES",
                words: ["SUSHI", "PHO", "CURRY", "DIMSUM"],
                level: 0,
            },
            BankCategory {
                name: "VIDEO GAME CONSOLES",
                words: ["PLAYSTATION", "XBOX", "NINTENDO", "SEGA"],
                level: 1,
            },
            BankCategory {
                name: "ART MOVEMENTS",
                words: ["BAROQUE", "CUBISM", "SURREALISM", "IMPRESSIONISM"],
                level: 2,
            },
            BankCategory {
                name: "THINGS WITH TAILS",
                words: ["MONKEY", "COAT", "FAIRY", "COCKTAIL"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "OFFICE SUPPLIES",
                words: ["STAPLER", "PENCIL", "SCISSORS", "TAPE"],
                level: 0,
            },
            BankCategory {
                name: "HARRY POTTER HOUSES",
                words: ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"],
                level: 1,
            },
            BankCategory {
                name: "CHEMICAL COMPOUNDS",
                words: ["WATER", "SALT", "SUGAR", "ALCOHOL"],
                level: 2,
            },
            BankCategory {
                name: "FULL _____",
                words: ["MOON", "HOUSE", "CIRCLE", "STEAM"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "TREES",
                words: ["OAK", "MAPLE", "PINE", "BIRCH"],
                level: 0,
            },
            BankCategory {
                name: "PROGRAMMING LANGUAGES",
                words: ["PYTHON", "JAVA", "RUBY", "SWIFT"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF CHEESE",
                words: ["CHEDDAR", "BRIE", "GOUDA", "PARMESAN"],
                level: 2,
            },
            BankCategory {
                name: "_____ WORK",
                words: ["FRAME", "FIRE", "DREAM", "NET"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BIRDS",
                words: ["EAGLE", "HAWK", "OWL", "FALCON"],
                level: 0,
            },
            BankCategory {
                name: "PASTA SHAPES",
                words: ["PENNE", "SPAGHETTI", "FUSILLI", "RIGATONI"],
                level: 1,
            },
            BankCategory {
                name: "POKER HANDS",
                words: ["FLUSH", "STRAIGHT", "PAIR", "FULL"],
                level: 2,
            },
            BankCategory {
                name: "WILD _____",
                words: ["CARD", "WEST", "FIRE", "GOOSE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "CONSTRUCTION TOOLS",
                words: ["HAMMER", "SAW", "DRILL", "WRENCH"],
                level: 0,
            },
            BankCategory {
                name: "DISNEY PRINCESSES",
                words: ["ARIEL", "BELLE", "JASMINE", "MULAN"],
                level: 1,
            },
            BankCategory {
                name: "WINE TYPES",
                words: ["MERLOT", "CABERNET", "PINOT", "CHARDONNAY"],
                level: 2,
            },
            BankCategory {
                name: "DOUBLE _____",
                words: ["DUTCH", "CHECK", "TAKE", "AGENT"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "CANDY",
                words: ["CHOCOLATE", "GUMMY", "LOLLIPOP", "CARAMEL"],
                level: 0,
            },
            BankCategory {
                name: "FAMOUS SCIENTISTS",
                words: ["EINSTEIN", "NEWTON", "DARWIN", "CURIE"],
                level: 1,
            },
            BankCategory {
                name: "POKER ACTIONS",
                words: ["BET", "CHECK", "RAISE", "FOLD"],
                level: 2,
            },
            BankCategory {
                name: "THINGS THAT ARE STRUCK",
                words: ["LIGHTNING", "DEAL", "POSE", "NERVE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "CAMPING GEAR",
                words: ["TENT", "SLEEPING", "LANTERN", "COMPASS"],
                level: 0,
            },
            BankCategory {
                name: "SMARTPHONE BRANDS",
                words: ["APPLE", "SAMSUNG", "GOOGLE", "ONEPLUS"],
                level: 1,
            },
            BankCategory {
                name: "POKER VARIANTS",
                words: ["TEXAS", "OMAHA", "STUD", "DRAW"],
                level: 2,
            },
            BankCategory {
                name: "FIRE _____",
                words: ["FIGHTER", "FLY", "PLACE", "ARM"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "CLEANING PRODUCTS",
                words: ["SOAP", "BLEACH", "DETERGENT", "SPONGE"],
                level: 0,
            },
            BankCategory {
                name: "MARVEL AVENGERS",
                words: ["THOR", "HULK", "WIDOW", "HAWKEYE"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF ENERGY",
                words: ["SOLAR", "WIND", "NUCLEAR", "HYDRO"],
                level: 2,
            },
            BankCategory {
                name: "HOT _____",
                words: ["DOG", "SHOT", "POTATO", "TUB"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "PIZZA TYPES",
                words: ["PEPPERONI", "MARGHERITA", "HAWAIIAN", "SUPREME"],
                level: 0,
            },
            BankCategory {
                name: "ANCIENT CIVILIZATIONS",
                words: ["ROMAN", "GREEK", "EGYPTIAN", "MAYAN"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF BANK",
                words: ["BLOOD", "MEMORY", "FOOD", "RIVER"],
                level: 2,
            },
            BankCategory {
                name: "SWEET _____",
                words: ["TOOTH", "TALK", "HEART", "SIXTEEN"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BREAKFAST DRINKS",
                words: ["COFFEE", "ORANGE", "MILK", "TEA"],
                level: 0,
            },
            BankCategory {
                name: "ROCK BANDS",
                words: ["QUEEN", "ACDC", "METALLICA", "NIRVANA"],
                level: 1,
            },
            BankCategory {
                name: "CARD GAME TERMS",
                words: ["TRUMP", "TRICK", "HAND", "DECK"],
                level: 2,
            },
            BankCategory {
                name: "BIG _____",
                words: ["BANG", "APPLE", "FOOT", "DEAL"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "WINTER SPORTS",
                words: ["SKIING", "HOCKEY", "SKATING", "CURLING"],
                level: 0,
            },
            BankCategory {
                name: "COFFEE DRINKS",
                words: ["ESPRESSO", "LATTE", "CAPPUCCINO", "MOCHA"],
                level: 1,
            },
            BankCategory {
                name: "GRAMMAR TERMS",
                words: ["NOUN", "VERB", "ADJECTIVE", "ADVERB"],
                level: 2,
            },
            BankCategory {
                name: "BLIND _____",
                words: ["DATE", "SPOT", "FOLD", "SIDE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SALAD INGREDIENTS",
                words: ["LETTUCE", "TOMATO", "CUCUMBER", "CROUTON"],
                level: 0,
            },
            BankCategory {
                name: "JAMES BOND ACTORS",
                words: ["CONNERY", "MOORE", "BROSNAN", "CRAIG"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF TEST",
                words: ["BLOOD", "DRIVING", "STRESS", "LITMUS"],
                level: 2,
            },
            BankCategory {
                name: "SHORT _____",
                words: ["CIRCUIT", "CUT", "HAND", "CHANGE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "HERBS",
                words: ["BASIL", "MINT", "OREGANO", "THYME"],
                level: 0,
            },
            BankCategory {
                name: "STAR WARS CHARACTERS",
                words: ["LUKE", "VADER", "YODA", "LEIA"],
                level: 1,
            },
            BankCategory {
                name: "MUSIC TEMPOS",
                words: ["ALLEGRO", "ADAGIO", "PRESTO", "LARGO"],
                level: 2,
            },
            BankCategory {
                name: "BRAIN _____",
                words: ["STORM", "WASH", "FREEZE", "DEAD"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SUSHI TYPES",
                words: ["NIGIRI", "SASHIMI", "MAKI", "TEMAKI"],
                level: 0,
            },
            BankCategory {
                name: "BOND GIRLS",
                words: ["HONEY", "OCTOPUSSY", "JINX", "VESPER"],
                level: 1,
            },
            BankCategory {
                name: "CLOUD TYPES",
                words: ["CUMULUS", "STRATUS", "CIRRUS", "NIMBUS"],
                level: 2,
            },
            BankCategory {
                name: "GOLDEN _____",
                words: ["GATE", "RETRIEVER", "RULE", "AGE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SOUP TYPES",
                words: ["TOMATO", "CHICKEN", "MINESTRONE", "CLAM"],
                level: 0,
            },
            BankCategory {
                name: "LORD OF THE RINGS",
                words: ["FRODO", "GANDALF", "ARAGORN", "LEGOLAS"],
                level: 1,
            },
            BankCategory {
                name: "MEASUREMENT UNITS",
                words: ["METER", "GRAM", "LITER", "KELVIN"],
                level: 2,
            },
            BankCategory {
                name: "POWER _____",
                words: ["PLANT", "POINT", "PLAY", "NAP"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "ICE CREAM FLAVORS",
                words: ["VANILLA", "CHOCOLATE", "STRAWBERRY", "MINT"],
                level: 0,
            },
            BankCategory {
                name: "GREEK GODS",
                words: ["ZEUS", "POSEIDON", "HADES", "APOLLO"],
                level: 1,
            },
            BankCategory {
                name: "LEGAL TERMS",
                words: ["PLAINTIFF", "DEFENDANT", "VERDICT", "APPEAL"],
                level: 2,
            },
            BankCategory {
                name: "BLACK _____",
                words: ["FRIDAY", "SHEEP", "MARKET", "HOLE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BERRIES",
                words: ["BLUEBERRY", "RASPBERRY", "BLACKBERRY", "STRAWBERRY"],
                level: 0,
            },
            BankCategory {
                name: "FRIENDS CHARACTERS",
                words: ["ROSS", "RACHEL", "MONICA", "CHANDLER"],
                level: 1,
            },
            BankCategory {
                name: "TYPES OF ROCK",
                words: ["IGNEOUS", "SEDIMENTARY", "METAMORPHIC", "VOLCANIC"],
                level: 2,
            },
            BankCategory {
                name: "PAPER _____",
                words: ["WORK", "BACK", "CLIP", "WEIGHT"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SANDWICH TYPES",
                words: ["BLT", "CLUB", "REUBEN", "GRILLED"],
                level: 0,
            },
            BankCategory {
                name: "PIXAR MOVIES",
                words: ["TOY", "FINDING", "MONSTERS", "CARS"],
                level: 1,
            },
            BankCategory {
                name: "POKER CHIPS",
                words: ["WHITE", "RED", "GREEN", "BLACK"],
                level: 2,
            },
            BankCategory {
                name: "MIND _____",
                words: ["READER", "BLOWING", "GAME", "FIELD"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "MEXICAN FOOD",
                words: ["TACO", "BURRITO", "QUESADILLA", "ENCHILADA"],
                level: 0,
            },
            BankCategory {
                name: "MARVEL VILLAINS",
                words: ["THANOS", "LOKI", "ULTRON", "MAGNETO"],
                level: 1,
            },
            BankCategory {
                name: "BALLET TERMS",
                words: ["PLIÉ", "PIROUETTE", "ARABESQUE", "JETÉ"],
                level: 2,
            },
            BankCategory {
                name: "FACE _____",
                words: ["TIME", "VALUE", "PALM", "LIFT"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "BARBECUE ITEMS",
                words: ["RIBS", "BRISKET", "SAUSAGE", "CHICKEN"],
                level: 0,
            },
            BankCategory {
                name: "DC HEROES",
                words: ["SUPERMAN", "BATMAN", "WONDER", "AQUAMAN"],
                level: 1,
            },
            BankCategory {
                name: "PERIODIC TABLE GROUPS",
                words: ["NOBLE", "ALKALI", "HALOGEN", "METAL"],
                level: 2,
            },
            BankCategory {
                name: "HAND _____",
                words: ["SHAKE", "OUT", "MADE", "BOOK"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "SEAFOOD",
                words: ["SHRIMP", "LOBSTER", "CRAB", "OYSTER"],
                level: 0,
            },
            BankCategory {
                name: "NINTENDO CHARACTERS",
                words: ["MARIO", "LINK", "KIRBY", "PIKACHU"],
                level: 1,
            },
            BankCategory {
                name: "WEATHER PHENOMENA",
                words: ["TORNADO", "HURRICANE", "TSUNAMI", "EARTHQUAKE"],
                level: 2,
            },
            BankCategory {
                name: "BACK _____",
                words: ["DOOR", "FIRE", "TRACK", "BONE"],
                level: 3,
            },
        ],
    },
    BankPuzzle {
        categories: [
            BankCategory {
                name: "ITALIAN FOOD",
                words: ["PIZZA", "PASTA", "RISOTTO", "LASAGNA"],
                level: 0,
            },
            BankCategory {
                name: "GAME OF THRONES HOUSES",
                words: ["STARK", "LANNISTER", "TARGARYEN", "BARATHEON"],
                level: 1,
            },
            BankCategory {
                name: "ORCHESTRA SECTIONS",
                words: ["STRING", "BRASS", "WOODWIND", "PERCUSSION"],
                level: 2,
            },
            BankCategory {
                name: "RUNNING _____",
                words: ["MATE", "WATER", "START", "JOKE"],
                level: 3,
            },
        ],
    },
];

/// Deterministic daily word-groups: (client-safe puzzle_data, solution).
#[must_use]
pub fn generate_word_groups_puzzle(seed: i64) -> (Value, Value) {
    let idx = seed.unsigned_abs() as usize % BANK.len();
    let puzzle = &BANK[idx];
    let mut words = Vec::with_capacity(TOTAL_CATEGORIES * WORDS_PER_CATEGORY);
    let mut categories = Vec::with_capacity(TOTAL_CATEGORIES);
    for cat in &puzzle.categories {
        words.extend(cat.words.iter().copied().map(str::to_string));
        categories.push(json!({
            "name": cat.name,
            "words": cat.words,
            "level": cat.level,
        }));
    }
    let rng_seed = u32::try_from(seed.unsigned_abs()).unwrap_or(u32::MAX);
    let mut rng = SeededRandom::new(rng_seed);
    let shuffled = shuffle_array(&words, &mut rng);
    let puzzle_data = json!({
        "words": shuffled,
        "maxMistakes": MAX_MISTAKES,
        "wordsPerCategory": WORDS_PER_CATEGORY,
        "totalCategories": TOTAL_CATEGORIES,
    });
    (puzzle_data, json!({ "categories": categories }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_is_deterministic() {
        let (a, sa) = generate_word_groups_puzzle(956);
        let (b, sb) = generate_word_groups_puzzle(956);
        assert_eq!(a, b);
        assert_eq!(sa, sb);
    }

    #[test]
    fn client_payload_is_sixteen_words_without_groupings() {
        let (pd, sol) = generate_word_groups_puzzle(1);
        let words = pd.get("words").and_then(|v| v.as_array()).expect("words");
        assert_eq!(words.len(), 16);
        assert!(pd.get("categories").is_none());
        assert!(pd.get("solution").is_none());
        assert_eq!(pd["maxMistakes"], MAX_MISTAKES);
        let cats = sol
            .get("categories")
            .and_then(|v| v.as_array())
            .expect("cats");
        assert_eq!(cats.len(), 4);
        let mut from_sol = Vec::new();
        for cat in cats {
            let ws = cat.get("words").and_then(|v| v.as_array()).expect("w");
            assert_eq!(ws.len(), 4);
            from_sol.extend(ws.iter().filter_map(Value::as_str).map(str::to_string));
        }
        let mut from_pd: Vec<String> = words
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect();
        from_pd.sort();
        from_sol.sort();
        assert_eq!(from_pd, from_sol);
    }

    #[test]
    fn bank_covers_forty_original_puzzles() {
        assert_eq!(BANK.len(), 40);
    }
}

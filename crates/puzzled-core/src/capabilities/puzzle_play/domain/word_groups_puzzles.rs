//! Frozen word-groups pool — parity with `apps/puzzled/src/games/word-groups/puzzles.ts`.

pub struct WordGroupsPuzzle {
    pub categories: [CategoryStatic; 4],
}

pub struct CategoryStatic {
    pub name: &'static str,
    pub words: &'static [&'static str],
    pub level: u8,
}

pub const PUZZLES: &[WordGroupsPuzzle] = &[
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "FRUITS",
                words: &["APPLE", "BANANA", "ORANGE", "GRAPE"],
                level: 0,
            },
            CategoryStatic {
                name: "COLORS",
                words: &["RED", "BLUE", "GREEN", "YELLOW"],
                level: 1,
            },
            CategoryStatic {
                name: "PLANETS",
                words: &["MARS", "VENUS", "SATURN", "JUPITER"],
                level: 2,
            },
            CategoryStatic {
                name: "CARD SUITS",
                words: &["HEART", "DIAMOND", "CLUB", "SPADE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "PETS",
                words: &["DOG", "CAT", "HAMSTER", "RABBIT"],
                level: 0,
            },
            CategoryStatic {
                name: "MUSIC GENRES",
                words: &["ROCK", "JAZZ", "POP", "BLUES"],
                level: 1,
            },
            CategoryStatic {
                name: "BODY PARTS",
                words: &["HEAD", "HAND", "FOOT", "BACK"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ BOARD",
                words: &["CHALK", "SKATE", "SURF", "SNOW"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BREAKFAST FOODS",
                words: &["BACON", "EGGS", "TOAST", "PANCAKE"],
                level: 0,
            },
            CategoryStatic {
                name: "TYPES OF DANCE",
                words: &["SALSA", "TANGO", "WALTZ", "SWING"],
                level: 1,
            },
            CategoryStatic {
                name: "CHESS PIECES",
                words: &["KING", "QUEEN", "ROOK", "KNIGHT"],
                level: 2,
            },
            CategoryStatic {
                name: "GO ___",
                words: &["FISH", "FIGURE", "BANANAS", "GETTER"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "WEATHER",
                words: &["RAIN", "SNOW", "WIND", "HAIL"],
                level: 0,
            },
            CategoryStatic {
                name: "SPORTS EQUIPMENT",
                words: &["BALL", "RACKET", "HELMET", "GLOVE"],
                level: 1,
            },
            CategoryStatic {
                name: "COMPUTER PARTS",
                words: &["MOUSE", "SCREEN", "CHIP", "DRIVE"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS WITH KEYS",
                words: &["PIANO", "LOCK", "MAP", "KEYBOARD"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "VEGETABLES",
                words: &["CARROT", "POTATO", "ONION", "PEPPER"],
                level: 0,
            },
            CategoryStatic {
                name: "MOVIE GENRES",
                words: &["ACTION", "COMEDY", "HORROR", "DRAMA"],
                level: 1,
            },
            CategoryStatic {
                name: "GREEK LETTERS",
                words: &["ALPHA", "BETA", "GAMMA", "DELTA"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS THAT CRASH",
                words: &["WAVE", "PARTY", "STOCK", "SYSTEM"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "COUNTRIES",
                words: &["FRANCE", "JAPAN", "BRAZIL", "EGYPT"],
                level: 0,
            },
            CategoryStatic {
                name: "PRECIOUS STONES",
                words: &["RUBY", "EMERALD", "SAPPHIRE", "DIAMOND"],
                level: 1,
            },
            CategoryStatic {
                name: "UNITS OF TIME",
                words: &["SECOND", "MINUTE", "HOUR", "WEEK"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ JACK",
                words: &["BLACK", "LUMBER", "CRACKER", "FLAP"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "OCEAN CREATURES",
                words: &["SHARK", "WHALE", "DOLPHIN", "OCTOPUS"],
                level: 0,
            },
            CategoryStatic {
                name: "MUSICAL INSTRUMENTS",
                words: &["GUITAR", "PIANO", "VIOLIN", "DRUMS"],
                level: 1,
            },
            CategoryStatic {
                name: "OLYMPIC SPORTS",
                words: &["SWIMMING", "FENCING", "ARCHERY", "DIVING"],
                level: 2,
            },
            CategoryStatic {
                name: "TYPES OF SHOT",
                words: &["MOON", "CHEAP", "LONG", "SNAP"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "CITRUS FRUITS",
                words: &["LEMON", "LIME", "GRAPEFRUIT", "TANGERINE"],
                level: 0,
            },
            CategoryStatic {
                name: "CAR BRANDS",
                words: &["FORD", "HONDA", "TOYOTA", "BMW"],
                level: 1,
            },
            CategoryStatic {
                name: "ELEMENTS",
                words: &["GOLD", "SILVER", "IRON", "COPPER"],
                level: 2,
            },
            CategoryStatic {
                name: "WORDS BEFORE \"HOUSE\"",
                words: &["WHITE", "GREEN", "POWER", "DOG"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "DESSERTS",
                words: &["CAKE", "PIE", "COOKIE", "BROWNIE"],
                level: 0,
            },
            CategoryStatic {
                name: "SOCIAL MEDIA",
                words: &["TWITTER", "FACEBOOK", "INSTAGRAM", "TIKTOK"],
                level: 1,
            },
            CategoryStatic {
                name: "CARD GAMES",
                words: &["POKER", "BRIDGE", "RUMMY", "BLACKJACK"],
                level: 2,
            },
            CategoryStatic {
                name: "WORDS WITH DOUBLE O",
                words: &["MOON", "BOOK", "FOOT", "COOL"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "KITCHEN APPLIANCES",
                words: &["OVEN", "BLENDER", "TOASTER", "MICROWAVE"],
                level: 0,
            },
            CategoryStatic {
                name: "SUPERHEROES",
                words: &["BATMAN", "SUPERMAN", "SPIDERMAN", "IRONMAN"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF BREAD",
                words: &["SOURDOUGH", "BAGUETTE", "CIABATTA", "BRIOCHE"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ LIGHT",
                words: &["FLASH", "HIGH", "SPOT", "LIME"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "FLOWERS",
                words: &["ROSE", "TULIP", "DAISY", "LILY"],
                level: 0,
            },
            CategoryStatic {
                name: "PIZZA TOPPINGS",
                words: &["PEPPERONI", "MUSHROOM", "OLIVE", "SAUSAGE"],
                level: 1,
            },
            CategoryStatic {
                name: "SHAKESPEARE PLAYS",
                words: &["HAMLET", "OTHELLO", "MACBETH", "TEMPEST"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS THAT ARE CUT",
                words: &["DEAL", "CORNER", "CLASS", "RUG"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SEASONS",
                words: &["SPRING", "SUMMER", "FALL", "WINTER"],
                level: 0,
            },
            CategoryStatic {
                name: "US STATES",
                words: &["TEXAS", "FLORIDA", "ALASKA", "CALIFORNIA"],
                level: 1,
            },
            CategoryStatic {
                name: "POKER TERMS",
                words: &["FOLD", "RAISE", "CALL", "BLUFF"],
                level: 2,
            },
            CategoryStatic {
                name: "COLD _____",
                words: &["TURKEY", "SHOULDER", "FEET", "CASE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BEVERAGES",
                words: &["COFFEE", "TEA", "JUICE", "SODA"],
                level: 0,
            },
            CategoryStatic {
                name: "DOG BREEDS",
                words: &["POODLE", "BEAGLE", "BULLDOG", "HUSKY"],
                level: 1,
            },
            CategoryStatic {
                name: "SPACE TERMS",
                words: &["ORBIT", "GALAXY", "ASTEROID", "COMET"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS WITH RINGS",
                words: &["SATURN", "TREE", "PHONE", "CIRCUS"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "FOOTWEAR",
                words: &["BOOTS", "SNEAKERS", "SANDALS", "HEELS"],
                level: 0,
            },
            CategoryStatic {
                name: "CURRENCIES",
                words: &["DOLLAR", "EURO", "YEN", "POUND"],
                level: 1,
            },
            CategoryStatic {
                name: "MAGIC WORDS",
                words: &["ABRACADABRA", "PRESTO", "ALAKAZAM", "HOCUS"],
                level: 2,
            },
            CategoryStatic {
                name: "TYPES OF POOL",
                words: &["CAR", "GENE", "SWIMMING", "TYPING"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "NUTS",
                words: &["ALMOND", "WALNUT", "CASHEW", "PECAN"],
                level: 0,
            },
            CategoryStatic {
                name: "STREAMING SERVICES",
                words: &["NETFLIX", "HULU", "DISNEY", "AMAZON"],
                level: 1,
            },
            CategoryStatic {
                name: "WIND INSTRUMENTS",
                words: &["FLUTE", "CLARINET", "SAXOPHONE", "TRUMPET"],
                level: 2,
            },
            CategoryStatic {
                name: "BREAK A _____",
                words: &["LEG", "SWEAT", "RECORD", "PROMISE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "TROPICAL FRUITS",
                words: &["MANGO", "PAPAYA", "COCONUT", "PINEAPPLE"],
                level: 0,
            },
            CategoryStatic {
                name: "BOARD GAMES",
                words: &["CHESS", "MONOPOLY", "SCRABBLE", "CLUE"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF WAVES",
                words: &["RADIO", "SOUND", "BRAIN", "HEAT"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ BALL",
                words: &["BASE", "VOLLEY", "BASKET", "SNOW"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "FAST FOOD CHAINS",
                words: &["MCDONALDS", "WENDYS", "SUBWAY", "TACO"],
                level: 0,
            },
            CategoryStatic {
                name: "MYTHICAL CREATURES",
                words: &["DRAGON", "UNICORN", "PHOENIX", "GRIFFIN"],
                level: 1,
            },
            CategoryStatic {
                name: "FILM NOIR ELEMENTS",
                words: &["SHADOW", "FEMME", "SMOKE", "RAIN"],
                level: 2,
            },
            CategoryStatic {
                name: "RED _____",
                words: &["CARPET", "HERRING", "FLAG", "TAPE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "DAIRY PRODUCTS",
                words: &["MILK", "CHEESE", "YOGURT", "BUTTER"],
                level: 0,
            },
            CategoryStatic {
                name: "ZODIAC SIGNS",
                words: &["LEO", "VIRGO", "ARIES", "TAURUS"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF TRIANGLE",
                words: &["RIGHT", "ACUTE", "OBTUSE", "SCALENE"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ MARKET",
                words: &["SUPER", "FLEA", "STOCK", "BLACK"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "ASIAN CUISINES",
                words: &["SUSHI", "PHO", "CURRY", "DIMSUM"],
                level: 0,
            },
            CategoryStatic {
                name: "VIDEO GAME CONSOLES",
                words: &["PLAYSTATION", "XBOX", "NINTENDO", "SEGA"],
                level: 1,
            },
            CategoryStatic {
                name: "ART MOVEMENTS",
                words: &["BAROQUE", "CUBISM", "SURREALISM", "IMPRESSIONISM"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS WITH TAILS",
                words: &["MONKEY", "COAT", "FAIRY", "COCKTAIL"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "OFFICE SUPPLIES",
                words: &["STAPLER", "PENCIL", "SCISSORS", "TAPE"],
                level: 0,
            },
            CategoryStatic {
                name: "HARRY POTTER HOUSES",
                words: &["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"],
                level: 1,
            },
            CategoryStatic {
                name: "CHEMICAL COMPOUNDS",
                words: &["WATER", "SALT", "SUGAR", "ALCOHOL"],
                level: 2,
            },
            CategoryStatic {
                name: "FULL _____",
                words: &["MOON", "HOUSE", "CIRCLE", "STEAM"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "TREES",
                words: &["OAK", "MAPLE", "PINE", "BIRCH"],
                level: 0,
            },
            CategoryStatic {
                name: "PROGRAMMING LANGUAGES",
                words: &["PYTHON", "JAVA", "RUBY", "SWIFT"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF CHEESE",
                words: &["CHEDDAR", "BRIE", "GOUDA", "PARMESAN"],
                level: 2,
            },
            CategoryStatic {
                name: "_____ WORK",
                words: &["FRAME", "FIRE", "DREAM", "NET"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BIRDS",
                words: &["EAGLE", "HAWK", "OWL", "FALCON"],
                level: 0,
            },
            CategoryStatic {
                name: "PASTA SHAPES",
                words: &["PENNE", "SPAGHETTI", "FUSILLI", "RIGATONI"],
                level: 1,
            },
            CategoryStatic {
                name: "POKER HANDS",
                words: &["FLUSH", "STRAIGHT", "PAIR", "FULL"],
                level: 2,
            },
            CategoryStatic {
                name: "WILD _____",
                words: &["CARD", "WEST", "FIRE", "GOOSE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "CONSTRUCTION TOOLS",
                words: &["HAMMER", "SAW", "DRILL", "WRENCH"],
                level: 0,
            },
            CategoryStatic {
                name: "DISNEY PRINCESSES",
                words: &["ARIEL", "BELLE", "JASMINE", "MULAN"],
                level: 1,
            },
            CategoryStatic {
                name: "WINE TYPES",
                words: &["MERLOT", "CABERNET", "PINOT", "CHARDONNAY"],
                level: 2,
            },
            CategoryStatic {
                name: "DOUBLE _____",
                words: &["DUTCH", "CHECK", "TAKE", "AGENT"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "CANDY",
                words: &["CHOCOLATE", "GUMMY", "LOLLIPOP", "CARAMEL"],
                level: 0,
            },
            CategoryStatic {
                name: "FAMOUS SCIENTISTS",
                words: &["EINSTEIN", "NEWTON", "DARWIN", "CURIE"],
                level: 1,
            },
            CategoryStatic {
                name: "POKER ACTIONS",
                words: &["BET", "CHECK", "RAISE", "FOLD"],
                level: 2,
            },
            CategoryStatic {
                name: "THINGS THAT ARE STRUCK",
                words: &["LIGHTNING", "DEAL", "POSE", "NERVE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "CAMPING GEAR",
                words: &["TENT", "SLEEPING", "LANTERN", "COMPASS"],
                level: 0,
            },
            CategoryStatic {
                name: "SMARTPHONE BRANDS",
                words: &["APPLE", "SAMSUNG", "GOOGLE", "ONEPLUS"],
                level: 1,
            },
            CategoryStatic {
                name: "POKER VARIANTS",
                words: &["TEXAS", "OMAHA", "STUD", "DRAW"],
                level: 2,
            },
            CategoryStatic {
                name: "FIRE _____",
                words: &["FIGHTER", "FLY", "PLACE", "ARM"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "CLEANING PRODUCTS",
                words: &["SOAP", "BLEACH", "DETERGENT", "SPONGE"],
                level: 0,
            },
            CategoryStatic {
                name: "MARVEL AVENGERS",
                words: &["THOR", "HULK", "WIDOW", "HAWKEYE"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF ENERGY",
                words: &["SOLAR", "WIND", "NUCLEAR", "HYDRO"],
                level: 2,
            },
            CategoryStatic {
                name: "HOT _____",
                words: &["DOG", "SHOT", "POTATO", "TUB"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "PIZZA TYPES",
                words: &["PEPPERONI", "MARGHERITA", "HAWAIIAN", "SUPREME"],
                level: 0,
            },
            CategoryStatic {
                name: "ANCIENT CIVILIZATIONS",
                words: &["ROMAN", "GREEK", "EGYPTIAN", "MAYAN"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF BANK",
                words: &["BLOOD", "MEMORY", "FOOD", "RIVER"],
                level: 2,
            },
            CategoryStatic {
                name: "SWEET _____",
                words: &["TOOTH", "TALK", "HEART", "SIXTEEN"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BREAKFAST DRINKS",
                words: &["COFFEE", "ORANGE", "MILK", "TEA"],
                level: 0,
            },
            CategoryStatic {
                name: "ROCK BANDS",
                words: &["QUEEN", "ACDC", "METALLICA", "NIRVANA"],
                level: 1,
            },
            CategoryStatic {
                name: "CARD GAME TERMS",
                words: &["TRUMP", "TRICK", "HAND", "DECK"],
                level: 2,
            },
            CategoryStatic {
                name: "BIG _____",
                words: &["BANG", "APPLE", "FOOT", "DEAL"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "WINTER SPORTS",
                words: &["SKIING", "HOCKEY", "SKATING", "CURLING"],
                level: 0,
            },
            CategoryStatic {
                name: "COFFEE DRINKS",
                words: &["ESPRESSO", "LATTE", "CAPPUCCINO", "MOCHA"],
                level: 1,
            },
            CategoryStatic {
                name: "GRAMMAR TERMS",
                words: &["NOUN", "VERB", "ADJECTIVE", "ADVERB"],
                level: 2,
            },
            CategoryStatic {
                name: "BLIND _____",
                words: &["DATE", "SPOT", "FOLD", "SIDE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SALAD INGREDIENTS",
                words: &["LETTUCE", "TOMATO", "CUCUMBER", "CROUTON"],
                level: 0,
            },
            CategoryStatic {
                name: "JAMES BOND ACTORS",
                words: &["CONNERY", "MOORE", "BROSNAN", "CRAIG"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF TEST",
                words: &["BLOOD", "DRIVING", "STRESS", "LITMUS"],
                level: 2,
            },
            CategoryStatic {
                name: "SHORT _____",
                words: &["CIRCUIT", "CUT", "HAND", "CHANGE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "HERBS",
                words: &["BASIL", "MINT", "OREGANO", "THYME"],
                level: 0,
            },
            CategoryStatic {
                name: "STAR WARS CHARACTERS",
                words: &["LUKE", "VADER", "YODA", "LEIA"],
                level: 1,
            },
            CategoryStatic {
                name: "MUSIC TEMPOS",
                words: &["ALLEGRO", "ADAGIO", "PRESTO", "LARGO"],
                level: 2,
            },
            CategoryStatic {
                name: "BRAIN _____",
                words: &["STORM", "WASH", "FREEZE", "DEAD"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SUSHI TYPES",
                words: &["NIGIRI", "SASHIMI", "MAKI", "TEMAKI"],
                level: 0,
            },
            CategoryStatic {
                name: "BOND GIRLS",
                words: &["HONEY", "OCTOPUSSY", "JINX", "VESPER"],
                level: 1,
            },
            CategoryStatic {
                name: "CLOUD TYPES",
                words: &["CUMULUS", "STRATUS", "CIRRUS", "NIMBUS"],
                level: 2,
            },
            CategoryStatic {
                name: "GOLDEN _____",
                words: &["GATE", "RETRIEVER", "RULE", "AGE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SOUP TYPES",
                words: &["TOMATO", "CHICKEN", "MINESTRONE", "CLAM"],
                level: 0,
            },
            CategoryStatic {
                name: "LORD OF THE RINGS",
                words: &["FRODO", "GANDALF", "ARAGORN", "LEGOLAS"],
                level: 1,
            },
            CategoryStatic {
                name: "MEASUREMENT UNITS",
                words: &["METER", "GRAM", "LITER", "KELVIN"],
                level: 2,
            },
            CategoryStatic {
                name: "POWER _____",
                words: &["PLANT", "POINT", "PLAY", "NAP"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "ICE CREAM FLAVORS",
                words: &["VANILLA", "CHOCOLATE", "STRAWBERRY", "MINT"],
                level: 0,
            },
            CategoryStatic {
                name: "GREEK GODS",
                words: &["ZEUS", "POSEIDON", "HADES", "APOLLO"],
                level: 1,
            },
            CategoryStatic {
                name: "LEGAL TERMS",
                words: &["PLAINTIFF", "DEFENDANT", "VERDICT", "APPEAL"],
                level: 2,
            },
            CategoryStatic {
                name: "BLACK _____",
                words: &["FRIDAY", "SHEEP", "MARKET", "HOLE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BERRIES",
                words: &["BLUEBERRY", "RASPBERRY", "BLACKBERRY", "STRAWBERRY"],
                level: 0,
            },
            CategoryStatic {
                name: "FRIENDS CHARACTERS",
                words: &["ROSS", "RACHEL", "MONICA", "CHANDLER"],
                level: 1,
            },
            CategoryStatic {
                name: "TYPES OF ROCK",
                words: &["IGNEOUS", "SEDIMENTARY", "METAMORPHIC", "VOLCANIC"],
                level: 2,
            },
            CategoryStatic {
                name: "PAPER _____",
                words: &["WORK", "BACK", "CLIP", "WEIGHT"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SANDWICH TYPES",
                words: &["BLT", "CLUB", "REUBEN", "GRILLED"],
                level: 0,
            },
            CategoryStatic {
                name: "PIXAR MOVIES",
                words: &["TOY", "FINDING", "MONSTERS", "CARS"],
                level: 1,
            },
            CategoryStatic {
                name: "POKER CHIPS",
                words: &["WHITE", "RED", "GREEN", "BLACK"],
                level: 2,
            },
            CategoryStatic {
                name: "MIND _____",
                words: &["READER", "BLOWING", "GAME", "FIELD"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "MEXICAN FOOD",
                words: &["TACO", "BURRITO", "QUESADILLA", "ENCHILADA"],
                level: 0,
            },
            CategoryStatic {
                name: "MARVEL VILLAINS",
                words: &["THANOS", "LOKI", "ULTRON", "MAGNETO"],
                level: 1,
            },
            CategoryStatic {
                name: "BALLET TERMS",
                words: &["PLIÉ", "PIROUETTE", "ARABESQUE", "JETÉ"],
                level: 2,
            },
            CategoryStatic {
                name: "FACE _____",
                words: &["TIME", "VALUE", "PALM", "LIFT"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "BARBECUE ITEMS",
                words: &["RIBS", "BRISKET", "SAUSAGE", "CHICKEN"],
                level: 0,
            },
            CategoryStatic {
                name: "DC HEROES",
                words: &["SUPERMAN", "BATMAN", "WONDER", "AQUAMAN"],
                level: 1,
            },
            CategoryStatic {
                name: "PERIODIC TABLE GROUPS",
                words: &["NOBLE", "ALKALI", "HALOGEN", "METAL"],
                level: 2,
            },
            CategoryStatic {
                name: "HAND _____",
                words: &["SHAKE", "OUT", "MADE", "BOOK"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "SEAFOOD",
                words: &["SHRIMP", "LOBSTER", "CRAB", "OYSTER"],
                level: 0,
            },
            CategoryStatic {
                name: "NINTENDO CHARACTERS",
                words: &["MARIO", "LINK", "KIRBY", "PIKACHU"],
                level: 1,
            },
            CategoryStatic {
                name: "WEATHER PHENOMENA",
                words: &["TORNADO", "HURRICANE", "TSUNAMI", "EARTHQUAKE"],
                level: 2,
            },
            CategoryStatic {
                name: "BACK _____",
                words: &["DOOR", "FIRE", "TRACK", "BONE"],
                level: 3,
            },
        ],
    },
    WordGroupsPuzzle {
        categories: [
            CategoryStatic {
                name: "ITALIAN FOOD",
                words: &["PIZZA", "PASTA", "RISOTTO", "LASAGNA"],
                level: 0,
            },
            CategoryStatic {
                name: "GAME OF THRONES HOUSES",
                words: &["STARK", "LANNISTER", "TARGARYEN", "BARATHEON"],
                level: 1,
            },
            CategoryStatic {
                name: "ORCHESTRA SECTIONS",
                words: &["STRING", "BRASS", "WOODWIND", "PERCUSSION"],
                level: 2,
            },
            CategoryStatic {
                name: "RUNNING _____",
                words: &["MATE", "WATER", "START", "JOKE"],
                level: 3,
            },
        ],
    },
];

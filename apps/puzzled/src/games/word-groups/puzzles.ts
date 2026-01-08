import type { ConnectionsPuzzle } from './types'

// Puzzles with varying difficulty - level 0 (easy) to level 3 (tricky)
export const PUZZLES: ConnectionsPuzzle[] = [
	// Puzzle 1
	{
		id: '1',
		date: '2024-01-01',
		categories: [
			{ name: 'FRUITS', words: ['APPLE', 'BANANA', 'ORANGE', 'GRAPE'], level: 0 },
			{ name: 'COLORS', words: ['RED', 'BLUE', 'GREEN', 'YELLOW'], level: 1 },
			{ name: 'PLANETS', words: ['MARS', 'VENUS', 'SATURN', 'JUPITER'], level: 2 },
			{ name: 'CARD SUITS', words: ['HEART', 'DIAMOND', 'CLUB', 'SPADE'], level: 3 },
		],
	},
	// Puzzle 2
	{
		id: '2',
		date: '2024-01-02',
		categories: [
			{ name: 'PETS', words: ['DOG', 'CAT', 'HAMSTER', 'RABBIT'], level: 0 },
			{ name: 'MUSIC GENRES', words: ['ROCK', 'JAZZ', 'POP', 'BLUES'], level: 1 },
			{ name: 'BODY PARTS', words: ['HEAD', 'HAND', 'FOOT', 'BACK'], level: 2 },
			{ name: '_____ BOARD', words: ['CHALK', 'SKATE', 'SURF', 'SNOW'], level: 3 },
		],
	},
	// Puzzle 3
	{
		id: '3',
		date: '2024-01-03',
		categories: [
			{ name: 'BREAKFAST FOODS', words: ['BACON', 'EGGS', 'TOAST', 'PANCAKE'], level: 0 },
			{ name: 'TYPES OF DANCE', words: ['SALSA', 'TANGO', 'WALTZ', 'SWING'], level: 1 },
			{ name: 'CHESS PIECES', words: ['KING', 'QUEEN', 'ROOK', 'KNIGHT'], level: 2 },
			{ name: 'GO ___', words: ['FISH', 'FIGURE', 'BANANAS', 'GETTER'], level: 3 },
		],
	},
	// Puzzle 4
	{
		id: '4',
		date: '2024-01-04',
		categories: [
			{ name: 'WEATHER', words: ['RAIN', 'SNOW', 'WIND', 'HAIL'], level: 0 },
			{ name: 'SPORTS EQUIPMENT', words: ['BALL', 'RACKET', 'HELMET', 'GLOVE'], level: 1 },
			{ name: 'COMPUTER PARTS', words: ['MOUSE', 'SCREEN', 'CHIP', 'DRIVE'], level: 2 },
			{ name: 'THINGS WITH KEYS', words: ['PIANO', 'LOCK', 'MAP', 'KEYBOARD'], level: 3 },
		],
	},
	// Puzzle 5
	{
		id: '5',
		date: '2024-01-05',
		categories: [
			{ name: 'VEGETABLES', words: ['CARROT', 'POTATO', 'ONION', 'PEPPER'], level: 0 },
			{ name: 'MOVIE GENRES', words: ['ACTION', 'COMEDY', 'HORROR', 'DRAMA'], level: 1 },
			{ name: 'GREEK LETTERS', words: ['ALPHA', 'BETA', 'GAMMA', 'DELTA'], level: 2 },
			{ name: 'THINGS THAT CRASH', words: ['WAVE', 'PARTY', 'STOCK', 'SYSTEM'], level: 3 },
		],
	},
	// Puzzle 6
	{
		id: '6',
		date: '2024-01-06',
		categories: [
			{ name: 'COUNTRIES', words: ['FRANCE', 'JAPAN', 'BRAZIL', 'EGYPT'], level: 0 },
			{ name: 'PRECIOUS STONES', words: ['RUBY', 'EMERALD', 'SAPPHIRE', 'DIAMOND'], level: 1 },
			{ name: 'UNITS OF TIME', words: ['SECOND', 'MINUTE', 'HOUR', 'WEEK'], level: 2 },
			{ name: '_____ JACK', words: ['BLACK', 'LUMBER', 'CRACKER', 'FLAP'], level: 3 },
		],
	},
	// Puzzle 7
	{
		id: '7',
		date: '2024-01-07',
		categories: [
			{ name: 'OCEAN CREATURES', words: ['SHARK', 'WHALE', 'DOLPHIN', 'OCTOPUS'], level: 0 },
			{ name: 'MUSICAL INSTRUMENTS', words: ['GUITAR', 'PIANO', 'VIOLIN', 'DRUMS'], level: 1 },
			{ name: 'OLYMPIC SPORTS', words: ['SWIMMING', 'FENCING', 'ARCHERY', 'DIVING'], level: 2 },
			{ name: 'TYPES OF SHOT', words: ['MOON', 'CHEAP', 'LONG', 'SNAP'], level: 3 },
		],
	},
	// Puzzle 8
	{
		id: '8',
		date: '2024-01-08',
		categories: [
			{ name: 'CITRUS FRUITS', words: ['LEMON', 'LIME', 'GRAPEFRUIT', 'TANGERINE'], level: 0 },
			{ name: 'CAR BRANDS', words: ['FORD', 'HONDA', 'TOYOTA', 'BMW'], level: 1 },
			{ name: 'ELEMENTS', words: ['GOLD', 'SILVER', 'IRON', 'COPPER'], level: 2 },
			{ name: 'WORDS BEFORE "HOUSE"', words: ['WHITE', 'GREEN', 'POWER', 'DOG'], level: 3 },
		],
	},
	// Puzzle 9
	{
		id: '9',
		date: '2024-01-09',
		categories: [
			{ name: 'DESSERTS', words: ['CAKE', 'PIE', 'COOKIE', 'BROWNIE'], level: 0 },
			{ name: 'SOCIAL MEDIA', words: ['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'], level: 1 },
			{ name: 'CARD GAMES', words: ['POKER', 'BRIDGE', 'RUMMY', 'BLACKJACK'], level: 2 },
			{ name: 'WORDS WITH DOUBLE O', words: ['MOON', 'BOOK', 'FOOT', 'COOL'], level: 3 },
		],
	},
	// Puzzle 10
	{
		id: '10',
		date: '2024-01-10',
		categories: [
			{ name: 'KITCHEN APPLIANCES', words: ['OVEN', 'BLENDER', 'TOASTER', 'MICROWAVE'], level: 0 },
			{ name: 'SUPERHEROES', words: ['BATMAN', 'SUPERMAN', 'SPIDERMAN', 'IRONMAN'], level: 1 },
			{ name: 'TYPES OF BREAD', words: ['SOURDOUGH', 'BAGUETTE', 'CIABATTA', 'BRIOCHE'], level: 2 },
			{ name: '_____ LIGHT', words: ['FLASH', 'HIGH', 'SPOT', 'LIME'], level: 3 },
		],
	},
	// Puzzle 11
	{
		id: '11',
		date: '2024-01-11',
		categories: [
			{ name: 'FLOWERS', words: ['ROSE', 'TULIP', 'DAISY', 'LILY'], level: 0 },
			{ name: 'PIZZA TOPPINGS', words: ['PEPPERONI', 'MUSHROOM', 'OLIVE', 'SAUSAGE'], level: 1 },
			{ name: 'SHAKESPEARE PLAYS', words: ['HAMLET', 'OTHELLO', 'MACBETH', 'TEMPEST'], level: 2 },
			{ name: 'THINGS THAT ARE CUT', words: ['DEAL', 'CORNER', 'CLASS', 'RUG'], level: 3 },
		],
	},
	// Puzzle 12
	{
		id: '12',
		date: '2024-01-12',
		categories: [
			{ name: 'SEASONS', words: ['SPRING', 'SUMMER', 'FALL', 'WINTER'], level: 0 },
			{ name: 'US STATES', words: ['TEXAS', 'FLORIDA', 'ALASKA', 'CALIFORNIA'], level: 1 },
			{ name: 'POKER TERMS', words: ['FOLD', 'RAISE', 'CALL', 'BLUFF'], level: 2 },
			{ name: 'COLD _____', words: ['TURKEY', 'SHOULDER', 'FEET', 'CASE'], level: 3 },
		],
	},
	// Puzzle 13
	{
		id: '13',
		date: '2024-01-13',
		categories: [
			{ name: 'BEVERAGES', words: ['COFFEE', 'TEA', 'JUICE', 'SODA'], level: 0 },
			{ name: 'DOG BREEDS', words: ['POODLE', 'BEAGLE', 'BULLDOG', 'HUSKY'], level: 1 },
			{ name: 'SPACE TERMS', words: ['ORBIT', 'GALAXY', 'ASTEROID', 'COMET'], level: 2 },
			{ name: 'THINGS WITH RINGS', words: ['SATURN', 'TREE', 'PHONE', 'CIRCUS'], level: 3 },
		],
	},
	// Puzzle 14
	{
		id: '14',
		date: '2024-01-14',
		categories: [
			{ name: 'FOOTWEAR', words: ['BOOTS', 'SNEAKERS', 'SANDALS', 'HEELS'], level: 0 },
			{ name: 'CURRENCIES', words: ['DOLLAR', 'EURO', 'YEN', 'POUND'], level: 1 },
			{ name: 'MAGIC WORDS', words: ['ABRACADABRA', 'PRESTO', 'ALAKAZAM', 'HOCUS'], level: 2 },
			{ name: 'TYPES OF POOL', words: ['CAR', 'GENE', 'SWIMMING', 'TYPING'], level: 3 },
		],
	},
	// Puzzle 15
	{
		id: '15',
		date: '2024-01-15',
		categories: [
			{ name: 'NUTS', words: ['ALMOND', 'WALNUT', 'CASHEW', 'PECAN'], level: 0 },
			{ name: 'STREAMING SERVICES', words: ['NETFLIX', 'HULU', 'DISNEY', 'AMAZON'], level: 1 },
			{ name: 'WIND INSTRUMENTS', words: ['FLUTE', 'CLARINET', 'SAXOPHONE', 'TRUMPET'], level: 2 },
			{ name: 'BREAK A _____', words: ['LEG', 'SWEAT', 'RECORD', 'PROMISE'], level: 3 },
		],
	},
	// Puzzle 16
	{
		id: '16',
		date: '2024-01-16',
		categories: [
			{ name: 'TROPICAL FRUITS', words: ['MANGO', 'PAPAYA', 'COCONUT', 'PINEAPPLE'], level: 0 },
			{ name: 'BOARD GAMES', words: ['CHESS', 'MONOPOLY', 'SCRABBLE', 'CLUE'], level: 1 },
			{ name: 'TYPES OF WAVES', words: ['RADIO', 'SOUND', 'BRAIN', 'HEAT'], level: 2 },
			{ name: '_____ BALL', words: ['BASE', 'VOLLEY', 'BASKET', 'SNOW'], level: 3 },
		],
	},
	// Puzzle 17
	{
		id: '17',
		date: '2024-01-17',
		categories: [
			{ name: 'FAST FOOD CHAINS', words: ['MCDONALDS', 'WENDYS', 'SUBWAY', 'TACO'], level: 0 },
			{ name: 'MYTHICAL CREATURES', words: ['DRAGON', 'UNICORN', 'PHOENIX', 'GRIFFIN'], level: 1 },
			{ name: 'FILM NOIR ELEMENTS', words: ['SHADOW', 'FEMME', 'SMOKE', 'RAIN'], level: 2 },
			{ name: 'RED _____', words: ['CARPET', 'HERRING', 'FLAG', 'TAPE'], level: 3 },
		],
	},
	// Puzzle 18
	{
		id: '18',
		date: '2024-01-18',
		categories: [
			{ name: 'DAIRY PRODUCTS', words: ['MILK', 'CHEESE', 'YOGURT', 'BUTTER'], level: 0 },
			{ name: 'ZODIAC SIGNS', words: ['LEO', 'VIRGO', 'ARIES', 'TAURUS'], level: 1 },
			{ name: 'TYPES OF TRIANGLE', words: ['RIGHT', 'ACUTE', 'OBTUSE', 'SCALENE'], level: 2 },
			{ name: '_____ MARKET', words: ['SUPER', 'FLEA', 'STOCK', 'BLACK'], level: 3 },
		],
	},
	// Puzzle 19
	{
		id: '19',
		date: '2024-01-19',
		categories: [
			{ name: 'ASIAN CUISINES', words: ['SUSHI', 'PHO', 'CURRY', 'DIMSUM'], level: 0 },
			{ name: 'VIDEO GAME CONSOLES', words: ['PLAYSTATION', 'XBOX', 'NINTENDO', 'SEGA'], level: 1 },
			{
				name: 'ART MOVEMENTS',
				words: ['BAROQUE', 'CUBISM', 'SURREALISM', 'IMPRESSIONISM'],
				level: 2,
			},
			{ name: 'THINGS WITH TAILS', words: ['MONKEY', 'COAT', 'FAIRY', 'COCKTAIL'], level: 3 },
		],
	},
	// Puzzle 20
	{
		id: '20',
		date: '2024-01-20',
		categories: [
			{ name: 'OFFICE SUPPLIES', words: ['STAPLER', 'PENCIL', 'SCISSORS', 'TAPE'], level: 0 },
			{
				name: 'HARRY POTTER HOUSES',
				words: ['GRYFFINDOR', 'SLYTHERIN', 'RAVENCLAW', 'HUFFLEPUFF'],
				level: 1,
			},
			{ name: 'CHEMICAL COMPOUNDS', words: ['WATER', 'SALT', 'SUGAR', 'ALCOHOL'], level: 2 },
			{ name: 'FULL _____', words: ['MOON', 'HOUSE', 'CIRCLE', 'STEAM'], level: 3 },
		],
	},
	// Puzzle 21
	{
		id: '21',
		date: '2024-01-21',
		categories: [
			{ name: 'TREES', words: ['OAK', 'MAPLE', 'PINE', 'BIRCH'], level: 0 },
			{ name: 'PROGRAMMING LANGUAGES', words: ['PYTHON', 'JAVA', 'RUBY', 'SWIFT'], level: 1 },
			{ name: 'TYPES OF CHEESE', words: ['CHEDDAR', 'BRIE', 'GOUDA', 'PARMESAN'], level: 2 },
			{ name: '_____ WORK', words: ['FRAME', 'FIRE', 'DREAM', 'NET'], level: 3 },
		],
	},
	// Puzzle 22
	{
		id: '22',
		date: '2024-01-22',
		categories: [
			{ name: 'BIRDS', words: ['EAGLE', 'HAWK', 'OWL', 'FALCON'], level: 0 },
			{ name: 'PASTA SHAPES', words: ['PENNE', 'SPAGHETTI', 'FUSILLI', 'RIGATONI'], level: 1 },
			{ name: 'POKER HANDS', words: ['FLUSH', 'STRAIGHT', 'PAIR', 'FULL'], level: 2 },
			{ name: 'WILD _____', words: ['CARD', 'WEST', 'FIRE', 'GOOSE'], level: 3 },
		],
	},
	// Puzzle 23
	{
		id: '23',
		date: '2024-01-23',
		categories: [
			{ name: 'CONSTRUCTION TOOLS', words: ['HAMMER', 'SAW', 'DRILL', 'WRENCH'], level: 0 },
			{ name: 'DISNEY PRINCESSES', words: ['ARIEL', 'BELLE', 'JASMINE', 'MULAN'], level: 1 },
			{ name: 'WINE TYPES', words: ['MERLOT', 'CABERNET', 'PINOT', 'CHARDONNAY'], level: 2 },
			{ name: 'DOUBLE _____', words: ['DUTCH', 'CHECK', 'TAKE', 'AGENT'], level: 3 },
		],
	},
	// Puzzle 24
	{
		id: '24',
		date: '2024-01-24',
		categories: [
			{ name: 'CANDY', words: ['CHOCOLATE', 'GUMMY', 'LOLLIPOP', 'CARAMEL'], level: 0 },
			{ name: 'FAMOUS SCIENTISTS', words: ['EINSTEIN', 'NEWTON', 'DARWIN', 'CURIE'], level: 1 },
			{ name: 'POKER ACTIONS', words: ['BET', 'CHECK', 'RAISE', 'FOLD'], level: 2 },
			{ name: 'THINGS THAT ARE STRUCK', words: ['LIGHTNING', 'DEAL', 'POSE', 'NERVE'], level: 3 },
		],
	},
	// Puzzle 25
	{
		id: '25',
		date: '2024-01-25',
		categories: [
			{ name: 'CAMPING GEAR', words: ['TENT', 'SLEEPING', 'LANTERN', 'COMPASS'], level: 0 },
			{ name: 'SMARTPHONE BRANDS', words: ['APPLE', 'SAMSUNG', 'GOOGLE', 'ONEPLUS'], level: 1 },
			{ name: 'POKER VARIANTS', words: ['TEXAS', 'OMAHA', 'STUD', 'DRAW'], level: 2 },
			{ name: 'FIRE _____', words: ['FIGHTER', 'FLY', 'PLACE', 'ARM'], level: 3 },
		],
	},
	// Puzzle 26
	{
		id: '26',
		date: '2024-01-26',
		categories: [
			{ name: 'CLEANING PRODUCTS', words: ['SOAP', 'BLEACH', 'DETERGENT', 'SPONGE'], level: 0 },
			{ name: 'MARVEL AVENGERS', words: ['THOR', 'HULK', 'WIDOW', 'HAWKEYE'], level: 1 },
			{ name: 'TYPES OF ENERGY', words: ['SOLAR', 'WIND', 'NUCLEAR', 'HYDRO'], level: 2 },
			{ name: 'HOT _____', words: ['DOG', 'SHOT', 'POTATO', 'TUB'], level: 3 },
		],
	},
	// Puzzle 27
	{
		id: '27',
		date: '2024-01-27',
		categories: [
			{ name: 'PIZZA TYPES', words: ['PEPPERONI', 'MARGHERITA', 'HAWAIIAN', 'SUPREME'], level: 0 },
			{ name: 'ANCIENT CIVILIZATIONS', words: ['ROMAN', 'GREEK', 'EGYPTIAN', 'MAYAN'], level: 1 },
			{ name: 'TYPES OF BANK', words: ['BLOOD', 'MEMORY', 'FOOD', 'RIVER'], level: 2 },
			{ name: 'SWEET _____', words: ['TOOTH', 'TALK', 'HEART', 'SIXTEEN'], level: 3 },
		],
	},
	// Puzzle 28
	{
		id: '28',
		date: '2024-01-28',
		categories: [
			{ name: 'BREAKFAST DRINKS', words: ['COFFEE', 'ORANGE', 'MILK', 'TEA'], level: 0 },
			{ name: 'ROCK BANDS', words: ['QUEEN', 'ACDC', 'METALLICA', 'NIRVANA'], level: 1 },
			{ name: 'CARD GAME TERMS', words: ['TRUMP', 'TRICK', 'HAND', 'DECK'], level: 2 },
			{ name: 'BIG _____', words: ['BANG', 'APPLE', 'FOOT', 'DEAL'], level: 3 },
		],
	},
	// Puzzle 29
	{
		id: '29',
		date: '2024-01-29',
		categories: [
			{ name: 'WINTER SPORTS', words: ['SKIING', 'HOCKEY', 'SKATING', 'CURLING'], level: 0 },
			{ name: 'COFFEE DRINKS', words: ['ESPRESSO', 'LATTE', 'CAPPUCCINO', 'MOCHA'], level: 1 },
			{ name: 'GRAMMAR TERMS', words: ['NOUN', 'VERB', 'ADJECTIVE', 'ADVERB'], level: 2 },
			{ name: 'BLIND _____', words: ['DATE', 'SPOT', 'FOLD', 'SIDE'], level: 3 },
		],
	},
	// Puzzle 30
	{
		id: '30',
		date: '2024-01-30',
		categories: [
			{ name: 'SALAD INGREDIENTS', words: ['LETTUCE', 'TOMATO', 'CUCUMBER', 'CROUTON'], level: 0 },
			{ name: 'JAMES BOND ACTORS', words: ['CONNERY', 'MOORE', 'BROSNAN', 'CRAIG'], level: 1 },
			{ name: 'TYPES OF TEST', words: ['BLOOD', 'DRIVING', 'STRESS', 'LITMUS'], level: 2 },
			{ name: 'SHORT _____', words: ['CIRCUIT', 'CUT', 'HAND', 'CHANGE'], level: 3 },
		],
	},
	// Puzzle 31
	{
		id: '31',
		date: '2024-01-31',
		categories: [
			{ name: 'HERBS', words: ['BASIL', 'MINT', 'OREGANO', 'THYME'], level: 0 },
			{ name: 'STAR WARS CHARACTERS', words: ['LUKE', 'VADER', 'YODA', 'LEIA'], level: 1 },
			{ name: 'MUSIC TEMPOS', words: ['ALLEGRO', 'ADAGIO', 'PRESTO', 'LARGO'], level: 2 },
			{ name: 'BRAIN _____', words: ['STORM', 'WASH', 'FREEZE', 'DEAD'], level: 3 },
		],
	},
	// Puzzle 32
	{
		id: '32',
		date: '2024-02-01',
		categories: [
			{ name: 'SUSHI TYPES', words: ['NIGIRI', 'SASHIMI', 'MAKI', 'TEMAKI'], level: 0 },
			{ name: 'BOND GIRLS', words: ['HONEY', 'OCTOPUSSY', 'JINX', 'VESPER'], level: 1 },
			{ name: 'CLOUD TYPES', words: ['CUMULUS', 'STRATUS', 'CIRRUS', 'NIMBUS'], level: 2 },
			{ name: 'GOLDEN _____', words: ['GATE', 'RETRIEVER', 'RULE', 'AGE'], level: 3 },
		],
	},
	// Puzzle 33
	{
		id: '33',
		date: '2024-02-02',
		categories: [
			{ name: 'SOUP TYPES', words: ['TOMATO', 'CHICKEN', 'MINESTRONE', 'CLAM'], level: 0 },
			{ name: 'LORD OF THE RINGS', words: ['FRODO', 'GANDALF', 'ARAGORN', 'LEGOLAS'], level: 1 },
			{ name: 'MEASUREMENT UNITS', words: ['METER', 'GRAM', 'LITER', 'KELVIN'], level: 2 },
			{ name: 'POWER _____', words: ['PLANT', 'POINT', 'PLAY', 'NAP'], level: 3 },
		],
	},
	// Puzzle 34
	{
		id: '34',
		date: '2024-02-03',
		categories: [
			{
				name: 'ICE CREAM FLAVORS',
				words: ['VANILLA', 'CHOCOLATE', 'STRAWBERRY', 'MINT'],
				level: 0,
			},
			{ name: 'GREEK GODS', words: ['ZEUS', 'POSEIDON', 'HADES', 'APOLLO'], level: 1 },
			{ name: 'LEGAL TERMS', words: ['PLAINTIFF', 'DEFENDANT', 'VERDICT', 'APPEAL'], level: 2 },
			{ name: 'BLACK _____', words: ['FRIDAY', 'SHEEP', 'MARKET', 'HOLE'], level: 3 },
		],
	},
	// Puzzle 35
	{
		id: '35',
		date: '2024-02-04',
		categories: [
			{ name: 'BERRIES', words: ['BLUEBERRY', 'RASPBERRY', 'BLACKBERRY', 'STRAWBERRY'], level: 0 },
			{ name: 'FRIENDS CHARACTERS', words: ['ROSS', 'RACHEL', 'MONICA', 'CHANDLER'], level: 1 },
			{
				name: 'TYPES OF ROCK',
				words: ['IGNEOUS', 'SEDIMENTARY', 'METAMORPHIC', 'VOLCANIC'],
				level: 2,
			},
			{ name: 'PAPER _____', words: ['WORK', 'BACK', 'CLIP', 'WEIGHT'], level: 3 },
		],
	},
	// Puzzle 36
	{
		id: '36',
		date: '2024-02-05',
		categories: [
			{ name: 'SANDWICH TYPES', words: ['BLT', 'CLUB', 'REUBEN', 'GRILLED'], level: 0 },
			{ name: 'PIXAR MOVIES', words: ['TOY', 'FINDING', 'MONSTERS', 'CARS'], level: 1 },
			{ name: 'POKER CHIPS', words: ['WHITE', 'RED', 'GREEN', 'BLACK'], level: 2 },
			{ name: 'MIND _____', words: ['READER', 'BLOWING', 'GAME', 'FIELD'], level: 3 },
		],
	},
	// Puzzle 37
	{
		id: '37',
		date: '2024-02-06',
		categories: [
			{ name: 'MEXICAN FOOD', words: ['TACO', 'BURRITO', 'QUESADILLA', 'ENCHILADA'], level: 0 },
			{ name: 'MARVEL VILLAINS', words: ['THANOS', 'LOKI', 'ULTRON', 'MAGNETO'], level: 1 },
			{ name: 'BALLET TERMS', words: ['PLIÉ', 'PIROUETTE', 'ARABESQUE', 'JETÉ'], level: 2 },
			{ name: 'FACE _____', words: ['TIME', 'VALUE', 'PALM', 'LIFT'], level: 3 },
		],
	},
	// Puzzle 38
	{
		id: '38',
		date: '2024-02-07',
		categories: [
			{ name: 'BARBECUE ITEMS', words: ['RIBS', 'BRISKET', 'SAUSAGE', 'CHICKEN'], level: 0 },
			{ name: 'DC HEROES', words: ['SUPERMAN', 'BATMAN', 'WONDER', 'AQUAMAN'], level: 1 },
			{ name: 'PERIODIC TABLE GROUPS', words: ['NOBLE', 'ALKALI', 'HALOGEN', 'METAL'], level: 2 },
			{ name: 'HAND _____', words: ['SHAKE', 'OUT', 'MADE', 'BOOK'], level: 3 },
		],
	},
	// Puzzle 39
	{
		id: '39',
		date: '2024-02-08',
		categories: [
			{ name: 'SEAFOOD', words: ['SHRIMP', 'LOBSTER', 'CRAB', 'OYSTER'], level: 0 },
			{ name: 'NINTENDO CHARACTERS', words: ['MARIO', 'LINK', 'KIRBY', 'PIKACHU'], level: 1 },
			{
				name: 'WEATHER PHENOMENA',
				words: ['TORNADO', 'HURRICANE', 'TSUNAMI', 'EARTHQUAKE'],
				level: 2,
			},
			{ name: 'BACK _____', words: ['DOOR', 'FIRE', 'TRACK', 'BONE'], level: 3 },
		],
	},
	// Puzzle 40
	{
		id: '40',
		date: '2024-02-09',
		categories: [
			{ name: 'ITALIAN FOOD', words: ['PIZZA', 'PASTA', 'RISOTTO', 'LASAGNA'], level: 0 },
			{
				name: 'GAME OF THRONES HOUSES',
				words: ['STARK', 'LANNISTER', 'TARGARYEN', 'BARATHEON'],
				level: 1,
			},
			{
				name: 'ORCHESTRA SECTIONS',
				words: ['STRING', 'BRASS', 'WOODWIND', 'PERCUSSION'],
				level: 2,
			},
			{ name: 'RUNNING _____', words: ['MATE', 'WATER', 'START', 'JOKE'], level: 3 },
		],
	},
]

export function getDailyPuzzle(): ConnectionsPuzzle {
	const today = new Date()
	const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
	const index = seed % PUZZLES.length
	return PUZZLES[index]
}

export function getRandomPuzzle(): ConnectionsPuzzle {
	return PUZZLES[Math.floor(Math.random() * PUZZLES.length)]
}

export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}
	return shuffled
}

export function getAllWords(puzzle: ConnectionsPuzzle): string[] {
	return shuffleArray(puzzle.categories.flatMap((cat) => cat.words))
}

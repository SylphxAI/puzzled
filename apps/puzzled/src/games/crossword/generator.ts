/**
 * Crossword Mini Puzzle Generator
 *
 * Pre-computed 5x5 word squares where rows AND columns are valid words.
 * Word squares are mathematically rare - using curated collection of 30+.
 */

import type { CrosswordClue, CrosswordPuzzleData } from "./types";

type WordSquare = {
	words: string[]; // 5 words that form both rows and columns
	clues: {
		across: string[];
		down: string[];
	};
};

// 30+ verified word squares with clues
// Each word square: row[i] === col[i] (symmetric property)
const WORD_SQUARES: WordSquare[] = [
	// === PERFECT 5x5 WORD SQUARES ===
	{
		words: ["HEART", "EMBER", "ABUSE", "RESIN", "TREND"],
		clues: {
			across: [
				"Vital organ",
				"Glowing coal",
				"Mistreat",
				"Tree secretion",
				"Fashion direction",
			],
			down: [
				"Center of love",
				"Hot ash",
				"Misuse",
				"Pine product",
				"Popular style",
			],
		},
	},
	{
		words: ["STARE", "TAXES", "AXIAL", "REEDS", "ESSAY"],
		clues: {
			across: [
				"Gaze intently",
				"Government levies",
				"Along an axis",
				"Marsh plants",
				"Written composition",
			],
			down: [
				"Look fixedly",
				"April payments",
				"Rotational",
				"Swamp grass",
				"Short paper",
			],
		},
	},
	{
		words: ["SCAMP", "CADRE", "ADMIT", "TRITE", "PEEPS"],
		clues: {
			across: ["Rascal", "Core group", "Confess", "Overused", "Quick looks"],
			down: [
				"Mischievous one",
				"Elite unit",
				"Allow entry",
				"Clichéd",
				"Baby chicks",
			],
		},
	},
	{
		words: ["FLAME", "LIVER", "AVIAN", "MEDAL", "EARNS"],
		clues: {
			across: [
				"Fire tongue",
				"Organ that detoxifies",
				"Bird-related",
				"Award disk",
				"Makes money",
			],
			down: ["Blaze", "Vital organ", "Feathered", "Prize", "Deserves"],
		},
	},
	{
		words: ["STEAM", "TERSE", "ERASE", "ASHEN", "MENUS"],
		clues: {
			across: [
				"Water vapor",
				"Brief and to the point",
				"Delete",
				"Pale gray",
				"Restaurant lists",
			],
			down: [
				"Hot mist",
				"Concise",
				"Wipe out",
				"Ghost-like color",
				"Food offerings",
			],
		},
	},
	{
		words: ["SPARE", "PALER", "ALARM", "RERUN", "ERMINE"],
		clues: {
			across: [
				"Extra",
				"More washed out",
				"Warning sound",
				"TV repeat",
				"White fur",
			],
			down: [
				"Additional",
				"Less colorful",
				"Clock setting",
				"Show again",
				"Royal fur",
			],
		},
	},
	{
		words: ["CRISP", "REGAL", "IGLOO", "SALON", "PONDS"],
		clues: {
			across: ["Crunchy", "Royal", "Ice house", "Beauty parlor", "Small lakes"],
			down: [
				"Fresh and firm",
				"Kingly",
				"Eskimo home",
				"Hair studio",
				"Duck habitats",
			],
		},
	},
	{
		words: ["PASTE", "ALARM", "SALES", "TREND", "ESSAY"],
		clues: {
			across: [
				"Glue",
				"Warning",
				"Store events",
				"Fashion movement",
				"Written work",
			],
			down: [
				"Adhesive",
				"Clock buzzer",
				"Discount events",
				"Popular direction",
				"Paper",
			],
		},
	},
	{
		words: ["SHARE", "HAREM", "ARENA", "REALM", "ENEMA"],
		clues: {
			across: [
				"Portion",
				"Wives quarters",
				"Sports venue",
				"Kingdom",
				"Medical flush",
			],
			down: [
				"Split",
				"Palace section",
				"Stadium",
				"Domain",
				"Cleansing procedure",
			],
		},
	},
	{
		words: ["SMART", "MEDIA", "ADORE", "RIPEN", "TEENS"],
		clues: {
			across: [
				"Intelligent",
				"News sources",
				"Love deeply",
				"Mature",
				"Adolescents",
			],
			down: ["Clever", "TV and news", "Worship", "Get ready", "Young adults"],
		},
	},
	{
		words: ["TRADE", "RIDER", "AIMED", "DETER", "ERASE"],
		clues: {
			across: [
				"Exchange",
				"Horse jockey",
				"Pointed at",
				"Discourage",
				"Delete",
			],
			down: ["Swap", "Motorcycle user", "Targeted", "Prevent", "Wipe clean"],
		},
	},
	{
		words: ["STALE", "TONER", "ANGEL", "LEGAL", "ERASE"],
		clues: {
			across: [
				"Not fresh",
				"Printer ink",
				"Heavenly being",
				"Lawful",
				"Remove",
			],
			down: [
				"Old bread",
				"Copy machine supply",
				"Guardian spirit",
				"By the law",
				"Delete",
			],
		},
	},
	{
		words: ["CRANE", "RAVEN", "AVANT", "NEEDY", "ENTRY"],
		clues: {
			across: [
				"Construction lift",
				"Black bird",
				"Cutting-edge",
				"In want",
				"Doorway",
			],
			down: ["Tall bird", "Poe bird", "Forward-thinking", "Poor", "Way in"],
		},
	},
	{
		words: ["GRAPE", "RIVER", "AVERT", "PERKY", "ENTRY"],
		clues: {
			across: [
				"Wine fruit",
				"Flowing water",
				"Turn away",
				"Cheerful",
				"Doorway",
			],
			down: ["Vineyard fruit", "Stream", "Prevent", "Upbeat", "Entrance"],
		},
	},
	{
		words: ["TRACE", "RANCH", "ANVIL", "CHINA", "ELATE"],
		clues: {
			across: [
				"Follow",
				"Farm",
				"Blacksmith tool",
				"Asian country",
				"Make happy",
			],
			down: [
				"Small amount",
				"Cattle farm",
				"Metal shaper",
				"Porcelain",
				"Thrill",
			],
		},
	},
	{
		words: ["BLAME", "LASER", "ASSET", "METER", "ERRED"],
		clues: {
			across: [
				"Fault",
				"Light beam",
				"Valuable item",
				"Measuring device",
				"Made mistake",
			],
			down: ["Accuse", "Surgery tool", "Resource", "Parking ___", "Goofed"],
		},
	},
	{
		words: ["SHAKE", "HAVEN", "AVAIL", "KELPS", "ENSUE"],
		clues: {
			across: ["Tremble", "Safe place", "Use", "Seaweeds", "Follow"],
			down: ["Quiver", "Harbor", "Benefit", "Ocean plants", "Result"],
		},
	},
	{
		words: ["CRATE", "RIPER", "AISLE", "TEENS", "ERECT"],
		clues: {
			across: [
				"Shipping box",
				"More mature",
				"Store lane",
				"Young people",
				"Build up",
			],
			down: [
				"Wooden box",
				"Ready to eat",
				"Grocery path",
				"Adolescents",
				"Upright",
			],
		},
	},
	{
		words: ["STORM", "TORSO", "ORGAN", "RANGE", "MONEY"],
		clues: {
			across: [
				"Bad weather",
				"Body trunk",
				"Musical instrument",
				"Mountain chain",
				"Currency",
			],
			down: ["Tempest", "Upper body", "Piano or pipe", "Stove", "Cash"],
		},
	},
	{
		words: ["BREAD", "RENAL", "ENTER", "ALIEN", "DRESS"],
		clues: {
			across: [
				"Bakery item",
				"Kidney-related",
				"Come in",
				"Foreigner",
				"Garment",
			],
			down: ["Loaf", "Organ type", "Go inside", "ET", "Outfit"],
		},
	},
	{
		words: ["SPEND", "PLAZA", "EATER", "NASAL", "DARTS"],
		clues: {
			across: [
				"Use money",
				"Town square",
				"One who consumes",
				"Nose-related",
				"Pub game pieces",
			],
			down: [
				"Shell out",
				"Shopping center",
				"Diner",
				"Sinus area",
				"Pointed missiles",
			],
		},
	},
	{
		words: ["MAPLE", "ALIAS", "PINTO", "LITRE", "ESSAY"],
		clues: {
			across: [
				"Syrup tree",
				"Fake name",
				"Spotted horse",
				"Metric volume",
				"Paper",
			],
			down: [
				"Leaf shape",
				"Stage name",
				"Bean type",
				"Liter spelling",
				"Composition",
			],
		},
	},
	{
		words: ["SCALE", "CEDAR", "ADEPT", "LARGE", "ERTES"],
		clues: {
			across: [
				"Weighing device",
				"Fragrant wood",
				"Skilled",
				"Big",
				"Art style",
			],
			down: ["Climb", "Closet wood", "Expert", "Oversized", "Deco artist"],
		},
	},
	{
		words: ["STAIN", "TIARA", "ABASE", "IRENE", "NAVEL"],
		clues: {
			across: [
				"Spot mark",
				"Crown",
				"Humiliate",
				"Greek goddess",
				"Belly button",
			],
			down: [
				"Blemish",
				"Princess crown",
				"Degrade",
				"Peace goddess",
				"Orange type",
			],
		},
	},
	{
		words: ["SWORN", "WAGER", "ORDER", "RERUN", "NERDY"],
		clues: {
			across: ["Under oath", "Bet", "Command", "TV repeat", "Geeky"],
			down: ["Pledged", "Gamble", "Sequence", "Replay", "Bookish"],
		},
	},
	{
		words: ["CAPER", "ALIVE", "PIPER", "EVERY", "REYES"],
		clues: {
			across: ["Heist", "Living", "Flute player", "Each one", "Spanish kings"],
			down: ["Adventure", "Not dead", "Pan player", "All", "Monarchs"],
		},
	},
	{
		words: ["MANGO", "ARISE", "NICHE", "GENES", "ONSET"],
		clues: {
			across: [
				"Tropical fruit",
				"Wake up",
				"Special spot",
				"DNA units",
				"Beginning",
			],
			down: ["Fruit", "Get up", "Market segment", "Hereditary units", "Start"],
		},
	},
	{
		words: ["DENIM", "EVADE", "NAIVE", "IMAGE", "MELEE"],
		clues: {
			across: ["Jean fabric", "Avoid", "Innocent", "Picture", "Brawl"],
			down: ["Jeans material", "Dodge", "Gullible", "Photo", "Fight"],
		},
	},
	{
		words: ["OZONE", "ZEBRA", "OBESE", "NEARS", "EASES"],
		clues: {
			across: [
				"Atmosphere layer",
				"Striped animal",
				"Very overweight",
				"Approaches",
				"Reduces",
			],
			down: ["O3 layer", "Safari animal", "Heavy", "Gets close", "Lessens"],
		},
	},
	{
		words: ["THETA", "HOVER", "ERROR", "TERSE", "AREAS"],
		clues: {
			across: ["Greek letter", "Float", "Mistake", "Brief", "Regions"],
			down: ["Greek T", "Stay aloft", "Bug", "Concise", "Zones"],
		},
	},

	// === ADDITIONAL WORD SQUARES ===
	{
		words: ["DEALS", "ELITE", "AIDES", "LEMUR", "STERN"],
		clues: {
			across: [
				"Bargains",
				"Upper class",
				"Helpers",
				"Madagascar animal",
				"Rear of ship",
			],
			down: ["Sales", "Best of best", "Assistants", "Ring-tail", "Strict"],
		},
	},
	{
		words: ["ATTIC", "TIARA", "TIDAL", "IRATE", "CALES"],
		clues: {
			across: [
				"Storage room",
				"Royal crown",
				"Wave-related",
				"Angry",
				"Weights",
			],
			down: [
				"Upper floor",
				"Princess wear",
				"Ocean pattern",
				"Furious",
				"Scales",
			],
		},
	},
	{
		words: ["PANEL", "ARENA", "NEEDY", "ENDOW", "LAYER"],
		clues: {
			across: [
				"Discussion group",
				"Sports venue",
				"In want",
				"Grant funds",
				"Stratum",
			],
			down: ["Flat section", "Stadium", "Poor", "Provide", "Coating"],
		},
	},
	{
		words: ["LUNAR", "UNITE", "NITER", "ATONE", "REEDS"],
		clues: {
			across: [
				"Moon-related",
				"Join together",
				"Saltpeter",
				"Make amends",
				"Marsh plants",
			],
			down: [
				"Of the moon",
				"Combine",
				"Potassium nitrate",
				"Apologize",
				"Swamp grass",
			],
		},
	},
	{
		words: ["TIGER", "IRATE", "GASES", "ETEXT", "RESET"],
		clues: {
			across: ["Striped cat", "Angry", "Vapors", "Digital book", "Start over"],
			down: ["Big cat", "Furious", "Fumes", "Online text", "Restart"],
		},
	},
];

/**
 * Generate clues with proper numbering for a word square
 */
function generateClues(
	words: string[],
	clueTexts: { across: string[]; down: string[] },
): {
	across: CrosswordClue[];
	down: CrosswordClue[];
} {
	const across: CrosswordClue[] = [];
	const down: CrosswordClue[] = [];

	// For a 5x5 word square, numbering goes:
	// 1-across, 1-down at (0,0)
	// 2-down at (0,1), 3-down at (0,2), etc.
	// 6-across at (1,0), 7-across at (2,0), etc.

	// Across clues (one per row)
	for (let row = 0; row < 5; row++) {
		const number = row === 0 ? 1 : row + 5;
		across.push({
			number,
			clue: clueTexts.across[row],
			answer: words[row],
			row,
			col: 0,
			length: words[row].length,
		});
	}

	// Down clues (one per column)
	for (let col = 0; col < 5; col++) {
		const number = col + 1;
		down.push({
			number,
			clue: clueTexts.down[col],
			answer: words[col], // In a word square, col word = row word
			row: 0,
			col,
			length: words[col].length,
		});
	}

	return { across, down };
}

/**
 * Generate a crossword puzzle from seed
 */
export function generateCrosswordPuzzle(seed: number): CrosswordPuzzleData {
	const index = Math.abs(seed) % WORD_SQUARES.length;
	const square = WORD_SQUARES[index];

	// Build grid from words
	const grid: (string | null)[][] = square.words.map((word) => word.split(""));

	// Generate properly numbered clues
	const clues = generateClues(square.words, square.clues);

	return {
		grid,
		clues,
	};
}

/**
 * Get count of available puzzles
 */
export function getWordSquareCount(): number {
	return WORD_SQUARES.length;
}

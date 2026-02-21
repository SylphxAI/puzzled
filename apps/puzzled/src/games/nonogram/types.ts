/**
 * Nonogram (Picross) Types
 * Fill cells to reveal a hidden picture
 */

export type CellState = "empty" | "filled" | "marked"; // marked = X, definitely empty

export type NonogramPuzzleData = {
	width: number;
	height: number;
	rowClues: number[][]; // Clues for each row
	colClues: number[][]; // Clues for each column
	theme?: string; // What the picture represents
};

export type NonogramSolution = {
	grid: boolean[][]; // true = filled, false = empty
};

export type NonogramGuess = {
	row: number;
	col: number;
	state: CellState;
};

export type NonogramGuessResult = {
	correct: boolean;
};

export type NonogramState = {
	// Grid state
	userGrid: CellState[][]; // User's current entries
	selectedCell: { row: number; col: number } | null;

	// Game progress
	isComplete: boolean;
	errors: number;
	startTime: number | null;
	endTime: number | null;

	// Mode
	fillMode: "fill" | "mark"; // Fill cells or mark as empty
};

const _DEFAULT_SIZE = 10;

/**
 * Generate clues from a solution grid
 */
export function generateClues(solution: boolean[][]): {
	rowClues: number[][];
	colClues: number[][];
} {
	const height = solution.length;
	const width = solution[0]?.length ?? 0;

	// Row clues
	const rowClues: number[][] = [];
	for (let row = 0; row < height; row++) {
		const clue: number[] = [];
		let count = 0;
		for (let col = 0; col < width; col++) {
			if (solution[row][col]) {
				count++;
			} else if (count > 0) {
				clue.push(count);
				count = 0;
			}
		}
		if (count > 0) clue.push(count);
		rowClues.push(clue.length > 0 ? clue : [0]);
	}

	// Column clues
	const colClues: number[][] = [];
	for (let col = 0; col < width; col++) {
		const clue: number[] = [];
		let count = 0;
		for (let row = 0; row < height; row++) {
			if (solution[row][col]) {
				count++;
			} else if (count > 0) {
				clue.push(count);
				count = 0;
			}
		}
		if (count > 0) clue.push(count);
		colClues.push(clue.length > 0 ? clue : [0]);
	}

	return { rowClues, colClues };
}

/**
 * Check if user's grid matches the solution
 */
export function isGridComplete(
	userGrid: CellState[][],
	solution: boolean[][],
): boolean {
	for (let row = 0; row < solution.length; row++) {
		for (let col = 0; col < solution[0].length; col++) {
			const shouldBeFilled = solution[row][col];
			const userFilled = userGrid[row]?.[col] === "filled";
			if (shouldBeFilled !== userFilled) return false;
		}
	}
	return true;
}

/**
 * Check if a row is correctly filled
 */
export function isRowCorrect(
	userGrid: CellState[][],
	solution: boolean[][],
	row: number,
): boolean {
	for (let col = 0; col < solution[0].length; col++) {
		const shouldBeFilled = solution[row][col];
		const userFilled = userGrid[row]?.[col] === "filled";
		if (shouldBeFilled !== userFilled) return false;
	}
	return true;
}

/**
 * Check if a column is correctly filled
 */
export function isColCorrect(
	userGrid: CellState[][],
	solution: boolean[][],
	col: number,
): boolean {
	for (let row = 0; row < solution.length; row++) {
		const shouldBeFilled = solution[row][col];
		const userFilled = userGrid[row]?.[col] === "filled";
		if (shouldBeFilled !== userFilled) return false;
	}
	return true;
}

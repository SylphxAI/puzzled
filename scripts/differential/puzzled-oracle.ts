#!/usr/bin/env bun
/**
 * TS oracle for puzzled game-core differential parity (ADR-168 S2).
 *
 * Re-executes frozen generators/scoring from apps/puzzled against the golden
 * corpus and emits canonical JSON for Rust differential tests / CI.
 *
 * Fail-closed: no SKIP-as-pass. Requires bun.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  seededRandom,
  shuffleArray,
} from "../../apps/puzzled/src/games/shared/random.ts";
import { generateSudokuPuzzle } from "../../apps/puzzled/src/games/sudoku/generator.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const GRID_GOLDEN = join(REPO_ROOT, "fixtures/puzzle-grid/golden.json");
const SOLUTION_GOLDEN = join(REPO_ROOT, "fixtures/puzzle-solution/golden.json");

interface GridGolden {
  randomCases: Array<{
    id: string;
    seed: number;
    values: number[];
    input?: string[];
    output?: string[];
  }>;
  sudokuCases: Array<{
    id: string;
    seed: number;
    difficulty: "easy" | "medium" | "hard";
    puzzleData: unknown;
    solution: unknown;
  }>;
  httpCases: Array<{ id: string }>;
}

interface SolutionGolden {
  scoringCases: Array<{
    id: string;
    seed: number;
    difficulty: "easy" | "medium" | "hard";
    submission: {
      status: "won" | "lost";
      attempts: number;
      timeSpentMs: number;
      data: { finalGrid: (number | null)[][]; mistakes?: number };
    };
    expected: Record<string, unknown>;
  }>;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateAndScore(
  solution: { grid: number[][] },
  submission: SolutionGolden["scoringCases"][0]["submission"],
): Record<string, unknown> {
  const data = submission.data;
  if (!data?.finalGrid) return { valid: false, error: "Missing final grid data" };
  const finalGrid = data.finalGrid;
  if (!Array.isArray(finalGrid) || finalGrid.length !== 9) {
    return { valid: false, error: "Invalid grid dimensions" };
  }
  let allCorrect = true;
  for (let row = 0; row < 9; row++) {
    if (!Array.isArray(finalGrid[row]) || finalGrid[row].length !== 9) {
      return { valid: false, error: `Invalid row ${row} dimensions` };
    }
    for (let col = 0; col < 9; col++) {
      if (finalGrid[row][col] !== solution.grid[row][col]) {
        allCorrect = false;
        break;
      }
    }
    if (!allCorrect) break;
  }
  if (submission.status === "won" && !allCorrect) {
    return {
      valid: false,
      error: "Invalid win claim - grid does not match solution",
    };
  }
  if (submission.status === "lost" && allCorrect) {
    return {
      valid: false,
      error: "Invalid loss claim - grid matches solution",
    };
  }
  if (!allCorrect) return { valid: true, status: "lost", score: 0 };
  const seconds = Math.floor(submission.timeSpentMs / 1000);
  const timePenalty = Math.min(500, seconds);
  const mistakes = data.mistakes ?? 0;
  const score = Math.max(100, 1000 - timePenalty - mistakes * 50);
  return { valid: true, status: "won", score };
}

function main(): void {
  const grid = JSON.parse(readFileSync(GRID_GOLDEN, "utf8")) as GridGolden;
  const solution = JSON.parse(
    readFileSync(SOLUTION_GOLDEN, "utf8"),
  ) as SolutionGolden;

  const failures: string[] = [];
  const cases: Array<Record<string, unknown>> = [];

  for (const c of grid.randomCases) {
    const r = seededRandom(c.seed);
    const values = Array.from({ length: c.values.length }, () => r());
    for (let i = 0; i < values.length; i++) {
      if (Math.abs(values[i] - c.values[i]) > 1e-12) {
        failures.push(`random ${c.id} value[${i}]`);
      }
    }
    if (c.input && c.output) {
      const r2 = seededRandom(c.seed);
      const out = shuffleArray(c.input, r2);
      if (JSON.stringify(out) !== JSON.stringify(c.output)) {
        failures.push(`shuffle ${c.id}`);
      }
      cases.push({
        id: c.id,
        slice: "puzzle-grid-generation",
        domain: "random",
        seed: c.seed,
        values,
        shuffle: out,
      });
    }
  }

  for (const c of grid.sudokuCases) {
    const p = generateSudokuPuzzle(c.seed, c.difficulty);
    if (
      JSON.stringify(p.puzzleData) !== JSON.stringify(c.puzzleData) ||
      JSON.stringify(p.solution) !== JSON.stringify(c.solution)
    ) {
      failures.push(`sudoku ${c.id}`);
    }
    cases.push({
      id: c.id,
      slice: "puzzle-grid-generation",
      domain: "sudoku",
      seed: c.seed,
      difficulty: c.difficulty,
      puzzleData: p.puzzleData,
      solution: p.solution,
    });
  }

  for (const c of solution.scoringCases) {
    const p = generateSudokuPuzzle(c.seed, c.difficulty);
    const actual = validateAndScore(p.solution, c.submission);
    if (JSON.stringify(actual) !== JSON.stringify(c.expected)) {
      failures.push(`scoring ${c.id}: ${JSON.stringify(actual)} != ${JSON.stringify(c.expected)}`);
    }
    cases.push({
      id: c.id,
      slice: "puzzle-solution-submit",
      domain: "scoring",
      seed: c.seed,
      difficulty: c.difficulty,
      expected: actual,
    });
  }

  if (failures.length > 0) {
    console.error("ORACLE_FAIL", failures);
    process.exit(1);
  }

  const corpus = {
    corpusVersion: 1,
    fixtureCorpusHash: sha256Json({ grid, solution }),
    caseCount: cases.length,
    cases,
  };
  const outDir = join(__dirname, "fixtures");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "puzzled-oracle-out.json");
  writeFileSync(outPath, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(
    JSON.stringify({
      ok: true,
      caseCount: cases.length,
      fixtureCorpusHash: corpus.fixtureCorpusHash,
      outPath,
    }),
  );
}

main();

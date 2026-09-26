//! Daily generator for `pip-place` (Spots): a port with byte parity of
//! `apps/puzzled/src/games/pip-place/generator.ts`, checked against
//! `tests/fixtures/generate/pip-place.json`.
//!
//! A seeded domino tiling of a 4×5 board, the complete double-3 set shuffled
//! onto the pairs, then 6–8 connected regions of size 2–4 whose constraints
//! come from the placed pips. Always succeeds; uniqueness is not required.

use std::collections::{HashMap, HashSet};

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::{shuffle_array, SeededRandom};

const DAILY_MAX_PIP: i64 = 3;
const DAILY_ROWS: usize = 4;
const DAILY_COLS: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Cell {
    row: usize,
    col: usize,
}

#[derive(Debug, Clone, Copy)]
struct Cover {
    a: Cell,
    b: Cell,
}

#[derive(Debug, Clone, Copy)]
struct Tile {
    a: Cell,
    b: Cell,
    pa: i64,
    pb: i64,
}

#[derive(Debug, Clone)]
struct Region {
    id: usize,
    kind: &'static str,
    value: Option<i64>,
}

fn cell_id(cell: Cell, cols: usize) -> usize {
    cell.row * cols + cell.col
}

fn from_id(id: usize, cols: usize) -> Cell {
    Cell {
        row: id / cols,
        col: id % cols,
    }
}

fn first_empty(occupied: &[Vec<bool>]) -> Option<Cell> {
    for (row, line) in occupied.iter().enumerate() {
        for (col, taken) in line.iter().enumerate() {
            if !taken {
                return Some(Cell { row, col });
            }
        }
    }
    None
}

fn tile_dfs(
    occupied: &mut Vec<Vec<bool>>,
    result: &mut Vec<Cover>,
    rows: usize,
    cols: usize,
    random: &mut SeededRandom,
) -> bool {
    let Some(cell) = first_empty(occupied) else {
        return true;
    };
    let mut options: Vec<Cover> = Vec::new();
    if cell.col + 1 < cols && !occupied[cell.row][cell.col + 1] {
        options.push(Cover {
            a: cell,
            b: Cell {
                row: cell.row,
                col: cell.col + 1,
            },
        });
    }
    if cell.row + 1 < rows && !occupied[cell.row + 1][cell.col] {
        options.push(Cover {
            a: cell,
            b: Cell {
                row: cell.row + 1,
                col: cell.col,
            },
        });
    }
    for cover in shuffle_array(&options, random) {
        occupied[cover.a.row][cover.a.col] = true;
        occupied[cover.b.row][cover.b.col] = true;
        result.push(cover);
        if tile_dfs(occupied, result, rows, cols, random) {
            return true;
        }
        result.pop();
        occupied[cover.a.row][cover.a.col] = false;
        occupied[cover.b.row][cover.b.col] = false;
    }
    false
}

fn generate_matching(
    rows: usize,
    cols: usize,
    random: &mut SeededRandom,
) -> Result<Vec<Cover>, String> {
    let mut occupied = vec![vec![false; cols]; rows];
    let mut result = Vec::new();
    if !tile_dfs(&mut occupied, &mut result, rows, cols, random) {
        return Err("Spots generator: board is not tileable".to_string());
    }
    Ok(result)
}

fn double_set(max_pip: i64) -> Vec<(i64, i64)> {
    let mut out = Vec::new();
    for a in 0..=max_pip {
        for b in a..=max_pip {
            out.push((a, b));
        }
    }
    out
}

fn assign_tiles(covers: &[Cover], max_pip: i64, random: &mut SeededRandom) -> Vec<Tile> {
    let set = shuffle_array(&double_set(max_pip), random);
    covers
        .iter()
        .enumerate()
        .map(|(i, cover)| {
            let pair = set.get(i).copied().unwrap_or((0, 0));
            if random.next_f64() < 0.5 {
                Tile {
                    a: cover.a,
                    b: cover.b,
                    pa: pair.0,
                    pb: pair.1,
                }
            } else {
                Tile {
                    a: cover.a,
                    b: cover.b,
                    pa: pair.1,
                    pb: pair.0,
                }
            }
        })
        .collect()
}

fn pip_at(tiles: &[Tile], cell: Cell) -> Option<i64> {
    for tile in tiles {
        if tile.a == cell {
            return Some(tile.pa);
        }
        if tile.b == cell {
            return Some(tile.pb);
        }
    }
    None
}

fn grid_edges(rows: usize, cols: usize) -> Vec<(usize, usize)> {
    let mut edges = Vec::new();
    for row in 0..rows {
        for col in 0..cols {
            let id = row * cols + col;
            if col + 1 < cols {
                edges.push((id, id + 1));
            }
            if row + 1 < rows {
                edges.push((id, id + cols));
            }
        }
    }
    edges
}

fn find(parent: &[usize], x: usize) -> usize {
    let mut cur = x;
    while parent[cur] != cur {
        cur = parent[cur];
    }
    cur
}

fn remap_regions(parent: &[usize], rows: usize, cols: usize) -> Option<Vec<Vec<usize>>> {
    let n = rows * cols;
    let mut roots: Vec<usize> = Vec::new();
    let mut root_index: HashMap<usize, usize> = HashMap::new();
    for i in 0..n {
        let root = find(parent, i);
        if let std::collections::hash_map::Entry::Vacant(entry) = root_index.entry(root) {
            entry.insert(roots.len());
            roots.push(root);
        }
    }
    if roots.len() < 6 || roots.len() > 8 {
        return None;
    }
    let mut sizes = vec![0usize; roots.len()];
    let mut region_of = vec![vec![0usize; cols]; rows];
    for i in 0..n {
        let idx = *root_index.get(&find(parent, i))?;
        sizes[idx] += 1;
        let cell = from_id(i, cols);
        region_of[cell.row][cell.col] = idx;
    }
    if sizes.iter().any(|size| *size < 2 || *size > 4) {
        return None;
    }
    Some(region_of)
}

/// Union by size with the TS swap rule; refuses unions past size 4.
fn union_ranked(parent: &mut [usize], size: &mut [usize], a: usize, b: usize) -> bool {
    let mut ra = find(parent, a);
    let mut rb = find(parent, b);
    if ra == rb || size[ra] + size[rb] > 4 {
        return false;
    }
    if size[ra] < size[rb] {
        std::mem::swap(&mut ra, &mut rb);
    }
    parent[rb] = ra;
    size[ra] += size[rb];
    true
}

fn try_random_regions(
    rows: usize,
    cols: usize,
    random: &mut SeededRandom,
) -> Option<Vec<Vec<usize>>> {
    let n = rows * cols;
    let mut parent: Vec<usize> = (0..n).collect();
    let mut size = vec![1usize; n];
    let edges = shuffle_array(&grid_edges(rows, cols), random);
    for &(a, b) in &edges {
        let sa = size[find(&parent, a)];
        let sb = size[find(&parent, b)];
        // `sa === 1 || sb === 1 || random() < 0.55`: the draw happens only when
        // neither side is a singleton (JS short-circuit).
        if sa == 1 || sb == 1 || random.next_f64() < 0.55 {
            union_ranked(&mut parent, &mut size, a, b);
        }
    }
    for &(a, b) in &edges {
        if size[find(&parent, a)] == 1 || size[find(&parent, b)] == 1 {
            union_ranked(&mut parent, &mut size, a, b);
        }
    }
    let component_count = |parent: &[usize]| -> usize {
        (0..n)
            .map(|i| find(parent, i))
            .collect::<HashSet<_>>()
            .len()
    };
    if component_count(&parent) > 8 {
        for &(a, b) in &edges {
            if component_count(&parent) <= 8 {
                break;
            }
            union_ranked(&mut parent, &mut size, a, b);
        }
    }
    remap_regions(&parent, rows, cols)
}

fn fallback_regions(rows: usize, cols: usize, random: &mut SeededRandom) -> Vec<Vec<usize>> {
    let n = rows * cols;
    let mut parent: Vec<usize> = (0..n).collect();
    let mut size = vec![1usize; n];
    // Plain union (no size swap), as in the TS fallback.
    let union = |parent: &mut Vec<usize>, size: &mut Vec<usize>, a: usize, b: usize| -> bool {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra == rb || size[ra] + size[rb] > 4 {
            return false;
        }
        parent[rb] = ra;
        size[ra] += size[rb];
        true
    };
    for col in 0..cols {
        let mut row = 0;
        while row + 1 < rows {
            union(
                &mut parent,
                &mut size,
                cell_id(Cell { row, col }, cols),
                cell_id(Cell { row: row + 1, col }, cols),
            );
            row += 2;
        }
    }
    let mut adjacent: Vec<(usize, usize)> = Vec::new();
    for a in 0..n {
        for b in (a + 1)..n {
            if find(&parent, a) == find(&parent, b) {
                continue;
            }
            let (ca, cb) = (from_id(a, cols), from_id(b, cols));
            if ca.row.abs_diff(cb.row) + ca.col.abs_diff(cb.col) != 1 {
                continue;
            }
            adjacent.push((a, b));
        }
    }
    let merges_wanted = 2 + (random.next_f64() * 3.0).floor() as usize;
    let mut merged = 0;
    for (a, b) in shuffle_array(&adjacent, random) {
        if merged >= merges_wanted {
            break;
        }
        if union(&mut parent, &mut size, a, b) {
            merged += 1;
        }
    }
    if let Some(mapped) = remap_regions(&parent, rows, cols) {
        return mapped;
    }
    // Last resort: vertical dominoes, numbered column by column.
    let pairs_per_col = rows / 2;
    (0..rows)
        .map(|row| {
            (0..cols)
                .map(|col| {
                    if row / 2 < pairs_per_col {
                        col * pairs_per_col + row / 2
                    } else {
                        0
                    }
                })
                .collect()
        })
        .collect()
}

fn generate_regions(rows: usize, cols: usize, random: &mut SeededRandom) -> Vec<Vec<usize>> {
    for _ in 0..80 {
        if let Some(found) = try_random_regions(rows, cols, random) {
            return found;
        }
    }
    fallback_regions(rows, cols, random)
}

fn region_pips(region_of: &[Vec<usize>], tiles: &[Tile], id: usize) -> Vec<i64> {
    let mut pips = Vec::new();
    for (row, line) in region_of.iter().enumerate() {
        for (col, region) in line.iter().enumerate() {
            if *region != id {
                continue;
            }
            if let Some(pip) = pip_at(tiles, Cell { row, col }) {
                pips.push(pip);
            }
        }
    }
    pips
}

struct RegionStat {
    id: usize,
    pips: Vec<i64>,
    sum: i64,
    can_equal: bool,
    can_unequal: bool,
}

fn assign_constraints(
    region_of: &[Vec<usize>],
    tiles: &[Tile],
    random: &mut SeededRandom,
) -> Vec<Region> {
    let mut ordered: Vec<usize> = region_of
        .iter()
        .flatten()
        .copied()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    ordered.sort_unstable();
    let stats: Vec<RegionStat> = ordered
        .iter()
        .map(|&id| {
            let pips = region_pips(region_of, tiles, id);
            let sum = pips.iter().sum();
            let can_equal = !pips.is_empty() && pips.iter().all(|pip| *pip == pips[0]);
            let can_unequal =
                !pips.is_empty() && pips.iter().collect::<HashSet<_>>().len() == pips.len();
            RegionStat {
                id,
                pips,
                sum,
                can_equal,
                can_unequal,
            }
        })
        .collect();

    let mut assigned: Vec<Region> = stats
        .iter()
        .map(|stat| Region {
            id: stat.id,
            kind: "sum",
            value: Some(stat.sum),
        })
        .collect();

    let equal_candidates: Vec<(usize, bool)> = shuffle_array(
        &stats
            .iter()
            .enumerate()
            .map(|(index, stat)| (index, stat.can_equal))
            .collect::<Vec<_>>(),
        random,
    )
    .into_iter()
    .filter(|(_, ok)| *ok)
    .collect();
    if let Some(&(idx, _)) = equal_candidates.first() {
        let first = stats[idx].pips.first().copied().unwrap_or(0);
        assigned[idx] = Region {
            id: stats[idx].id,
            kind: "equal",
            value: Some(first),
        };
    }

    let unequal_candidates: Vec<(usize, bool)> = shuffle_array(
        &stats
            .iter()
            .enumerate()
            .map(|(index, stat)| (index, stat.can_unequal && assigned[index].kind != "equal"))
            .collect::<Vec<_>>(),
        random,
    )
    .into_iter()
    .filter(|(_, ok)| *ok)
    .collect();
    if let Some(&(idx, _)) = unequal_candidates.first() {
        assigned[idx] = Region {
            id: stats[idx].id,
            kind: "unequal",
            value: None,
        };
    }

    let mut non_free = assigned.len();
    for region in &mut assigned {
        if non_free <= 3 {
            break;
        }
        if random.next_f64() >= 0.12 {
            continue;
        }
        *region = Region {
            id: region.id,
            kind: "free",
            value: None,
        };
        non_free -= 1;
    }

    if non_free < 3 {
        for (i, region) in assigned.iter_mut().enumerate() {
            if non_free >= 3 {
                break;
            }
            if region.kind != "free" {
                continue;
            }
            *region = Region {
                id: stats[i].id,
                kind: "sum",
                value: Some(stats[i].sum),
            };
            non_free += 1;
        }
    }
    assigned
}

fn cell_json(cell: Cell) -> Value {
    json!({ "row": cell.row, "col": cell.col })
}

/// `(puzzle_data, solution)` for a seed. Difficulty is not used by this game.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let (rows, cols, max_pip) = (DAILY_ROWS, DAILY_COLS, DAILY_MAX_PIP);
    let mut random = SeededRandom::new(seed);
    let covers = generate_matching(rows, cols, &mut random)?;
    let tiles = assign_tiles(&covers, max_pip, &mut random);
    let region_of = generate_regions(rows, cols, &mut random);
    let regions = assign_constraints(&region_of, &tiles, &mut random);

    let puzzle_data = json!({
        "maxPip": max_pip,
        "rows": rows,
        "cols": cols,
        "regionOf": region_of,
        "regions": regions
            .iter()
            .map(|region| json!({ "id": region.id, "kind": region.kind, "value": region.value }))
            .collect::<Vec<_>>(),
    });
    let solution = json!({
        "tiles": tiles
            .iter()
            .map(|tile| json!({
                "a": cell_json(tile.a),
                "b": cell_json(tile.b),
                "pa": tile.pa,
                "pb": tile.pb,
            }))
            .collect::<Vec<_>>(),
    });
    Ok((puzzle_data, solution))
}

/// The validator grades `{ tiles }`, the same shape as the solution.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "tiles": solution.get("tiles").cloned().unwrap_or(Value::Null) })
}

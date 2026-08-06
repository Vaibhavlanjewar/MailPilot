/**
 * Pure backtracking algorithms that record every move they make.
 *
 * Each returns a flat `steps` array describing what happened, so the UI can
 * replay it forwards or backwards. Keeping these free of React means they can
 * be reasoned about (and tested) on their own.
 *
 * A hard step cap guards the UI: N-Queens and Sudoku can explore enormous
 * search spaces on adversarial inputs, and an unbounded trace would freeze the
 * tab while it allocated millions of objects.
 */
const MAX_STEPS = 200_000;

// ---------------------------------------------------------------- Sudoku ----

export function isValidSudokuMove(grid, row, col, value) {
  for (let i = 0; i < 9; i += 1) {
    if (i !== col && grid[row][i] === value) return false;
    if (i !== row && grid[i][col] === value) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if ((r !== row || c !== col) && grid[r][c] === value) return false;
    }
  }
  return true;
}

/**
 * @param {number[][]} puzzle 9x9, 0 = empty
 * @returns {{ steps: Array, solved: boolean, solution: number[][] | null }}
 */
export function solveSudoku(puzzle) {
  const grid = puzzle.map((row) => [...row]);
  const steps = [];
  let capped = false;

  function search() {
    if (capped) return false;
    let row = -1;
    let col = -1;
    for (let r = 0; r < 9 && row === -1; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (grid[r][c] === 0) {
          row = r;
          col = c;
          break;
        }
      }
    }
    if (row === -1) return true; // no empty cell left

    for (let value = 1; value <= 9; value += 1) {
      if (steps.length >= MAX_STEPS) {
        capped = true;
        return false;
      }
      if (!isValidSudokuMove(grid, row, col, value)) continue;

      grid[row][col] = value;
      steps.push({ type: 'place', row, col, value });

      if (search()) return true;

      grid[row][col] = 0;
      steps.push({ type: 'remove', row, col, value });
    }
    return false;
  }

  const solved = search();
  return { steps, solved, solution: solved ? grid : null, capped };
}

/**
 * A fixed puzzle set — generating uniquely-solvable puzzles is a project of its
 * own. Step counts are noted because they decide whether a solve is watchable:
 * a puzzle needing hundreds of thousands of steps just looks like a stuck
 * progress bar, so anything pathological is deliberately excluded.
 */
export const SUDOKU_PUZZLES = [
  {
    name: 'Quick (~300 steps)',
    grid: [
      [0, 0, 4, 3, 0, 0, 2, 0, 9],
      [0, 0, 5, 0, 0, 9, 0, 0, 1],
      [0, 7, 0, 0, 6, 0, 0, 4, 3],
      [0, 0, 6, 0, 0, 2, 0, 8, 7],
      [1, 9, 0, 0, 0, 7, 4, 0, 0],
      [0, 5, 0, 0, 8, 3, 0, 0, 0],
      [6, 0, 0, 0, 0, 0, 1, 0, 5],
      [0, 0, 3, 5, 0, 8, 6, 9, 0],
      [0, 4, 2, 9, 1, 0, 3, 0, 0],
    ],
  },
  {
    name: 'Gentle (~8k steps)',
    grid: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ],
  },
  {
    name: 'Tough (~18k steps, heavy backtracking)',
    grid: [
      [1, 0, 0, 0, 0, 7, 0, 9, 0],
      [0, 3, 0, 0, 2, 0, 0, 0, 8],
      [0, 0, 9, 6, 0, 0, 5, 0, 0],
      [0, 0, 5, 3, 0, 0, 9, 0, 0],
      [0, 1, 0, 0, 8, 0, 0, 0, 2],
      [6, 0, 0, 0, 0, 4, 0, 0, 0],
      [3, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 4, 0, 0, 0, 0, 0, 0, 7],
      [0, 0, 7, 0, 0, 0, 3, 0, 0],
    ],
  },
];

// --------------------------------------------------------- Rat in a Maze ----

/**
 * @param {number[][]} maze 1 = open, 0 = wall
 * @returns {{ steps: Array, solved: boolean, path: Array<[number, number]> }}
 */
export function solveMaze(maze) {
  const n = maze.length;
  const m = maze[0].length;
  const visited = Array.from({ length: n }, () => Array(m).fill(false));
  const steps = [];
  const path = [];

  // Down, Right, Up, Left — a fixed order makes the trace reproducible.
  const moves = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];

  function search(row, col) {
    if (row < 0 || col < 0 || row >= n || col >= m) return false;
    if (maze[row][col] === 0 || visited[row][col]) return false;
    if (steps.length >= MAX_STEPS) return false;

    visited[row][col] = true;
    path.push([row, col]);
    steps.push({ type: 'enter', row, col });

    if (row === n - 1 && col === m - 1) {
      steps.push({ type: 'goal', row, col });
      return true;
    }

    for (const [dr, dc] of moves) {
      if (search(row + dr, col + dc)) return true;
    }

    // Dead end: undo so the cell is free for a different route to try.
    visited[row][col] = false;
    path.pop();
    steps.push({ type: 'backtrack', row, col });
    return false;
  }

  const solved = search(0, 0);
  return { steps, solved, path: solved ? [...path] : [] };
}

export const MAZES = [
  {
    name: 'Simple',
    grid: [
      [1, 0, 0, 0],
      [1, 1, 0, 1],
      [0, 1, 0, 0],
      [1, 1, 1, 1],
    ],
  },
  {
    name: 'Dead ends',
    grid: [
      [1, 1, 1, 0, 0, 1],
      [0, 0, 1, 1, 0, 1],
      [1, 1, 1, 0, 0, 1],
      [1, 0, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 0],
      [1, 1, 1, 1, 1, 1],
    ],
  },
  {
    name: 'No way through',
    grid: [
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
];

// ------------------------------------------------------------- N-Queens ----

/**
 * @param {number} n
 * @returns {{ steps: Array, solutions: number[][], firstSolution: number[] | null }}
 */
export function solveNQueens(n, { stopAtFirst = true } = {}) {
  const steps = [];
  const cols = [];
  const solutions = [];

  function safe(row, col) {
    for (let r = 0; r < cols.length; r += 1) {
      const c = cols[r];
      if (c === col || Math.abs(r - row) === Math.abs(c - col)) return false;
    }
    return true;
  }

  function search(row) {
    if (row === n) {
      solutions.push([...cols]);
      steps.push({ type: 'solution', queens: [...cols] });
      return stopAtFirst;
    }
    for (let col = 0; col < n; col += 1) {
      if (steps.length >= MAX_STEPS) return true;
      steps.push({ type: 'try', row, col });
      if (!safe(row, col)) {
        steps.push({ type: 'reject', row, col });
        continue;
      }
      cols.push(col);
      steps.push({ type: 'place', row, col });

      if (search(row + 1)) return true;

      cols.pop();
      steps.push({ type: 'remove', row, col });
    }
    return false;
  }

  search(0);
  return { steps, solutions, firstSolution: solutions[0] || null };
}

// ---------------------------------------------------------- Tic Tac Toe ----

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** @returns {{ winner: 'X'|'O'|null, line: number[]|null, draw: boolean }} */
export function evaluateBoard(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line, draw: false };
    }
  }
  return { winner: null, line: null, draw: board.every(Boolean) };
}

/**
 * Minimax with depth preference, so the AI wins as fast as possible and loses as
 * slowly as possible instead of treating all wins as equal. Full game tree —
 * only 9! leaves at worst, so no pruning needed for correctness or speed.
 *
 * @returns {{ move: number, score: number, scores: Array<{move:number,score:number}>, nodes: number }}
 */
export function bestMove(board, aiMark = 'O') {
  const humanMark = aiMark === 'O' ? 'X' : 'O';
  let nodes = 0;

  function minimax(state, isMaximising, depth) {
    nodes += 1;
    const { winner, draw } = evaluateBoard(state);
    if (winner === aiMark) return 10 - depth;
    if (winner === humanMark) return depth - 10;
    if (draw) return 0;

    let best = isMaximising ? -Infinity : Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (state[i]) continue;
      state[i] = isMaximising ? aiMark : humanMark;
      const score = minimax(state, !isMaximising, depth + 1);
      state[i] = null;
      best = isMaximising ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  const working = [...board];
  const scores = [];
  for (let i = 0; i < 9; i += 1) {
    if (working[i]) continue;
    working[i] = aiMark;
    scores.push({ move: i, score: minimax(working, false, 1) });
    working[i] = null;
  }

  if (!scores.length) return { move: -1, score: 0, scores: [], nodes };
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
  return { move: top.move, score: top.score, scores, nodes };
}

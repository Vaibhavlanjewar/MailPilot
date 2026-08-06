import React, { useState } from 'react';
import SudokuBoard from './SudokuBoard';
import MazeBoard from './MazeBoard';
import NQueensBoard from './NQueensBoard';
import TicTacToe from './TicTacToe';

const GAMES = [
  {
    id: 'sudoku',
    label: 'Sudoku',
    blurb:
      'The textbook backtracking problem: fill a cell, recurse, and undo the moment the grid contradicts itself.',
    Component: SudokuBoard,
  },
  {
    id: 'maze',
    label: 'Rat in a Maze',
    blurb:
      'Recursive path search. Every dead end unwinds one frame and tries the next direction.',
    Component: MazeBoard,
  },
  {
    id: 'queens',
    label: 'N-Queens',
    blurb:
      'Place a queen per row, abandon the branch as soon as one is attacked. The clearest picture of a search tree pruning itself.',
    Component: NQueensBoard,
  },
  {
    id: 'tictactoe',
    label: 'Tic Tac Toe',
    blurb:
      'Minimax game-tree recursion — or a quick match against another candidate. A genuine break, and the same idea underneath.',
    Component: TicTacToe,
  },
];

export default function AlgorithmPlayground() {
  const [active, setActive] = useState('sudoku');
  const game = GAMES.find((g) => g.id === active);
  const Active = game.Component;

  return (
    <div className="space-y-5 rounded-2xl border border-surface-border bg-app-surface p-4 md:p-6">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">
          Algorithm playground
        </h2>
        <p className="mt-1 text-sm text-app-muted">
          Backtracking comes up constantly in interviews and is much easier to reason about once
          you've watched it run. Step through these, or just take a break.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActive(g.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active === g.id
                ? 'bg-app-gradient text-white shadow-md'
                : 'border border-surface-border text-app-muted hover:border-primary hover:text-app'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-app-muted">{game.blurb}</p>

      <div className="overflow-x-auto">
        <Active />
      </div>
    </div>
  );
}

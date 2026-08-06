import React, { lazy, Suspense, useState } from 'react';

// Boards + their algorithms are dead weight until someone actually opens a
// game, and the main bundle is already over 1 MB — so each loads on demand.
const SudokuBoard = lazy(() => import('../components/playground/SudokuBoard'));
const MazeBoard = lazy(() => import('../components/playground/MazeBoard'));
const NQueensBoard = lazy(() => import('../components/playground/NQueensBoard'));
const TicTacToe = lazy(() => import('../components/playground/TicTacToe'));

const GAMES = [
  {
    id: 'sudoku',
    label: 'Sudoku',
    tag: 'Backtracking',
    blurb: 'Play it yourself, or watch the solver guess, hit a contradiction, and rewind.',
    accent: 'from-indigo-500 to-blue-600',
    Component: SudokuBoard,
    icon: GridIcon,
  },
  {
    id: 'maze',
    label: 'Rat in a Maze',
    tag: 'Recursion',
    blurb: 'Watch a path get explored, dead-end, and unwind one step at a time.',
    accent: 'from-emerald-500 to-teal-600',
    Component: MazeBoard,
    icon: MazeIcon,
  },
  {
    id: 'queens',
    label: 'N-Queens',
    tag: 'Pruning',
    blurb: 'Place queens row by row and see branches abandoned the moment one is attacked.',
    accent: 'from-fuchsia-500 to-purple-600',
    Component: NQueensBoard,
    icon: CrownIcon,
  },
  {
    id: 'tictactoe',
    label: 'Tic Tac Toe',
    tag: '2 player · vs AI',
    blurb: 'Take on an unbeatable minimax AI, or share a link and play a friend.',
    accent: 'from-amber-500 to-orange-600',
    Component: TicTacToe,
    icon: HashIcon,
  },
];

export default function MindGames() {
  // Opening a shared game link should land directly in Tic Tac Toe.
  const [active, setActive] = useState(() =>
    new URLSearchParams(window.location.search).get('game') ? 'tictactoe' : null,
  );

  const game = GAMES.find((g) => g.id === active);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="rounded-2xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Mind Games</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-100 md:text-base">
          A break from the job hunt that still counts for something. Each one is a classic
          recursion problem you can step through instruction by instruction — the same patterns
          interviewers ask about.
        </p>
      </header>

      {game ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActive(null)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-app-muted transition hover:border-primary hover:text-app"
            >
              ← All games
            </button>
            <div className="flex flex-wrap gap-1.5">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActive(g.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active === g.id
                      ? 'bg-app-gradient text-white shadow-sm'
                      : 'border border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-border bg-app-surface shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border p-5">
              <div>
                <h2 className="text-lg font-bold text-app">{game.label}</h2>
                <p className="mt-0.5 text-sm text-app-muted">{game.blurb}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {game.tag}
              </span>
            </div>
            <div className="overflow-x-auto p-5">
              <Suspense fallback={<p className="text-sm text-app-muted">Loading…</p>}>
                <game.Component />
              </Suspense>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActive(g.id)}
              className="group flex flex-col items-start rounded-2xl border border-surface-border bg-app-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g.accent} text-white shadow-sm`}
                >
                  <g.icon />
                </span>
                <span className="rounded-full bg-default-bg px-2.5 py-1 text-[11px] font-semibold text-app-muted">
                  {g.tag}
                </span>
              </div>
              <h2 className="mt-4 text-base font-bold text-app">{g.label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-app-muted">{g.blurb}</p>
              <span className="mt-4 text-sm font-semibold text-primary group-hover:underline">
                Open →
              </span>
            </button>
          ))}
        </section>
      )}

      <p className="rounded-xl border border-surface-border bg-app-surface p-4 text-xs leading-relaxed text-app-muted">
        Every solver here runs to completion first and records what it did, so you can scrub
        backwards and forwards through the search — including the moment it undoes a wrong guess.
        That undo is the backtracking.
      </p>
    </div>
  );
}

/* Inline so the page carries no icon-library weight. */
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  );
}

function MazeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 3h18v18H3z" />
      <path d="M7 3v10h6V7h4M7 21v-4h10" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 7l4 4 5-7 5 7 4-4v11H3z" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  );
}

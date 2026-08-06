import React, { useMemo, useState } from 'react';
import { SUDOKU_PUZZLES, solveSudoku, isValidSudokuMove } from './algorithms';
import { useStepPlayer, StepControls } from './useStepPlayer';

/** Replays the recorded trace up to `count` to get the grid at that moment. */
function gridAtStep(puzzle, steps, count) {
  const grid = puzzle.map((row) => [...row]);
  for (let i = 0; i < count; i += 1) {
    const s = steps[i];
    grid[s.row][s.col] = s.type === 'place' ? s.value : 0;
  }
  return grid;
}

export default function SudokuBoard() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [speed, setSpeed] = useState(40);
  const [mode, setMode] = useState('play'); // play | solve
  const [entries, setEntries] = useState({}); // "r-c" -> value, the user's own moves
  const [selected, setSelected] = useState(null);

  const puzzle = SUDOKU_PUZZLES[puzzleIndex].grid;

  // Solving is a pure function of the puzzle, so it only reruns when that changes.
  const { steps, solved } = useMemo(() => solveSudoku(puzzle), [puzzle]);
  const player = useStepPlayer(steps, { speed });

  const solveGrid = useMemo(
    () => gridAtStep(puzzle, steps, player.index),
    [puzzle, steps, player.index],
  );

  const lastStep = player.index > 0 ? steps[player.index - 1] : null;

  const playGrid = useMemo(() => {
    const grid = puzzle.map((row) => [...row]);
    for (const [key, value] of Object.entries(entries)) {
      const [r, c] = key.split('-').map(Number);
      grid[r][c] = value;
    }
    return grid;
  }, [puzzle, entries]);

  const grid = mode === 'solve' ? solveGrid : playGrid;

  const conflicts = useMemo(() => {
    if (mode !== 'play') return new Set();
    const bad = new Set();
    for (const key of Object.keys(entries)) {
      const [r, c] = key.split('-').map(Number);
      const value = playGrid[r][c];
      if (value && !isValidSudokuMove(playGrid, r, c, value)) bad.add(key);
    }
    return bad;
  }, [entries, playGrid, mode]);

  const filled = playGrid.flat().filter(Boolean).length;
  const playComplete = filled === 81 && conflicts.size === 0;

  function handleCellInput(row, col, raw) {
    if (puzzle[row][col] !== 0) return; // givens are fixed
    const key = `${row}-${col}`;
    const value = Number(raw);
    setEntries((prev) => {
      const next = { ...prev };
      if (!raw || Number.isNaN(value) || value < 1 || value > 9) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function handleKeyDown(e, row, col) {
    if (e.key >= '1' && e.key <= '9') handleCellInput(row, col, e.key);
    else if (['Backspace', 'Delete', '0'].includes(e.key)) handleCellInput(row, col, '');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={puzzleIndex}
          onChange={(e) => {
            setPuzzleIndex(Number(e.target.value));
            setEntries({});
          }}
          className="rounded-lg border border-input-border bg-default-bg px-3 py-1.5 text-sm text-app"
        >
          {SUDOKU_PUZZLES.map((p, i) => (
            <option key={p.name} value={i}>{p.name}</option>
          ))}
        </select>

        <div className="flex gap-1 rounded-lg bg-default-bg p-1">
          {['play', 'solve'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-semibold capitalize transition ${
                mode === m ? 'bg-app-surface text-app shadow-soft' : 'text-app-muted'
              }`}
            >
              {m === 'play' ? 'Play it' : 'Watch it solve'}
            </button>
          ))}
        </div>

        {mode === 'play' && (
          <button
            type="button"
            onClick={() => setEntries({})}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-app transition hover:border-primary"
          >
            Clear my entries
          </button>
        )}
      </div>

      <div className="inline-block rounded-xl border-2 border-app-muted/40 bg-app-surface p-1">
        {grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((value, c) => {
              const isGiven = puzzle[r][c] !== 0;
              const key = `${r}-${c}`;
              const isActive = mode === 'solve' && lastStep && lastStep.row === r && lastStep.col === c;
              const isConflict = conflicts.has(key);
              const isSelected = selected === key;

              return (
                <div
                  key={c}
                  className={[
                    'flex h-9 w-9 items-center justify-center border text-sm font-semibold transition-colors sm:h-10 sm:w-10',
                    'border-surface-border',
                    r % 3 === 0 ? 'border-t-2 border-t-app-muted/40' : '',
                    c % 3 === 0 ? 'border-l-2 border-l-app-muted/40' : '',
                    r === 8 ? 'border-b-2 border-b-app-muted/40' : '',
                    c === 8 ? 'border-r-2 border-r-app-muted/40' : '',
                    isGiven ? 'text-app' : 'text-primary',
                    isActive && lastStep?.type === 'place' ? 'bg-emerald-500/25' : '',
                    isActive && lastStep?.type === 'remove' ? 'bg-rose-500/25' : '',
                    isConflict ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : '',
                    isSelected && !isConflict ? 'bg-primary/10' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {mode === 'play' && !isGiven ? (
                    <input
                      value={value || ''}
                      onChange={(e) => handleCellInput(r, c, e.target.value.slice(-1))}
                      onKeyDown={(e) => handleKeyDown(e, r, c)}
                      onFocus={() => setSelected(key)}
                      onBlur={() => setSelected(null)}
                      inputMode="numeric"
                      className="h-full w-full bg-transparent text-center outline-none"
                      aria-label={`Row ${r + 1} column ${c + 1}`}
                    />
                  ) : (
                    value || ''
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {mode === 'solve' ? (
        <>
          <StepControls
            player={player}
            steps={steps}
            speed={speed}
            onSpeedChange={setSpeed}
            label={
              lastStep
                ? lastStep.type === 'place'
                  ? `Tried ${lastStep.value} at row ${lastStep.row + 1}, column ${lastStep.col + 1}.`
                  : `Dead end — took ${lastStep.value} back out of row ${lastStep.row + 1}, column ${lastStep.col + 1}.`
                : 'Press Play to watch the solver fill cells and rewind whenever it hits a contradiction.'
            }
          />
          <p className="text-xs text-app-muted">
            {steps.length.toLocaleString()} steps in total
            {solved ? '' : ' — this puzzle has no solution'}.{' '}
            <span className="text-rose-500">Red</span> means the solver undid a guess; that undo
            <em> is </em> the backtracking.
          </p>
        </>
      ) : (
        <p className="text-sm text-app-muted">
          {playComplete
            ? 'Solved — every row, column, and box checks out.'
            : conflicts.size
              ? `${conflicts.size} cell${conflicts.size === 1 ? '' : 's'} conflict with another entry.`
              : `${81 - filled} cells to go. Type 1–9, or switch to "Watch it solve".`}
        </p>
      )}
    </div>
  );
}

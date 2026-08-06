import React, { useMemo, useState } from 'react';
import { solveNQueens } from './algorithms';
import { useStepPlayer, StepControls } from './useStepPlayer';

function stateAtStep(steps, count) {
  const queens = []; // queens[row] = col
  let trying = null;
  let rejected = null;
  for (let i = 0; i < count; i += 1) {
    const s = steps[i];
    if (s.type === 'place') queens[s.row] = s.col;
    else if (s.type === 'remove') delete queens[s.row];
    if (i === count - 1) {
      if (s.type === 'try') trying = { row: s.row, col: s.col };
      if (s.type === 'reject') rejected = { row: s.row, col: s.col };
    }
  }
  return { queens, trying, rejected };
}

/** Under attack from an already-placed queen — shows *why* a square gets rejected. */
function isAttacked(queens, row, col) {
  for (let r = 0; r < queens.length; r += 1) {
    const c = queens[r];
    if (c === undefined || r === row) continue;
    if (c === col || Math.abs(r - row) === Math.abs(c - col)) return true;
  }
  return false;
}

export default function NQueensBoard() {
  const [n, setN] = useState(6);
  const [speed, setSpeed] = useState(70);

  const { steps, firstSolution } = useMemo(() => solveNQueens(n), [n]);
  const player = useStepPlayer(steps, { speed });
  const { queens, trying, rejected } = useMemo(
    () => stateAtStep(steps, player.index),
    [steps, player.index],
  );

  const lastStep = player.index > 0 ? steps[player.index - 1] : null;
  const placed = queens.filter((c) => c !== undefined).length;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-app">
        Board size
        <select
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="rounded-lg border border-input-border bg-default-bg px-3 py-1.5 text-sm text-app"
        >
          {[4, 5, 6, 7, 8].map((size) => (
            <option key={size} value={size}>{size} × {size}</option>
          ))}
        </select>
      </label>

      <div
        className="inline-grid overflow-hidden rounded-xl border border-surface-border"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const row = Math.floor(i / n);
          const col = i % n;
          const hasQueen = queens[row] === col;
          const isTrying = trying && trying.row === row && trying.col === col;
          const isRejected = rejected && rejected.row === row && rejected.col === col;
          const dark = (row + col) % 2 === 1;
          const attacked = !hasQueen && isAttacked(queens, row, col);

          let tone = dark ? 'bg-app-muted/20' : 'bg-default-bg';
          if (attacked) tone = 'bg-rose-500/10';
          if (isTrying) tone = 'bg-amber-400/60';
          if (isRejected) tone = 'bg-rose-500/40';
          if (hasQueen) tone = 'bg-emerald-500/70';

          return (
            <div
              key={i}
              className={`flex h-10 w-10 items-center justify-center text-xl transition-colors sm:h-12 sm:w-12 ${tone}`}
              title={`Row ${row + 1}, column ${col + 1}`}
            >
              {hasQueen ? '♛' : ''}
            </div>
          );
        })}
      </div>

      <StepControls
        player={player}
        steps={steps}
        speed={speed}
        onSpeedChange={setSpeed}
        label={
          lastStep
            ? lastStep.type === 'try'
              ? `Considering row ${lastStep.row + 1}, column ${lastStep.col + 1}…`
              : lastStep.type === 'reject'
                ? `Rejected — row ${lastStep.row + 1}, column ${lastStep.col + 1} is attacked.`
                : lastStep.type === 'place'
                  ? `Placed a queen on row ${lastStep.row + 1}, column ${lastStep.col + 1}.`
                  : lastStep.type === 'remove'
                    ? `No safe square below — removed the queen from row ${lastStep.row + 1}.`
                    : 'Solution found.'
            : `Place ${n} queens so none share a row, column, or diagonal.`
        }
      />

      <div className="flex flex-wrap gap-4 text-xs text-app-muted">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-500/70" /> queen</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-amber-400/60" /> trying</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-500/40" /> rejected</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-500/10" /> attacked square</span>
      </div>

      <p className="text-xs text-app-muted">
        {placed} of {n} queens placed · {steps.length.toLocaleString()} steps to the first solution
        {firstSolution ? '' : ' (none exists for this size)'}.
      </p>
    </div>
  );
}

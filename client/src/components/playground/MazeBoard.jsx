import React, { useMemo, useState } from 'react';
import { MAZES, solveMaze } from './algorithms';
import { useStepPlayer, StepControls } from './useStepPlayer';

/**
 * Rebuilds the search state at a point in the trace. `onPath` is the live
 * recursion stack; `abandoned` is everywhere the search went and gave up on —
 * showing both is what makes the backtracking legible.
 */
function stateAtStep(steps, count) {
  const onPath = [];
  const abandoned = new Set();
  for (let i = 0; i < count; i += 1) {
    const s = steps[i];
    const key = `${s.row}-${s.col}`;
    if (s.type === 'enter') {
      onPath.push(key);
      abandoned.delete(key);
    } else if (s.type === 'backtrack') {
      const idx = onPath.lastIndexOf(key);
      if (idx !== -1) onPath.splice(idx, 1);
      abandoned.add(key);
    }
  }
  return { onPath: new Set(onPath), head: onPath[onPath.length - 1] || null, abandoned };
}

export default function MazeBoard() {
  const [mazeIndex, setMazeIndex] = useState(0);
  const [speed, setSpeed] = useState(90);
  const maze = MAZES[mazeIndex].grid;

  const { steps, solved } = useMemo(() => solveMaze(maze), [maze]);
  const player = useStepPlayer(steps, { speed });
  const { onPath, head, abandoned } = useMemo(
    () => stateAtStep(steps, player.index),
    [steps, player.index],
  );

  const lastStep = player.index > 0 ? steps[player.index - 1] : null;
  const rows = maze.length;
  const cols = maze[0].length;

  return (
    <div className="space-y-4">
      <select
        value={mazeIndex}
        onChange={(e) => setMazeIndex(Number(e.target.value))}
        className="rounded-lg border border-input-border bg-default-bg px-3 py-1.5 text-sm text-app"
      >
        {MAZES.map((m, i) => (
          <option key={m.name} value={i}>{m.name}</option>
        ))}
      </select>

      <div
        className="inline-grid gap-1 rounded-xl border border-surface-border bg-app-surface p-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {maze.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r}-${c}`;
            const isWall = cell === 0;
            const isStart = r === 0 && c === 0;
            const isGoal = r === rows - 1 && c === cols - 1;

            let tone = 'bg-default-bg';
            if (isWall) tone = 'bg-app-muted/30';
            else if (key === head) tone = 'bg-amber-400 text-slate-900';
            else if (onPath.has(key)) tone = 'bg-emerald-500/70 text-white';
            else if (abandoned.has(key)) tone = 'bg-rose-500/25';

            return (
              <div
                key={key}
                className={`flex h-9 w-9 items-center justify-center rounded text-[10px] font-bold transition-colors sm:h-11 sm:w-11 ${tone}`}
                title={isWall ? 'Wall' : `Row ${r + 1}, column ${c + 1}`}
              >
                {isStart ? 'START' : isGoal ? 'END' : ''}
              </div>
            );
          }),
        )}
      </div>

      <StepControls
        player={player}
        steps={steps}
        speed={speed}
        onSpeedChange={setSpeed}
        label={
          lastStep
            ? lastStep.type === 'enter'
              ? `Stepped into row ${lastStep.row + 1}, column ${lastStep.col + 1}.`
              : lastStep.type === 'goal'
                ? 'Reached the exit — the recursion unwinds with the path intact.'
                : `Dead end at row ${lastStep.row + 1}, column ${lastStep.col + 1} — backing out to try another direction.`
            : 'Press Play. The rat tries down, right, up, then left from each cell.'
        }
      />

      <div className="flex flex-wrap gap-4 text-xs text-app-muted">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-amber-400" /> current cell</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-500/70" /> path being tried</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-rose-500/25" /> abandoned</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-app-muted/30" /> wall</span>
      </div>

      <p className="text-xs text-app-muted">
        {solved
          ? `Found a route in ${steps.length} steps.`
          : 'No route exists — watch it exhaust every option before giving up.'}
      </p>
    </div>
  );
}

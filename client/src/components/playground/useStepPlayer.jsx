import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays back a pre-recorded list of algorithm steps.
 *
 * The algorithms run to completion *first*, recording what they did into a flat
 * array; this hook then replays that array on a timer. Pausing real recursion
 * mid-flight would mean generators threaded through every call site, and
 * rewinding would be impossible — with a recorded trace, stepping backwards is
 * just an index change, which is what makes "watch it backtrack" work at all.
 */
export function useStepPlayer(steps, { speed = 60 } = {}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  // A new trace (different puzzle, re-solve) invalidates the old position.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= steps.length) {
      setPlaying(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => setIndex((i) => i + 1), speed);
    return () => clearTimeout(timerRef.current);
  }, [playing, index, steps.length, speed]);

  const play = useCallback(() => {
    // Replaying from the end should restart rather than sit there doing nothing.
    setIndex((i) => (i >= steps.length ? 0 : i));
    setPlaying(true);
  }, [steps.length]);

  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const stepForward = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.min(i + 1, steps.length));
  }, [steps.length]);
  const stepBack = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const jumpToEnd = useCallback(() => {
    setPlaying(false);
    setIndex(steps.length);
  }, [steps.length]);

  return {
    index,
    playing,
    done: index >= steps.length,
    play,
    pause,
    reset,
    stepForward,
    stepBack,
    jumpToEnd,
    setIndex,
  };
}

/** Shared transport controls so every visualiser behaves the same way. */
export function StepControls({ player, steps, speed, onSpeedChange, label }) {
  const btn =
    'rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-app transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={player.stepBack} disabled={player.index === 0} className={btn}>
          ‹ Back
        </button>
        {player.playing ? (
          <button type="button" onClick={player.pause} className={btn}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={player.play} disabled={!steps.length} className={btn}>
            Play
          </button>
        )}
        <button type="button" onClick={player.stepForward} disabled={player.done} className={btn}>
          Step ›
        </button>
        <button type="button" onClick={player.jumpToEnd} disabled={player.done} className={btn}>
          Skip to end
        </button>
        <button type="button" onClick={player.reset} disabled={player.index === 0} className={btn}>
          Reset
        </button>

        <label className="ml-auto flex items-center gap-2 text-xs text-app-muted">
          Speed
          <input
            type="range"
            min="10"
            max="300"
            step="10"
            // Inverted: dragging right should feel faster, but a larger delay is slower.
            value={310 - speed}
            onChange={(e) => onSpeedChange(310 - Number(e.target.value))}
            className="w-24"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={steps.length}
          value={player.index}
          onChange={(e) => {
            player.pause();
            player.setIndex(Number(e.target.value));
          }}
          className="w-full"
          aria-label="Scrub through steps"
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-app-muted">
          {player.index}/{steps.length}
        </span>
      </div>

      {label ? <p className="text-xs text-app-muted">{label}</p> : null}
    </div>
  );
}

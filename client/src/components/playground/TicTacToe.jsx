import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { auth } from '../../services/firebase';
import { bestMove, evaluateBoard } from './algorithms';

const EMPTY = Array(9).fill(null);

/** Same host the REST client talks to — the API and WS share one origin in production. */
function socketBase() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const parsed = new URL(apiUrl, window.location.origin);
    return `${parsed.protocol === 'https:' ? 'wss' : 'ws'}://${parsed.host}`;
  }
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
}

function newRoomCode() {
  return Math.random().toString(36).slice(2, 10);
}

function Board({ board, winningLine, onPlay, disabled }) {
  return (
    // The gap shows the darker wrapper through it, which is what draws the
    // grid lines — no borders needed, and it stays correct in both themes.
    <div className="inline-grid grid-cols-3 gap-1.5 rounded-2xl bg-app-muted p-1.5 shadow-inner">
      {board.map((cell, i) => {
        const isWinning = winningLine?.includes(i);
        const playable = !cell && !disabled;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPlay(i)}
            disabled={disabled || Boolean(cell)}
            className={[
              'flex h-20 w-20 items-center justify-center rounded-xl text-4xl font-bold transition sm:h-24 sm:w-24',
              isWinning
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-app-surface shadow-sm',
              cell === 'X' && !isWinning ? 'text-indigo-500 dark:text-indigo-400' : '',
              cell === 'O' && !isWinning ? 'text-amber-500 dark:text-amber-400' : '',
              playable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-not-allowed',
            ].filter(Boolean).join(' ')}
            aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ', empty'}`}
          >
            {cell}
          </button>
        );
      })}
    </div>
  );
}

function VsComputer() {
  const [board, setBoard] = useState(EMPTY);
  const [thinking, setThinking] = useState(false);
  const [youFirst, setYouFirst] = useState(true);
  const [lastNodes, setLastNodes] = useState(null);

  const you = 'X';
  const ai = 'O';
  const { winner, line, draw } = evaluateBoard(board);
  const over = Boolean(winner) || draw;

  const aiTurn = useCallback(
    (current) => {
      setThinking(true);
      // Deferred so React paints the human's move before minimax blocks the
      // thread — otherwise both marks appear at once and it looks frozen.
      setTimeout(() => {
        const { move, nodes } = bestMove(current, ai);
        setLastNodes(nodes);
        if (move >= 0) {
          const next = [...current];
          next[move] = ai;
          setBoard(next);
        }
        setThinking(false);
      }, 180);
    },
    [ai],
  );

  function play(index) {
    if (over || thinking || board[index]) return;
    const next = [...board];
    next[index] = you;
    setBoard(next);
    if (!evaluateBoard(next).winner && !evaluateBoard(next).draw) aiTurn(next);
  }

  function reset(humanStarts) {
    setBoard(EMPTY);
    setLastNodes(null);
    setYouFirst(humanStarts);
    if (!humanStarts) aiTurn(EMPTY);
  }

  const status = winner
    ? winner === you
      ? 'You win — that should be impossible, please tell me how.'
      : 'Computer wins.'
    : draw
      ? 'Draw. Against perfect play, that is the best available result.'
      : thinking
        ? 'Computer is searching…'
        : 'Your move.';

  return (
    <div className="space-y-4">
      <Board board={board} winningLine={line} onPlay={play} disabled={over || thinking} />

      <p className="text-sm font-medium text-app">{status}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset(true)}
          className="rounded-lg bg-app-gradient px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          New game (you start)
        </button>
        <button
          type="button"
          onClick={() => reset(false)}
          className="rounded-lg border border-surface-border px-4 py-2 text-xs font-semibold text-app transition hover:border-primary"
        >
          New game (computer starts)
        </button>
      </div>

      <p className="text-xs text-app-muted">
        The computer plays <strong>minimax</strong>: it recursively plays out every remaining
        game to the end, assuming you also play optimally, and picks the branch with the best
        guaranteed outcome. It prefers faster wins and slower losses, so it never stalls when
        it's already winning. It cannot be beaten — a draw is the best you can force.
        {lastNodes ? ` Last move searched ${lastNodes.toLocaleString()} positions.` : ''}
        {youFirst ? '' : ' '}
      </p>
    </div>
  );
}

function VsCandidate() {
  const [roomCode, setRoomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('');
  const wsRef = useRef(null);
  const sessionRef = useRef(0);

  const shareUrl = roomCode ? `${window.location.origin}/app/mind-games?game=${roomCode}` : '';

  // Someone opening a shared link should land straight in that game.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('game');
    if (code) {
      setRoomCode(code);
      setJoined(true);
    }
  }, []);

  useEffect(() => {
    if (!joined || !roomCode) return undefined;
    const mySession = ++sessionRef.current;
    let socket;

    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        if (sessionRef.current !== mySession) return;

        socket = new WebSocket(`${socketBase()}/ws/game?room=${encodeURIComponent(roomCode)}&token=${token}`);
        if (sessionRef.current !== mySession) {
          socket.close();
          return;
        }
        wsRef.current = socket;

        socket.onopen = () => setStatus('Connected. Waiting for your opponent…');
        socket.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') {
            setState(msg);
            setStatus('');
          } else if (msg.type === 'opponent-joined') {
            toast.info(`${msg.name} joined the game.`);
          } else if (msg.type === 'opponent-left') {
            toast.info('Your opponent left.');
          } else if (msg.type === 'error') {
            setStatus(msg.message);
          }
        };
        socket.onerror = () => setStatus('Could not reach the game server.');
        socket.onclose = () => {
          if (sessionRef.current === mySession) setStatus('Disconnected.');
        };
      } catch {
        setStatus('Could not authenticate. Try reloading.');
      }
    })();

    return () => {
      sessionRef.current += 1;
      socket?.close();
    };
  }, [joined, roomCode]);

  function send(payload) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied — send it to whoever you want to play.');
    } catch {
      toast.info(shareUrl);
    }
  }

  if (!joined) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-app-muted">
          Start a game and share the link, or paste one you were sent. Both of you need to be
          signed in to MailPilot.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRoomCode(newRoomCode());
              setJoined(true);
            }}
            className="rounded-lg bg-app-gradient px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Create a game
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.trim())}
            placeholder="or enter a game code"
            className="rounded-lg border border-input-border bg-default-bg px-3 py-2 text-sm text-app"
          />
          <button
            type="button"
            onClick={() => roomCode && setJoined(true)}
            disabled={!roomCode}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm font-semibold text-app transition hover:border-primary disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  const board = state?.board || EMPTY;
  const yourMark = state?.yourMark;
  const isYourTurn = state && state.turn === yourMark && !state.waitingForOpponent;
  const result = state?.result;

  let heading = status;
  if (!status && state) {
    if (state.waitingForOpponent) heading = 'Waiting for your opponent to join…';
    else if (result?.winner) heading = result.winner === yourMark ? 'You win!' : 'You lost.';
    else if (result?.draw) heading = 'Draw.';
    else heading = isYourTurn ? 'Your move.' : "Opponent's move…";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-default-bg px-3 py-1.5 font-mono text-xs text-app">{roomCode}</span>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-app transition hover:border-primary"
        >
          Copy invite link
        </button>
        <button
          type="button"
          onClick={() => {
            setJoined(false);
            setState(null);
            setStatus('');
          }}
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-app-muted transition hover:text-app"
        >
          Leave
        </button>
        {yourMark && (
          <span className="text-xs text-app-muted">
            You are <strong className="text-app">{yourMark}</strong>
          </span>
        )}
      </div>

      <Board
        board={board}
        winningLine={result?.line}
        onPlay={(i) => send({ type: 'move', index: i })}
        disabled={!isYourTurn || Boolean(result?.winner) || Boolean(result?.draw)}
      />

      <p className="text-sm font-medium text-app">{heading}</p>

      {(result?.winner || result?.draw) && (
        <button
          type="button"
          onClick={() => send({ type: 'restart' })}
          className="rounded-lg bg-app-gradient px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          Play again
        </button>
      )}

      <p className="text-xs text-app-muted">
        Moves are validated on the server, so neither side can play out of turn or into a taken
        square. Games live in memory only — a server restart ends them.
      </p>
    </div>
  );
}

export default function TicTacToe() {
  const [mode, setMode] = useState('computer');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-default-bg p-1 sm:w-fit">
        {[
          { id: 'computer', label: 'vs Computer' },
          { id: 'candidate', label: 'vs Another candidate' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
              mode === m.id ? 'bg-app-surface text-app shadow-soft' : 'text-app-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'computer' ? <VsComputer /> : <VsCandidate />}
    </div>
  );
}

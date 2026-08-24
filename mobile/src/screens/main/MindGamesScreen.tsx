import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { auth } from '../../services/firebase';
import { Screen, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';
import { bestMove, evaluateBoard } from '../../utils/ticTacToeAlgorithms';

const EMPTY = Array(9).fill(null);

function wsBase() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
  const url = new URL(apiUrl);
  return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`;
}

function newRoomCode() {
  return Math.random().toString(36).slice(2, 10);
}

function Board({
  board,
  winningLine,
  onPlay,
  disabled,
}: {
  board: (string | null)[];
  winningLine: number[] | null | undefined;
  onPlay: (i: number) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.board}>
      {board.map((cell, i) => {
        const isWinning = winningLine?.includes(i);
        return (
          <Pressable
            key={i}
            onPress={() => onPlay(i)}
            disabled={disabled || Boolean(cell)}
            style={[styles.cell, isWinning ? styles.cellWinning : null]}
          >
            <Text
              style={[
                styles.cellText,
                isWinning ? { color: '#fff' } : cell === 'X' ? { color: colors.primary } : { color: colors.warning },
              ]}
            >
              {cell}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function VsComputer() {
  const [board, setBoard] = useState<(string | null)[]>(EMPTY);
  const [thinking, setThinking] = useState(false);
  const [lastNodes, setLastNodes] = useState<number | null>(null);
  const you = 'X';
  const ai = 'O';
  const { winner, line, draw } = evaluateBoard(board);
  const over = Boolean(winner) || draw;

  const aiTurn = useCallback((current: (string | null)[]) => {
    setThinking(true);
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
  }, []);

  function play(index: number) {
    if (over || thinking || board[index]) return;
    const next = [...board];
    next[index] = you;
    setBoard(next);
    if (!evaluateBoard(next).winner && !evaluateBoard(next).draw) aiTurn(next);
  }

  function reset(humanStarts: boolean) {
    setBoard(EMPTY);
    setLastNodes(null);
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
    <View style={{ alignItems: 'center' }}>
      <Board board={board} winningLine={line} onPlay={play} disabled={over || thinking} />
      <Text style={styles.status}>{status}</Text>
      <View style={styles.buttonRow}>
        <SecondaryButton title="New game (you start)" onPress={() => reset(true)} />
        <SecondaryButton title="Computer starts" onPress={() => reset(false)} />
      </View>
      <Text style={styles.note}>
        The computer plays minimax — it cannot be beaten, a draw is the best you can force.
        {lastNodes ? ` Last move searched ${lastNodes.toLocaleString()} positions.` : ''}
      </Text>
    </View>
  );
}

function VsCandidate() {
  const [roomCode, setRoomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<any>(null);
  const [status, setStatus] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef(0);

  useEffect(() => {
    if (!joined || !roomCode) return undefined;
    const mySession = ++sessionRef.current;
    let socket: WebSocket;

    (async () => {
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token || sessionRef.current !== mySession) return;

        socket = new WebSocket(`${wsBase()}/ws/game?room=${encodeURIComponent(roomCode)}&token=${token}`);
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
            Toast.show({ type: 'info', text1: `${msg.name} joined the game.` });
          } else if (msg.type === 'opponent-left') {
            Toast.show({ type: 'info', text1: 'Your opponent left.' });
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

  function send(payload: any) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }

  // Copies the bare code, not a jobpilot:// URL — that scheme has no route
  // registered for mind-games, so a "link" built from it opened nothing at
  // all. The code pastes straight into the "enter a game code" field below,
  // which is the join path that actually works.
  async function copyCode() {
    await Clipboard.setStringAsync(roomCode);
    Toast.show({ type: 'success', text1: 'Game code copied — send it to your opponent.' });
  }

  if (!joined) {
    return (
      <View>
        <Text style={styles.muted}>
          Start a game and share the code, or enter one you were sent. Both of you need to be signed in.
        </Text>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            title="Create a game"
            onPress={() => {
              setRoomCode(newRoomCode());
              setJoined(true);
            }}
          />
        </View>
        <Field label="Or enter a game code" value={roomCode} onChangeText={(v) => setRoomCode(v.trim())} autoCapitalize="none" />
        <SecondaryButton title="Join" onPress={() => roomCode && setJoined(true)} disabled={!roomCode} />
      </View>
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
    <View style={{ alignItems: 'center' }}>
      <View style={styles.roomRow}>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <SecondaryButton title="Copy code" onPress={copyCode} />
        <SecondaryButton
          title="Leave"
          onPress={() => {
            setJoined(false);
            setState(null);
            setStatus('');
          }}
        />
      </View>
      {yourMark ? <Text style={styles.muted}>You are {yourMark}</Text> : null}

      <Board
        board={board}
        winningLine={result?.line}
        onPlay={(i) => send({ type: 'move', index: i })}
        disabled={!isYourTurn || Boolean(result?.winner) || Boolean(result?.draw)}
      />
      <Text style={styles.status}>{heading}</Text>
      {result?.winner || result?.draw ? (
        <SecondaryButton title="Play again" onPress={() => send({ type: 'restart' })} />
      ) : null}
    </View>
  );
}

export default function MindGamesScreen() {
  const [mode, setMode] = useState<'computer' | 'candidate'>('computer');

  return (
    <Screen style={{ padding: 16 }}>
      <Text style={styles.title}>Mind Games</Text>
      <Text style={styles.subtitle}>Tic-Tac-Toe against an unbeatable minimax bot, or another JobPilot user.</Text>

      <View style={styles.tabRow}>
        <Pressable onPress={() => setMode('computer')} style={[styles.tabButton, mode === 'computer' ? styles.tabButtonActive : null]}>
          <Text style={[styles.tabText, mode === 'computer' ? styles.tabTextActive : null]}>vs Computer</Text>
        </Pressable>
        <Pressable onPress={() => setMode('candidate')} style={[styles.tabButton, mode === 'candidate' ? styles.tabButtonActive : null]}>
          <Text style={[styles.tabText, mode === 'candidate' ? styles.tabTextActive : null]}>vs Another candidate</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 20 }}>{mode === 'computer' ? <VsComputer /> : <VsCandidate />}</View>

      <Text style={styles.disclaimer}>
        Other mini-games from the web app (Sudoku solver, N-Queens, Maze) use canvas-heavy
        visualizers and aren't ported to mobile yet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tabButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1 },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 6, backgroundColor: colors.bg, padding: 6, borderRadius: 16 },
  cell: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cellWinning: { backgroundColor: colors.success },
  cellText: { fontSize: 32, fontWeight: '800' },
  status: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 16 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  note: { color: colors.textSecondary, fontSize: 11, marginTop: 14, textAlign: 'center', lineHeight: 16, maxWidth: 280 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  roomCode: { color: colors.textPrimary, fontSize: 13, fontFamily: 'monospace', backgroundColor: colors.bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  disclaimer: { color: colors.textSecondary, fontSize: 11, marginTop: 24, lineHeight: 16 },
});

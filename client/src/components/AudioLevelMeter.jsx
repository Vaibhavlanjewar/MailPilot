import React, { useEffect, useRef, useState } from 'react';

/**
 * Live RMS level of a MediaStream's audio, 0..1.
 *
 * This is the only way to answer "is audio actually flowing?" — a track can be
 * present, enabled, and unmuted while carrying pure silence (wrong input
 * device, muted at the OS level, or a peer whose mic never opened). Track flags
 * alone can't distinguish those from working audio.
 *
 * Analysing does not consume the stream: playback still happens on the media
 * element, and the Web Audio graph here is never connected to a destination.
 */
export function useAudioLevel(stream, { enabled = true } = {}) {
  const [level, setLevel] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled || !stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return undefined;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return undefined;

    const ctx = new Ctx();
    let source;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch {
      ctx.close().catch(() => {});
      return undefined;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.fftSize);

    // Autoplay policy suspends new contexts until a gesture; surface that
    // rather than silently reporting zero and looking like broken audio.
    ctx.resume().catch(() => {});
    setBlocked(ctx.state === 'suspended');

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      // Scaled up: normal speech sits around 0.05 RMS, which would barely move a raw bar.
      setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
      if (ctx.state === 'running' && blocked) setBlocked(false);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* already torn down */
      }
      ctx.close().catch(() => {});
    };
    // `blocked` intentionally excluded: it's set inside the loop and would
    // otherwise tear down and rebuild the whole audio graph on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, enabled]);

  return { level, blocked };
}

const BARS = 12;

export default function AudioLevelMeter({ stream, label, hint }) {
  const { level } = useAudioLevel(stream);
  const hasTrack = Boolean(stream && stream.getAudioTracks().length);
  const active = BARS * level;

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-medium text-app-muted">{label}</span>
      <div className="flex flex-1 items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => {
          const on = i < active;
          return (
            <span
              key={i}
              className={`h-4 w-1.5 rounded-sm transition-colors duration-75 ${
                on
                  ? i > BARS * 0.8
                    ? 'bg-rose-500'
                    : i > BARS * 0.55
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  : 'bg-app-muted'
              }`}
            />
          );
        })}
      </div>
      <span className="w-28 shrink-0 text-right text-[11px] text-app-muted">
        {!hasTrack ? 'no audio track' : level > 0.02 ? 'sound detected' : hint || 'silent'}
      </span>
    </div>
  );
}

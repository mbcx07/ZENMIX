import React, { useEffect, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

// ── types ──────────────────────────────────────────────

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  theme?: 'light' | 'dark';
}

// ── constants ──────────────────────────────────────────

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_COUNT = 90;
const CANVAS_HP = 500; // horizontal padding

// ── helpers ────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function decodePeaks(
  audioUrl: string,
  barCount: number,
): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const resp = await fetch(audioUrl);
    const buffer = await resp.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer);
    const channel = audioBuffer.getChannelData(0);
    const step = Math.floor(channel.length / barCount);
    const peaks = new Float32Array(barCount);
    for (let i = 0; i < barCount; i++) {
      let max = 0;
      const start = i * step;
      const end = start + step;
      for (let j = start; j < end && j < channel.length; j++) {
        const abs = Math.abs(channel[j]);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }
    return peaks;
  } finally {
    await ctx.close();
  }
}

// ── styles ─────────────────────────────────────────────

const lightBrand = '#7c3aed';
const darkBg = 'rgba(255,255,255,0.04)';

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  canvasRow: {
    position: 'relative',
    width: '100%',
  },
  canvas: {
    display: 'block',
    borderRadius: '1.25rem',
    width: '100%',
    height: 120,
  },
  canvasSmall: {
    height: 60,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    pointerEvents: 'none',
    borderRadius: '1.25rem',
    transition: 'width 0.08s linear',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: '#7c3aed',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
  },
  timeText: {
    fontSize: 13,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 38,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    appearance: 'none',
    outline: 'none',
    cursor: 'pointer',
  },
};

// ── component ──────────────────────────────────────────

const WaveformPlayer: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const drawIdRef = useRef(0);

  const isLight = theme === 'light';
  const bg = isLight ? '#f4f4f5' : '#1a1a2e';
  const waveColor = isLight ? '#d4d4d8' : 'rgba(255,255,255,0.12)';
  const playedColor = isLight ? lightBrand : '#7c3aed';
  const textColor = isLight ? '#27272a' : '#d4d4d8';

  // ── decode waveform ──────────────────────────────────

  useEffect(() => {
    if (!audioUrl) {
      peaksRef.current = null;
      drawIdRef.current++;
      drawWaveform(null);
      return;
    }
    let cancelled = false;
    decodePeaks(audioUrl, BAR_COUNT).then((peaks) => {
      if (cancelled) return;
      peaksRef.current = peaks;
      drawIdRef.current++;
      drawWaveform(peaks);
    });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // ── draw canvas ──────────────────────────────────────

  const drawWaveform = useCallback(
    (peaks: Float32Array | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const usableW = w - CANVAS_HP * 2;

      // bg
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 20);
      ctx.fill();

      if (!peaks) return;

      const step = usableW / BAR_COUNT;
      const mid = h / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = CANVAS_HP + i * step;
        const barH = peaks[i] * mid * 0.85;
        const color =
          duration > 0 && (i / BAR_COUNT) <= (currentTime / duration) ? playedColor : waveColor;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, mid - barH, BAR_WIDTH, barH * 2, 1.5);
        ctx.fill();
      }
    },
    [bg, waveColor, playedColor, currentTime, duration],
  );

  // re-draw on currentTime/duration change
  useEffect(() => {
    drawWaveform(peaksRef.current);
  }, [drawWaveform]);

  // ── resize ───────────────────────────────────────────

  useEffect(() => {
    const onResize = () => drawWaveform(peaksRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawWaveform]);

  // ── helpers for mobile ───────────────────────────────

  const isSmall = typeof window !== 'undefined' ? window.innerWidth <= 640 : false;

  // ── slider ───────────────────────────────────────────

  const sliderStyle: React.CSSProperties = {
    ...styles.slider,
    background: `linear-gradient(to right, ${lightBrand} ${
      duration > 0 ? (currentTime / duration) * 100 : 0
    }%, ${isLight ? '#e4e4e7' : '#333'} ${
      duration > 0 ? (currentTime / duration) * 100 : 0
    }%)`,
  };

  return (
    <div style={styles.wrapper}>
      {/* waveform + progress overlay */}
      <div style={styles.canvasRow}>
        <canvas
          ref={canvasRef}
          style={{ ...styles.canvas, background: bg }}
        />
        {/* progress tint overlay */}
        {duration > 0 && (
          <div
            style={{
              ...styles.progressOverlay,
              width: `${(currentTime / duration) * 100}%`,
              background: `linear-gradient(90deg, ${playedColor}22, ${playedColor}11)`,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            }}
          />
        )}
      </div>

      {/* controls row */}
      <div style={styles.controls}>
        {/* play / pause */}
        <button
          style={styles.playBtn}
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.35)';
          }}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
        </button>

        {/* time */}
        <span style={{ ...styles.timeText, color: textColor }}>
          {formatTime(currentTime)}
        </span>

        {/* seek slider */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={sliderStyle}
        />

        {/* duration */}
        <span style={{ ...styles.timeText, color: textColor }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* responsive tweak */}
      <style>{`
        .waveform-player-wrapper canvas {
          transition: height 0.25s ease;
        }
        @media (max-width: 640px) {
          .waveform-player-wrapper canvas {
            height: 60px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default WaveformPlayer;

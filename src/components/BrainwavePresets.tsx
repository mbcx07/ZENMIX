import React, { useState } from 'react';
import { Moon, BrainCircuit, Cloud, Zap } from 'lucide-react';

// ── types ──────────────────────────────────────────────

interface Preset {
  name: string;
  description: string;
  carrier: number;
  beat: number;
}

interface Props {
  presets: Preset[];
  onSelectPreset: (preset: { carrier: number; beat: number }) => void;
  currentBeat: number;
}

// ── helpers ────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'delta',
    label: 'Delta',
    icon: Moon,
    range: [0.5, 3.9] as [number, number],
    description: 'Sueño profundo, regeneración',
  },
  {
    key: 'theta',
    label: 'Theta',
    icon: BrainCircuit,
    range: [4.0, 7.9] as [number, number],
    description: 'Meditación, creatividad, hipnosis',
  },
  {
    key: 'alpha',
    label: 'Alpha',
    icon: Cloud,
    range: [8.0, 13.9] as [number, number],
    description: 'Relajación, enfoque suave, flow',
  },
  {
    key: 'beta',
    label: 'Beta',
    icon: Zap,
    range: [14.0, 30.0] as [number, number],
    description: 'Concentración activa, alerta',
  },
] as const;

function inRange(beat: number, [lo, hi]: [number, number]): boolean {
  return beat >= lo && beat <= hi;
}

function filterByCategory(presets: Preset[], [lo, hi]: [number, number]): Preset[] {
  return presets.filter((p) => inRange(p.beat, [lo, hi]));
}

// ── styles ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px 8px',
    maxHeight: '70vh',
    overflowY: 'auto',
    scrollBehavior: 'smooth',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: '1.25rem',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.25s ease',
    userSelect: 'none',
  },
  sectionHeaderExpanded: {
    borderColor: 'rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.10)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0f0f0',
    flex: 1,
  },
  sectionDesc: {
    fontSize: 12,
    fontWeight: 400,
    color: '#aaa',
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: '#888',
    transition: 'transform 0.25s ease',
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 4,
    overflow: 'hidden',
    transition: 'max-height 0.35s ease, opacity 0.25s ease',
  },
  emptyHint: {
    fontSize: 13,
    color: '#666',
    padding: '8px 16px',
    fontStyle: 'italic',
  },
  card: {
    borderRadius: '2rem',
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid transparent',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardActive: {
    borderColor: '#7c3aed',
    boxShadow: '0 4px 32px rgba(124,58,237,0.35), 0 0 0 1px rgba(124,58,237,0.2)',
    background: 'rgba(124,58,237,0.12)',
  },
  cardName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f5f5f5',
  },
  cardDesc: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.5,
  },
  cardFreq: {
    fontSize: 11,
    fontWeight: 600,
    color: '#7c3aed',
    marginTop: 4,
    letterSpacing: 0.3,
  },
};

// ── component ──────────────────────────────────────────

const BrainwavePresets: React.FC<Props> = ({ presets, onSelectPreset, currentBeat }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: true }), {}),
  );

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={styles.container}>
      {CATEGORIES.map(({ key, label, icon: Icon, range, description }) => {
        const items = filterByCategory(presets, range);
        const isOpen = !!openSections[key];

        return (
          <div key={key} style={styles.section}>
            {/* section header */}
            <div
              style={{
                ...styles.sectionHeader,
                ...(isOpen ? styles.sectionHeaderExpanded : {}),
              }}
              onClick={() => toggle(key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggle(key);
              }}
            >
              <Icon size={22} color="#c4b5fd" />
              <div style={{ flex: 1 }}>
                <div style={styles.sectionTitle}>{label}</div>
                <div style={styles.sectionDesc}>{description}</div>
              </div>
              <span style={{ ...styles.chevron, ...(isOpen ? styles.chevronOpen : {}) }}>
                ▼
              </span>
            </div>

            {/* cards */}
            <div
              style={{
                ...styles.grid,
                maxHeight: isOpen ? 2000 : 0,
                opacity: isOpen ? 1 : 0,
                animation: isOpen ? 'fadeIn 0.4s ease' : undefined,
              }}
            >
              {items.length === 0 ? (
                <div style={styles.emptyHint}>No hay presets en este rango</div>
              ) : (
                items.map((p) => {
                  const active = inRange(currentBeat, range) && currentBeat === p.beat;
                  return (
                    <div
                      key={p.name}
                      style={{ ...styles.card, ...(active ? styles.cardActive : {}) }}
                      onClick={() => onSelectPreset({ carrier: p.carrier, beat: p.beat })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          onSelectPreset({ carrier: p.carrier, beat: p.beat });
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = active
                          ? 'rgba(124,58,237,0.18)'
                          : 'rgba(255,255,255,0.09)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = active
                          ? 'rgba(124,58,237,0.12)'
                          : 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div style={styles.cardName}>{p.name}</div>
                      <div style={styles.cardDesc}>{p.description}</div>
                      <div style={styles.cardFreq}>
                        Carrier: {p.carrier} Hz ・ Beat: {p.beat} Hz
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* fade-in keyframe injected once */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BrainwavePresets;

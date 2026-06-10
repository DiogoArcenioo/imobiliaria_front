'use client';

import { useState, Fragment } from 'react';

const PALETTE = [
  { base: '#3b82f6', top: '#93c5fd', side: '#1e40af' },
  { base: '#8b5cf6', top: '#c4b5fd', side: '#5b21b6' },
  { base: '#10b981', top: '#6ee7b7', side: '#064e3b' },
  { base: '#f59e0b', top: '#fde68a', side: '#92400e' },
  { base: '#ec4899', top: '#fbcfe8', side: '#9d174d' },
  { base: '#22c55e', top: '#86efac', side: '#14532d' },
  { base: '#f97316', top: '#fed7aa', side: '#9a3412' },
  { base: '#6366f1', top: '#c7d2fe', side: '#3730a3' },
  { base: '#06b6d4', top: '#a5f3fc', side: '#164e63' },
  { base: '#eab308', top: '#fef08a', side: '#713f12' },
];

function getPalette(n) {
  return PALETTE[(n - 1) % PALETTE.length];
}

function getStatus(stats) {
  if (!stats || stats.total === 0) return { text: 'Sem aps', type: 'empty' };
  if (stats.disponivel === 0) return { text: 'Lotado', type: 'full' };
  const n = stats.disponivel;
  return { text: `${n} livre${n !== 1 ? 's' : ''}`, type: 'available' };
}

export function Building3DView({ predio, onSelectFloor, selectedFloor = null }) {
  const [hovered, setHovered] = useState(null);
  if (!predio) return null;

  const cols = predio.footprint_cols || 4;
  const rows = predio.footprint_rows || 4;
  const numAndares = predio.num_andares || 1;

  const CELL = 28;
  const ISO_W = cols * CELL;
  const ISO_D = rows * CELL;
  const FLOOR_H = Math.max(24, Math.min(40, 500 / Math.max(numAndares, 1)));
  const FLOOR_GAP = numAndares > 20 ? 2 : 5;
  const FLOOR_STEP = FLOOR_H + FLOOR_GAP;

  const OX = 160;
  const OY = 70 + numAndares * FLOOR_STEP + ISO_D * 0.5;

  const to2D = (x, y, z) => ({
    x: OX + x - y * 0.5,
    y: OY - z - y * 0.5,
  });

  const vbW = OX + ISO_W + ISO_D * 0.5 + 40;
  const vbH = OY + 20;

  const andares = predio.andares || [];

  const floors = [];
  for (let i = 0; i < numAndares; i++) {
    const n = i + 1;
    const andar = andares.find((a) => a.numero === n);
    const z0 = i * FLOOR_STEP;
    const z1 = z0 + FLOOR_H;
    const pal = getPalette(n);
    const status = getStatus(andar?.stats);
    const isSelected = selectedFloor === n;
    const isHovered = hovered === n;

    // Cabinet projection — front face is a perfect rectangle
    const A = to2D(0, 0, z0);
    const B = to2D(ISO_W, 0, z0);
    const C = to2D(ISO_W, ISO_D, z0);
    const E = to2D(0, 0, z1);
    const F = to2D(ISO_W, 0, z1);
    const G = to2D(ISO_W, ISO_D, z1);
    const H = to2D(0, ISO_D, z1);

    const pts = (arr) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Label center on front face
    const fcx = (E.x + B.x) / 2;
    const fcy = (E.y + B.y) / 2;

    // Window grid on front face
    const winCount = Math.min(Math.max(cols, 2), 5);
    const winW = Math.max(4, Math.min(8, (ISO_W - 16) / winCount * 0.5));
    const winH = Math.min(FLOOR_H * 0.28, 6);
    const spacing = (ISO_W - 16) / winCount;
    const winCY = E.y + FLOOR_H * 0.52 - winH / 2;

    const windows = Array.from({ length: winCount }, (_, wi) => ({
      x: E.x + 8 + spacing * wi + (spacing - winW) / 2,
      y: winCY,
      w: winW,
      h: winH,
    }));

    floors.push({
      n, pal, status, isSelected, isHovered,
      frontPoly: pts([A, B, F, E]),
      rightPoly: pts([B, C, G, F]),
      topPoly: pts([E, F, G, H]),
      E, F, A, B,
      fcx, fcy, windows,
    });
  }

  const rendered = [...floors];

  return (
    <div className="building-3d-wrap">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        className="building-3d-svg"
        style={{ display: 'block', maxWidth: '100%' }}
      >
        <defs>
          {floors.map((f) => (
            <Fragment key={f.n}>
              <linearGradient id={`b3d-gf-${f.n}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={f.pal.top} />
                <stop offset="100%" stopColor={f.pal.base} stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id={`b3d-gr-${f.n}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={f.pal.base} stopOpacity="0.72" />
                <stop offset="100%" stopColor={f.pal.side} />
              </linearGradient>
              <linearGradient id={`b3d-gt-${f.n}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={f.pal.top} />
                <stop offset="100%" stopColor={f.pal.base} />
              </linearGradient>
            </Fragment>
          ))}
          <filter id="b3dShadow" x="-20%" y="-30%" width="150%" height="180%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.14" />
          </filter>
        </defs>

        <ellipse
          cx={OX + ISO_W / 2 - ISO_D * 0.16}
          cy={OY + 10}
          rx={Math.max(80, ISO_W * 0.65)}
          ry={20}
          fill="rgba(15,23,42,0.08)"
        />

        {rendered.map((f) => (
          <g
            key={f.n}
            className={`b3d-floor${f.isSelected ? ' is-selected' : ''}${f.isHovered ? ' is-hovered' : ''}`}
            style={{ cursor: onSelectFloor ? 'pointer' : 'default' }}
            onClick={() => onSelectFloor?.(f.n)}
            onMouseEnter={() => setHovered(f.n)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Front face */}
            <polygon
              points={f.frontPoly}
              fill={`url(#b3d-gf-${f.n})`}
              stroke={f.isSelected ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.18)'}
              strokeWidth={f.isSelected ? 1.5 : 0.75}
              filter="url(#b3dShadow)"
            />
            {/* Windows */}
            {f.windows.map((w, wi) => (
              <rect
                key={wi}
                x={w.x} y={w.y} width={w.w} height={w.h}
                rx={1.5}
                fill="rgba(255,255,255,0.2)"
                stroke="rgba(255,255,255,0.38)"
                strokeWidth={0.5}
                style={{ pointerEvents: 'none' }}
              />
            ))}
            {/* Right face */}
            <polygon
              points={f.rightPoly}
              fill={`url(#b3d-gr-${f.n})`}
              stroke={f.isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.28)'}
              strokeWidth={f.isSelected ? 1.5 : 0.75}
            />
            {/* Top face */}
            <polygon
              points={f.topPoly}
              fill={`url(#b3d-gt-${f.n})`}
              stroke={f.isSelected ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.16)'}
              strokeWidth={f.isSelected ? 1.5 : 0.75}
            />
            {/* Edge highlight (top ridge) */}
            <line
              x1={f.E.x.toFixed(1)} y1={f.E.y.toFixed(1)}
              x2={f.F.x.toFixed(1)} y2={f.F.y.toFixed(1)}
              stroke="rgba(255,255,255,0.42)"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
            {/* Floor label on front face */}
            <text
              x={f.fcx.toFixed(1)}
              y={f.fcy.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(11, FLOOR_H * 0.42)}
              fontWeight="800"
              fill="rgba(255,255,255,0.92)"
              stroke="rgba(15,23,42,0.38)"
              strokeWidth={2}
              paintOrder="stroke"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {f.n}°
            </text>
          </g>
        ))}
      </svg>

      <div className="b3d-legend">
        {floors.map((f) => (
          <button
            key={f.n}
            className={`b3d-floor-btn${f.isSelected ? ' selected' : ''}`}
            style={{ '--b3d-clr': f.pal.base }}
            onClick={() => onSelectFloor?.(f.n)}
            onMouseEnter={() => setHovered(f.n)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="b3d-dot" style={{ background: f.pal.base }} />
            <span className="b3d-floor-label">{f.n}° andar</span>
            <span className={`b3d-badge b3d-badge-${f.status.type}`}>{f.status.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

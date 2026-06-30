'use client';

import { useId, useState } from 'react';

const STATUS_META = {
  available: { color: '#16a34a', textColor: '#15803d' },
  full: { color: '#dc2626', textColor: '#b91c1c' },
  empty: { color: '#64748b', textColor: '#64748b' },
};

const EXTERIOR_TEXTURES = {
  concrete: { href: '/textures/predio/exterior-concrete.jpg', size: 128 },
  glass: { href: '/textures/predio/exterior-glass.jpg', size: 96 },
  roof: { href: '/textures/predio/exterior-roof.jpg', size: 128 },
  pavers: { href: '/textures/predio/exterior-pavers.jpg', size: 140 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pts(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function getStatus(stats) {
  if (!stats || stats.total === 0) {
    return { text: 'Sem aps', type: 'empty', ...STATUS_META.empty };
  }
  if (stats.disponivel === 0) {
    return { text: 'Lotado', type: 'full', ...STATUS_META.full };
  }
  const n = stats.disponivel;
  return {
    text: `${n} livre${n !== 1 ? 's' : ''}`,
    type: 'available',
    ...STATUS_META.available,
  };
}

export function Building3DView({ predio, onSelectFloor, selectedFloor = null, showLegend = true }) {
  const [hovered, setHovered] = useState(null);
  const rawId = useId();
  if (!predio) return null;

  const uid = rawId.replace(/:/g, '');
  const accent = predio.cor || '#3288e0';
  const cols = Math.max(1, Number(predio.footprint_cols) || 4);
  const rows = Math.max(1, Number(predio.footprint_rows) || 4);
  const numAndares = Math.max(1, Number(predio.num_andares) || 1);

  const WIDTH = clamp(cols * 34, 180, 340);
  const DEPTH_X = clamp(rows * 13, 40, 92);
  const DEPTH_Y = clamp(rows * 7, 22, 52);
  const FLOOR_H = clamp(560 / numAndares, 14, 34);
  const SLAB_H = clamp(FLOOR_H * 0.16, 2.2, 5);
  const TOTAL_H = FLOOR_H * numAndares;
  const BASE_H = 30;

  const X = 62;
  const ROOF_BACK_Y = 34;
  const FRONT_TOP_Y = ROOF_BACK_Y + DEPTH_Y;
  const BASE_TOP_Y = FRONT_TOP_Y + TOTAL_H;
  const SITE_FRONT_Y = BASE_TOP_Y + BASE_H + 18;

  const vbW = X + WIDTH + DEPTH_X + 92;
  const vbH = SITE_FRONT_Y + 44;

  const ids = {
    concreteFront: `${uid}-b3d-concrete-front`,
    concreteSide: `${uid}-b3d-concrete-side`,
    slab: `${uid}-b3d-slab`,
    glass: `${uid}-b3d-glass`,
    glassSide: `${uid}-b3d-glass-side`,
    roof: `${uid}-b3d-roof`,
    site: `${uid}-b3d-site`,
    shadow: `${uid}-b3d-shadow`,
    concreteTexture: `${uid}-b3d-texture-concrete`,
    glassTexture: `${uid}-b3d-texture-glass`,
    roofTexture: `${uid}-b3d-texture-roof`,
    paversTexture: `${uid}-b3d-texture-pavers`,
  };
  const url = (id) => `url(#${id})`;

  const andares = predio.andares || [];
  const frontGlassWidth = WIDTH * 0.18;
  const centerGlassWidth = WIDTH * 0.22;
  const balconyWidth = WIDTH * 0.1;

  const floors = Array.from({ length: numAndares }, (_, i) => {
    const n = i + 1;
    const andar = andares.find((a) => Number(a.numero) === n);
    const y = FRONT_TOP_Y + (numAndares - n) * FLOOR_H;
    const innerY = y + SLAB_H + Math.max(2, FLOOR_H * 0.12);
    const innerH = Math.max(3, FLOOR_H - SLAB_H * 2 - 7);
    const status = getStatus(andar?.stats);
    const isSelected = selectedFloor === n;
    const isHovered = hovered === n;

    const sideWindow = (t, span) => {
      const along = (value, yValue) => ({
        x: X + WIDTH + DEPTH_X * value,
        y: yValue - DEPTH_Y * value,
      });
      return pts([
        along(t, innerY),
        along(t + span, innerY),
        along(t + span, innerY + innerH),
        along(t, innerY + innerH),
      ]);
    };

    return {
      n,
      y,
      status,
      isSelected,
      isHovered,
      frontPoly: pts([
        { x: X, y },
        { x: X + WIDTH, y },
        { x: X + WIDTH, y: y + FLOOR_H },
        { x: X, y: y + FLOOR_H },
      ]),
      sidePoly: pts([
        { x: X + WIDTH, y },
        { x: X + WIDTH + DEPTH_X, y: y - DEPTH_Y },
        { x: X + WIDTH + DEPTH_X, y: y + FLOOR_H - DEPTH_Y },
        { x: X + WIDTH, y: y + FLOOR_H },
      ]),
      slabFront: { x: X, y: y + FLOOR_H - SLAB_H, width: WIDTH, height: SLAB_H },
      slabSide: pts([
        { x: X + WIDTH, y: y + FLOOR_H - SLAB_H },
        { x: X + WIDTH + DEPTH_X, y: y + FLOOR_H - SLAB_H - DEPTH_Y },
        { x: X + WIDTH + DEPTH_X, y: y + FLOOR_H - DEPTH_Y },
        { x: X + WIDTH, y: y + FLOOR_H },
      ]),
      frontWindows: [
        { x: X + 16, y: innerY, width: frontGlassWidth, height: innerH },
        { x: X + WIDTH * 0.34, y: innerY, width: centerGlassWidth, height: innerH },
        { x: X + WIDTH * 0.73, y: innerY, width: frontGlassWidth, height: innerH },
      ],
      balcony: { x: X + WIDTH * 0.58, y: innerY, width: balconyWidth, height: innerH },
      sideWindows: [sideWindow(0.12, 0.16), sideWindow(0.38, 0.16), sideWindow(0.64, 0.16)],
      label: {
        x: X + 12,
        y: y + FLOOR_H / 2,
        width: clamp(WIDTH * 0.11, 22, 34),
        height: clamp(FLOOR_H * 0.58, 9, 16),
        fontSize: clamp(FLOOR_H * 0.4, 7, 11),
      },
      statusStrip: {
        x: X + WIDTH - 8,
        y: y + SLAB_H,
        width: 4,
        height: Math.max(5, FLOOR_H - SLAB_H * 2),
      },
    };
  });

  const roofTop = pts([
    { x: X - 6, y: FRONT_TOP_Y },
    { x: X + WIDTH + 6, y: FRONT_TOP_Y },
    { x: X + WIDTH + DEPTH_X + 6, y: FRONT_TOP_Y - DEPTH_Y },
    { x: X + DEPTH_X - 6, y: FRONT_TOP_Y - DEPTH_Y },
  ]);

  const siteTop = pts([
    { x: X - 54, y: SITE_FRONT_Y },
    { x: X + WIDTH + 48, y: SITE_FRONT_Y },
    { x: X + WIDTH + DEPTH_X + 78, y: SITE_FRONT_Y - DEPTH_Y - 20 },
    { x: X + DEPTH_X - 80, y: SITE_FRONT_Y - DEPTH_Y - 20 },
  ]);

  const siteFront = pts([
    { x: X - 54, y: SITE_FRONT_Y },
    { x: X + WIDTH + 48, y: SITE_FRONT_Y },
    { x: X + WIDTH + 48, y: SITE_FRONT_Y + 24 },
    { x: X - 54, y: SITE_FRONT_Y + 24 },
  ]);

  const siteSide = pts([
    { x: X + WIDTH + 48, y: SITE_FRONT_Y },
    { x: X + WIDTH + DEPTH_X + 78, y: SITE_FRONT_Y - DEPTH_Y - 20 },
    { x: X + WIDTH + DEPTH_X + 78, y: SITE_FRONT_Y - DEPTH_Y + 4 },
    { x: X + WIDTH + 48, y: SITE_FRONT_Y + 24 },
  ]);

  const baseTop = pts([
    { x: X - 14, y: BASE_TOP_Y },
    { x: X + WIDTH + 14, y: BASE_TOP_Y },
    { x: X + WIDTH + DEPTH_X + 14, y: BASE_TOP_Y - DEPTH_Y },
    { x: X + DEPTH_X - 14, y: BASE_TOP_Y - DEPTH_Y },
  ]);

  const baseFront = pts([
    { x: X - 14, y: BASE_TOP_Y },
    { x: X + WIDTH + 14, y: BASE_TOP_Y },
    { x: X + WIDTH + 14, y: BASE_TOP_Y + BASE_H },
    { x: X - 14, y: BASE_TOP_Y + BASE_H },
  ]);

  const baseSide = pts([
    { x: X + WIDTH + 14, y: BASE_TOP_Y },
    { x: X + WIDTH + DEPTH_X + 14, y: BASE_TOP_Y - DEPTH_Y },
    { x: X + WIDTH + DEPTH_X + 14, y: BASE_TOP_Y + BASE_H - DEPTH_Y },
    { x: X + WIDTH + 14, y: BASE_TOP_Y + BASE_H },
  ]);

  const utility = {
    x: X + WIDTH * 0.48,
    y: FRONT_TOP_Y - DEPTH_Y * 0.5 - 2,
    w: clamp(WIDTH * 0.2, 36, 64),
    h: 18,
    dx: 18,
    dy: 9,
  };

  const renderedFloors = [...floors].reverse();

  return (
    <div className="building-3d-wrap">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        className="building-3d-svg"
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={`Predio ${predio.nome || ''} com ${numAndares} andares`}
      >
        <defs>
          <pattern id={ids.concreteTexture} patternUnits="userSpaceOnUse" width={EXTERIOR_TEXTURES.concrete.size} height={EXTERIOR_TEXTURES.concrete.size}>
            <image href={EXTERIOR_TEXTURES.concrete.href} x="0" y="0" width={EXTERIOR_TEXTURES.concrete.size} height={EXTERIOR_TEXTURES.concrete.size} preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <pattern id={ids.glassTexture} patternUnits="userSpaceOnUse" width={EXTERIOR_TEXTURES.glass.size} height={EXTERIOR_TEXTURES.glass.size}>
            <image href={EXTERIOR_TEXTURES.glass.href} x="0" y="0" width={EXTERIOR_TEXTURES.glass.size} height={EXTERIOR_TEXTURES.glass.size} preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <pattern id={ids.roofTexture} patternUnits="userSpaceOnUse" width={EXTERIOR_TEXTURES.roof.size} height={EXTERIOR_TEXTURES.roof.size}>
            <image href={EXTERIOR_TEXTURES.roof.href} x="0" y="0" width={EXTERIOR_TEXTURES.roof.size} height={EXTERIOR_TEXTURES.roof.size} preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <pattern id={ids.paversTexture} patternUnits="userSpaceOnUse" width={EXTERIOR_TEXTURES.pavers.size} height={EXTERIOR_TEXTURES.pavers.size}>
            <image href={EXTERIOR_TEXTURES.pavers.href} x="0" y="0" width={EXTERIOR_TEXTURES.pavers.size} height={EXTERIOR_TEXTURES.pavers.size} preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <linearGradient id={ids.concreteFront} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3f4f1" />
            <stop offset="48%" stopColor="#cfd5d7" />
            <stop offset="100%" stopColor="#aeb8bd" />
          </linearGradient>
          <linearGradient id={ids.concreteSide} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bac4ca" />
            <stop offset="100%" stopColor="#83909a" />
          </linearGradient>
          <linearGradient id={ids.slab} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#aeb6bb" />
          </linearGradient>
          <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d8f1ff" />
            <stop offset="45%" stopColor="#8dc5dd" />
            <stop offset="100%" stopColor="#4f88a4" />
          </linearGradient>
          <linearGradient id={ids.glassSide} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9ed3e8" />
            <stop offset="100%" stopColor="#3f6f86" />
          </linearGradient>
          <linearGradient id={ids.roof} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6e3dc" />
            <stop offset="100%" stopColor="#b8b2a7" />
          </linearGradient>
          <linearGradient id={ids.site} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ece8dc" />
            <stop offset="100%" stopColor="#c8d0c1" />
          </linearGradient>
          <filter id={ids.shadow} x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.2" />
          </filter>
        </defs>

        <ellipse
          cx={X + WIDTH / 2 + DEPTH_X * 0.45}
          cy={SITE_FRONT_Y + 24}
          rx={WIDTH * 0.72}
          ry={28}
          fill="rgba(15,23,42,0.12)"
        />

        <g className="b3d-site">
          <polygon points={siteTop} fill={url(ids.paversTexture)} stroke="rgba(75,85,99,0.22)" />
          <polygon points={siteTop} fill={url(ids.site)} opacity="0.34" pointerEvents="none" />
          <polygon points={siteFront} fill="#b9976d" stroke="rgba(75,85,99,0.22)" />
          <polygon points={siteSide} fill="#8f704e" stroke="rgba(75,85,99,0.18)" />
          <line x1={X + WIDTH * 0.42} y1={SITE_FRONT_Y - 4} x2={X + WIDTH + DEPTH_X + 42} y2={SITE_FRONT_Y - DEPTH_Y - 20} stroke="#ffffff" strokeWidth="2" opacity="0.55" />
          <line x1={X + WIDTH * 0.58} y1={SITE_FRONT_Y - 2} x2={X + WIDTH + DEPTH_X + 58} y2={SITE_FRONT_Y - DEPTH_Y - 18} stroke="#ffffff" strokeWidth="2" opacity="0.48" />
        </g>

        <g filter={url(ids.shadow)}>
          <polygon points={baseTop} fill={url(ids.paversTexture)} stroke="rgba(71,85,105,0.28)" />
          <polygon points={baseTop} fill="rgba(255,255,255,0.18)" pointerEvents="none" />
          <polygon points={baseSide} fill={url(ids.concreteTexture)} stroke="rgba(71,85,105,0.28)" />
          <polygon points={baseSide} fill="rgba(15,23,42,0.22)" pointerEvents="none" />
          <polygon points={baseFront} fill={url(ids.concreteTexture)} stroke="rgba(71,85,105,0.28)" />
          <polygon points={baseFront} fill="rgba(121,85,48,0.1)" pointerEvents="none" />

          {renderedFloors.map((f) => (
            <g
              key={f.n}
              className={`b3d-floor${f.isSelected ? ' is-selected' : ''}${f.isHovered ? ' is-hovered' : ''}${onSelectFloor ? ' is-clickable' : ''}`}
              role={onSelectFloor ? 'button' : undefined}
              tabIndex={onSelectFloor ? 0 : undefined}
              aria-label={`Andar ${f.n}, ${f.status.text}`}
              onClick={() => onSelectFloor?.(f.n)}
              onKeyDown={(e) => {
                if (!onSelectFloor) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFloor(f.n);
                }
              }}
              onMouseEnter={() => setHovered(f.n)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(f.n)}
              onBlur={() => setHovered(null)}
            >
              <polygon className="b3d-floor-face" points={f.sidePoly} fill={url(ids.concreteTexture)} />
              <polygon points={f.sidePoly} fill={url(ids.concreteSide)} opacity="0.42" pointerEvents="none" />
              <polygon className="b3d-floor-face" points={f.frontPoly} fill={url(ids.concreteTexture)} />
              <polygon points={f.frontPoly} fill={url(ids.concreteFront)} opacity="0.28" pointerEvents="none" />

              {f.sideWindows.map((poly, wi) => (
                <polygon key={wi} points={poly} fill={url(ids.glassTexture)} stroke="rgba(255,255,255,0.32)" strokeWidth="0.7" />
              ))}

              {f.frontWindows.map((w, wi) => (
                <g key={wi}>
                  <rect x={w.x} y={w.y} width={w.width} height={w.height} rx="1.8" fill={url(ids.glassTexture)} stroke="rgba(255,255,255,0.55)" strokeWidth="0.7" />
                  <rect x={w.x} y={w.y} width={w.width} height={w.height} rx="1.8" fill={url(ids.glass)} opacity="0.36" pointerEvents="none" />
                  {w.width > 24 && (
                    <line x1={w.x + w.width / 2} y1={w.y + 1} x2={w.x + w.width / 2} y2={w.y + w.height - 1} stroke="rgba(255,255,255,0.42)" strokeWidth="0.7" />
                  )}
                </g>
              ))}

              <rect x={f.balcony.x} y={f.balcony.y} width={f.balcony.width} height={f.balcony.height} rx="1.4" fill="#d5c9b3" stroke="rgba(121,85,48,0.18)" strokeWidth="0.7" />
              <line x1={f.balcony.x + 2} y1={f.balcony.y + f.balcony.height * 0.68} x2={f.balcony.x + f.balcony.width - 2} y2={f.balcony.y + f.balcony.height * 0.68} stroke="#b8893e" strokeWidth="1.2" />

              <polygon points={f.slabSide} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,0.24)" strokeWidth="0.7" />
              <polygon points={f.slabSide} fill={url(ids.slab)} opacity="0.42" pointerEvents="none" />
              <rect x={f.slabFront.x} y={f.slabFront.y} width={f.slabFront.width} height={f.slabFront.height} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,0.24)" strokeWidth="0.7" />
              <rect x={f.slabFront.x} y={f.slabFront.y} width={f.slabFront.width} height={f.slabFront.height} fill={url(ids.slab)} opacity="0.5" pointerEvents="none" />
              <rect x={f.statusStrip.x} y={f.statusStrip.y} width={f.statusStrip.width} height={f.statusStrip.height} rx="2" fill={f.status.color} opacity="0.9" />

              <rect
                x={f.label.x}
                y={f.label.y - f.label.height / 2}
                width={f.label.width}
                height={f.label.height}
                rx="3"
                fill="rgba(15,23,42,0.58)"
                stroke={f.isSelected ? accent : 'rgba(255,255,255,0.28)'}
                strokeWidth={f.isSelected ? 1.4 : 0.7}
              />
              <text
                x={f.label.x + f.label.width / 2}
                y={f.label.y + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={f.label.fontSize}
                fontWeight="800"
                fill="#ffffff"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {f.n}
              </text>

              {(f.isSelected || f.isHovered) && (
                <>
                  <polygon points={f.frontPoly} fill="transparent" stroke={accent} strokeWidth={f.isSelected ? 2.2 : 1.4} />
                  <polygon points={f.sidePoly} fill="transparent" stroke={accent} strokeWidth={f.isSelected ? 2.2 : 1.4} />
                </>
              )}
            </g>
          ))}

          <g className="b3d-roof">
            <polygon points={roofTop} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,0.3)" strokeWidth="1" />
            <polygon points={roofTop} fill={url(ids.roof)} opacity="0.44" pointerEvents="none" />
            <rect x={X - 6} y={FRONT_TOP_Y - 1} width={WIDTH + 12} height="7" fill={url(ids.concreteTexture)} stroke="rgba(71,85,105,0.25)" />
            <rect x={X - 6} y={FRONT_TOP_Y - 1} width={WIDTH + 12} height="7" fill="#c8c2b8" opacity="0.52" pointerEvents="none" />
            <polygon
              points={pts([
                { x: X + WIDTH + 6, y: FRONT_TOP_Y - 1 },
                { x: X + WIDTH + DEPTH_X + 6, y: FRONT_TOP_Y - DEPTH_Y - 1 },
                { x: X + WIDTH + DEPTH_X + 6, y: FRONT_TOP_Y - DEPTH_Y + 6 },
                { x: X + WIDTH + 6, y: FRONT_TOP_Y + 6 },
              ])}
              fill={url(ids.concreteTexture)}
              stroke="rgba(71,85,105,0.25)"
            />
            <polygon
              points={pts([
                { x: X + WIDTH + 6, y: FRONT_TOP_Y - 1 },
                { x: X + WIDTH + DEPTH_X + 6, y: FRONT_TOP_Y - DEPTH_Y - 1 },
                { x: X + WIDTH + DEPTH_X + 6, y: FRONT_TOP_Y - DEPTH_Y + 6 },
                { x: X + WIDTH + 6, y: FRONT_TOP_Y + 6 },
              ])}
              fill="rgba(15,23,42,0.24)"
              pointerEvents="none"
            />
            <polygon
              points={pts([
                { x: utility.x, y: utility.y },
                { x: utility.x + utility.w, y: utility.y },
                { x: utility.x + utility.w + utility.dx, y: utility.y - utility.dy },
                { x: utility.x + utility.dx, y: utility.y - utility.dy },
              ])}
              fill={url(ids.concreteTexture)}
              stroke="rgba(71,85,105,0.28)"
            />
            <polygon
              points={pts([
                { x: utility.x, y: utility.y },
                { x: utility.x + utility.w, y: utility.y },
                { x: utility.x + utility.w, y: utility.y + utility.h },
                { x: utility.x, y: utility.y + utility.h },
              ])}
              fill={url(ids.concreteTexture)}
              stroke="rgba(71,85,105,0.28)"
            />
            <polygon
              points={pts([
                { x: utility.x, y: utility.y },
                { x: utility.x + utility.w, y: utility.y },
                { x: utility.x + utility.w, y: utility.y + utility.h },
                { x: utility.x, y: utility.y + utility.h },
              ])}
              fill="rgba(15,23,42,0.12)"
              pointerEvents="none"
            />
            <polygon
              points={pts([
                { x: utility.x + utility.w, y: utility.y },
                { x: utility.x + utility.w + utility.dx, y: utility.y - utility.dy },
                { x: utility.x + utility.w + utility.dx, y: utility.y + utility.h - utility.dy },
                { x: utility.x + utility.w, y: utility.y + utility.h },
              ])}
              fill={url(ids.concreteTexture)}
              stroke="rgba(71,85,105,0.24)"
            />
            <polygon
              points={pts([
                { x: utility.x + utility.w, y: utility.y },
                { x: utility.x + utility.w + utility.dx, y: utility.y - utility.dy },
                { x: utility.x + utility.w + utility.dx, y: utility.y + utility.h - utility.dy },
                { x: utility.x + utility.w, y: utility.y + utility.h },
              ])}
              fill="rgba(15,23,42,0.28)"
              pointerEvents="none"
            />
          </g>
        </g>
      </svg>

      {showLegend && (
        <div className="b3d-legend">
          {floors.map((f) => (
            <button
              key={f.n}
              className={`b3d-floor-btn${f.isSelected ? ' selected' : ''}`}
              style={{ '--b3d-clr': f.status.color }}
              onClick={() => onSelectFloor?.(f.n)}
              onMouseEnter={() => setHovered(f.n)}
              onMouseLeave={() => setHovered(null)}
              type="button"
            >
              <span className="b3d-dot" style={{ background: f.status.color }} />
              <span className="b3d-floor-label">{f.n}&ordm; andar</span>
              <span className={`b3d-badge b3d-badge-${f.status.type}`}>{f.status.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

const GRID = 20;
const DEFAULT_W = 800;
const DEFAULT_H = 600;
const MIN_W = 400; const MAX_W = 8000;
const MIN_H = 280; const MAX_H = 6000;

const AP_COLORS = {
  disponivel: '#22c55e',
  reservado:  '#f59e0b',
  vendido:    '#ef4444',
  alugado:    '#8b5cf6',
};

const SHAPE_CFG = {
  corredor:    { fill: '#c8ccd1', stroke: '#8b95a1', label: 'Corredor', texture: 'predio-texture-corredor' },
  escada:      { fill: '#e5dcc8', stroke: '#9f8f63', label: 'Escada', texture: 'predio-texture-escada' },
  elevador:    { fill: '#bcd0e8', stroke: '#587fa8', label: 'Elevador', texture: 'predio-texture-elevador' },
  'area-comum':{ fill: '#bbf0c0', stroke: '#6dbf72', label: 'Área Comum' },
};

const FLOOR_TEXTURES = [
  { id: 'predio-texture-corredor', href: '/textures/predio/corredor.jpg', size: 140 },
  { id: 'predio-texture-escada', href: '/textures/predio/escada.jpg', size: 110 },
  { id: 'predio-texture-elevador', href: '/textures/predio/elevador.jpg', size: 92 },
];

const TOOL_LIST = [
  { id: 'select',      label: 'Selecionar',  shortcut: 'V', group: 'core' },
  { id: 'pan',         label: 'Navegar',     shortcut: 'H', group: 'core' },
  { id: 'ap',          label: 'Apartamento', shortcut: 'A', group: 'draw', primary: true },
  { id: 'ap-poly',     label: 'Ap. irreg.',  shortcut: 'P', group: 'draw' },
  { id: 'corredor',    label: 'Corredor',    shortcut: 'C', group: 'draw' },
  { id: 'escada',      label: 'Escada',      shortcut: 'E', group: 'draw' },
  { id: 'elevador',    label: 'Elevador',    shortcut: 'L', group: 'draw' },
  { id: 'area-comum',  label: 'Área Comum',  shortcut: 'Q', group: 'draw' },
  { id: 'apagar',      label: 'Apagar',      shortcut: 'X', group: 'core' },
];

const TOOL_ICONS = {
  select: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2v11l3-2 2 4 2-1-2-4 4-1L3 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  ),
  pan: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 8V3.5a1.5 1.5 0 0 1 3 0V8M9 6V4a1.5 1.5 0 0 1 3 0v8a3 3 0 0 1-3 3H7a3 3 0 0 1-2.5-1.3l-2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  ap: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M2 7h12M7 3v10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/></svg>
  ),
  'ap-poly': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13l1-7 5-3 5 4-2 6-9 0z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="3" r="1.2" fill="currentColor"/></svg>
  ),
  corredor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 5v6M11 5v6" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2"/></svg>
  ),
  escada: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14h4v-3h3V8h3V5h2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>
  ),
  elevador: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5V11M5.5 7.5L8 5l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  'area-comum': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  apagar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>
  ),
};

function snapV(v, doSnap) {
  return doSnap ? Math.round(v / GRID) * GRID : Math.round(v);
}

function clampCanvas(w, h) {
  return {
    w: Math.min(MAX_W, Math.max(MIN_W, Math.round(Number(w) || DEFAULT_W))),
    h: Math.min(MAX_H, Math.max(MIN_H, Math.round(Number(h) || DEFAULT_H))),
  };
}

function centroid(pts) {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function polyString(pts) {
  return pts.map((p) => p.join(',')).join(' ');
}

function FloorPlanTextureDefs() {
  return (
    <>
      {FLOOR_TEXTURES.map((texture) => (
        <pattern
          key={texture.id}
          id={texture.id}
          patternUnits="userSpaceOnUse"
          width={texture.size}
          height={texture.size}
        >
          <image
            href={texture.href}
            x="0"
            y="0"
            width={texture.size}
            height={texture.size}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      ))}
    </>
  );
}

function cloneShape(shape) {
  return JSON.parse(JSON.stringify(shape));
}

function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.round(Math.abs(area / 2) / (GRID * GRID));
}

function parsePolygon(polygon) {
  if (typeof polygon !== 'string') return [];
  return polygon
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

function rectFromPoints(points) {
  if (points.length !== 4) return null;
  const xs = [...new Set(points.map(([x]) => x))];
  const ys = [...new Set(points.map(([, y]) => y))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function normalizeFloorShape(shape, index) {
  const source = shape || {};
  const shapeData = source.shape_data || {};
  const id = String(source.id ?? `floor-shape-${index}`);
  const kind = source.kind || shapeData.kind;

  if (kind === 'ap') {
    const x = Number(source.x ?? shapeData.x) || 0;
    const y = Number(source.y ?? shapeData.y) || 0;
    const w = Math.max(GRID, Number(source.w ?? shapeData.w) || GRID);
    const h = Math.max(GRID, Number(source.h ?? shapeData.h) || GRID);
    const largura_m = Number(source.largura_m ?? shapeData.largura_m) || Math.round(w / GRID);
    const comprimento_m = Number(source.comprimento_m ?? shapeData.comprimento_m) || Math.round(h / GRID);
    return { ...source, ...shapeData, id, kind: 'ap', x, y, w, h, largura_m, comprimento_m, center: [x + w / 2, y + h / 2] };
  }

  if (kind === 'ap-poly') {
    const points = source.points || shapeData.points || parsePolygon(source.polygon);
    return {
      ...source,
      ...shapeData,
      id,
      kind: 'ap-poly',
      points,
      center: points.length ? centroid(points) : [0, 0],
    };
  }

  if (!kind && source.polygon) {
    const points = parsePolygon(source.polygon);
    const rect = rectFromPoints(points);
    if (rect) {
      return {
        ...source,
        id,
        kind: 'ap',
        ...rect,
        center: [rect.x + rect.w / 2, rect.y + rect.h / 2],
      };
    }
    return {
      ...source,
      id,
      kind: 'ap-poly',
      points,
      center: points.length ? centroid(points) : [0, 0],
    };
  }

  if (kind && Number.isFinite(Number(source.x)) && Number.isFinite(Number(source.y))) {
    const x = Number(source.x);
    const y = Number(source.y);
    const w = Math.max(GRID, Number(source.w) || GRID);
    const h = Math.max(GRID, Number(source.h) || GRID);
    return { ...source, id, kind, x, y, w, h, center: [x + w / 2, y + h / 2] };
  }

  return { ...source, id, kind };
}

function normalizeFloorShapes(shapes) {
  return (Array.isArray(shapes) ? shapes : []).map(normalizeFloorShape);
}

function rectHandlePoints(x, y, w, h) {
  return [
    [x, y], [x + w / 2, y], [x + w, y],
    [x, y + h / 2], [x + w, y + h / 2],
    [x, y + h], [x + w / 2, y + h], [x + w, y + h],
  ];
}

function getShapeNodes(shape) {
  if (shape.kind === 'ap-poly') return shape.points || [];
  if (Number.isFinite(shape.x) && Number.isFinite(shape.y) && Number.isFinite(shape.w) && Number.isFinite(shape.h)) {
    return rectHandlePoints(shape.x, shape.y, shape.w, shape.h);
  }
  return [];
}

function resizeRectFromHandle(shape, nodeIdx, newX, newY) {
  let x1 = shape.x;
  let y1 = shape.y;
  let x2 = shape.x + shape.w;
  let y2 = shape.y + shape.h;

  if ([0, 3, 5].includes(nodeIdx)) x1 = Math.min(newX, x2 - GRID);
  if ([2, 4, 7].includes(nodeIdx)) x2 = Math.max(newX, x1 + GRID);
  if ([0, 1, 2].includes(nodeIdx)) y1 = Math.min(newY, y2 - GRID);
  if ([5, 6, 7].includes(nodeIdx)) y2 = Math.max(newY, y1 + GRID);

  const next = { ...shape, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  next.center = [next.x + next.w / 2, next.y + next.h / 2];
  if (next.kind === 'ap') {
    next.largura_m = Math.round(next.w / GRID);
    next.comprimento_m = Math.round(next.h / GRID);
    next.area = next.largura_m * next.comprimento_m;
  }
  return next;
}

function resizeCursorForNode(shape, nodeIdx) {
  if (shape.kind === 'ap-poly') return 'move';
  return ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'ew-resize', 'nesw-resize', 'ns-resize', 'nwse-resize'][nodeIdx] || 'move';
}

function moveNodeInShape(shape, nodeIdx, newX, newY) {
  if (shape.kind === 'ap-poly') {
    const points = (shape.points || []).map((point) => [...point]);
    points[nodeIdx] = [newX, newY];
    return {
      ...shape,
      points,
      center: points.length ? centroid(points) : [0, 0],
      area: polygonArea(points),
    };
  }
  if (Number.isFinite(shape.x) && Number.isFinite(shape.y)) {
    return resizeRectFromHandle(shape, nodeIdx, newX, newY);
  }
  return shape;
}

function moveShapeBy(shape, dx, dy) {
  if (shape.kind === 'ap-poly') {
    const points = (shape.points || []).map(([x, y]) => [x + dx, y + dy]);
    return { ...shape, points, center: points.length ? centroid(points) : [0, 0] };
  }
  if (Number.isFinite(shape.x) && Number.isFinite(shape.y)) {
    const next = { ...shape, x: shape.x + dx, y: shape.y + dy };
    next.center = [next.x + next.w / 2, next.y + next.h / 2];
    return next;
  }
  return shape;
}

function getShapeBBox(shape) {
  if (shape.kind === 'ap-poly') {
    const points = shape.points || [];
    if (!points.length) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  return {
    x1: shape.x ?? 0,
    y1: shape.y ?? 0,
    x2: (shape.x ?? 0) + (shape.w ?? 0),
    y2: (shape.y ?? 0) + (shape.h ?? 0),
  };
}

function shapesInBox(shapes, bx1, by1, bx2, by2) {
  return shapes.filter((shape) => {
    const box = getShapeBBox(shape);
    return box.x2 >= bx1 && box.x1 <= bx2 && box.y2 >= by1 && box.y1 <= by2;
  });
}

function nextApartmentId(shapes, andarNum) {
  const prefix = String(andarNum);
  let maxSuffix = 0;
  for (const shape of shapes) {
    if (shape.kind !== 'ap' && shape.kind !== 'ap-poly') continue;
    const value = String(shape.ap_id || '');
    if (!value.startsWith(prefix)) continue;
    const suffix = value.slice(prefix.length);
    if (/^\d+$/.test(suffix)) maxSuffix = Math.max(maxSuffix, Number(suffix));
  }
  return `${prefix}${String(maxSuffix + 1).padStart(2, '0')}`;
}

// ── SelHandles ──────────────────────────────────────────────────────────────

function SelHandles({ x, y, w, h }) {
  const hh = [
    [x, y], [x + w / 2, y], [x + w, y],
    [x, y + h / 2], [x + w, y + h / 2],
    [x, y + h], [x + w / 2, y + h], [x + w, y + h],
  ];
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#3288e0" strokeWidth="1.5" strokeDasharray="4 3" />
      {hh.map(([hx, hy], i) => (
        <rect key={i} x={hx - 4} y={hy - 4} width="8" height="8" fill="#fff" stroke="#3288e0" strokeWidth="1.5" />
      ))}
    </g>
  );
}

// ── EditorShape ─────────────────────────────────────────────────────────────

function EditorShape({ shape, selected }) {
  if (shape.kind === 'ap') {
    const fill = AP_COLORS[shape.status] || AP_COLORS.disponivel;
    const [cx, cy] = shape.center ?? [shape.x + shape.w / 2, shape.y + shape.h / 2];
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
          fill={fill} fillOpacity={selected ? 0.85 : 0.6}
          stroke={selected ? '#1e293b' : fill} strokeWidth={selected ? 2 : 1.2} />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fontWeight="700"
          fill="#1e293b" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {shape.ap_id}
        </text>
        {shape.area > 0 && (
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#475569"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {shape.area}m²
          </text>
        )}
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }

  if (shape.kind === 'ap-poly') {
    const fill = AP_COLORS[shape.status] || AP_COLORS.disponivel;
    const pts = shape.points || [];
    const [cx, cy] = pts.length ? centroid(pts) : [0, 0];
    return (
      <g data-shape-id={shape.id}>
        <polygon points={polyString(pts)}
          fill={fill} fillOpacity={selected ? 0.85 : 0.6}
          stroke={selected ? '#1e293b' : fill} strokeWidth={selected ? 2 : 1.2} />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fontWeight="700"
          fill="#1e293b" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {shape.ap_id}
        </text>
        {shape.area > 0 && (
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#475569"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {shape.area}m²
          </text>
        )}
        {selected && pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#3288e0" stroke="#fff" strokeWidth="1.5" />
        ))}
      </g>
    );
  }

  const cfg = SHAPE_CFG[shape.kind];
  if (cfg) {
    const fill = cfg.texture ? `url(#${cfg.texture})` : cfg.fill;
    const textureOpacity = cfg.texture ? (selected ? 1 : 0.96) : (selected ? 0.95 : 0.8);
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
          fill={fill} fillOpacity={textureOpacity}
          stroke={selected ? '#3288e0' : cfg.stroke} strokeWidth={selected ? 2 : 1.2} rx="2" />
        {cfg.texture && (
          <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
            fill={cfg.fill} opacity={selected ? 0.12 : 0.18} rx="2" pointerEvents="none" />
        )}
        {shape.kind === 'escada' && shape.w > 40 && shape.h > 40 && (
          <g pointerEvents="none">
            {Array.from({ length: Math.floor(shape.h / 14) }, (_, i) => (
              <line key={i}
                x1={shape.x + 4} y1={shape.y + i * 14 + 10}
                x2={shape.x + shape.w - 4} y2={shape.y + i * 14 + 10}
                stroke={cfg.stroke} strokeWidth="0.8" opacity="0.6" />
            ))}
          </g>
        )}
        {shape.kind === 'elevador' && (
          <g pointerEvents="none">
            <text x={shape.x + shape.w / 2} y={shape.y + shape.h / 2 + 4}
              textAnchor="middle" fontSize={18} fill={cfg.stroke} style={{ userSelect: 'none' }}>⇅</text>
          </g>
        )}
        <text x={shape.x + shape.w / 2} y={shape.y + shape.h / 2 + 4}
          textAnchor="middle" fontSize={10} fontWeight="700" fill="#263241"
          stroke="rgba(255,255,255,0.72)" strokeWidth="3" paintOrder="stroke"
          style={{ pointerEvents: 'none', userSelect: 'none', opacity: shape.kind === 'elevador' ? 0 : 1 }}>
          {shape.name || cfg.label}
        </text>
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }

  return null;
}

// ── PropertiesPanel ─────────────────────────────────────────────────────────

function PSection({ title, children }) {
  return (
    <div className="p-sect">
      <div className="p-sect-title">{title}</div>
      {children}
    </div>
  );
}

function PRow({ label, children }) {
  return (
    <div className="p-row">
      <label className="p-lbl">{label}</label>
      <div className="p-ctl">{children}</div>
    </div>
  );
}

function PropertiesPanel({ shape, onChange, onDelete, canvasSize, onCanvasSizeChange }) {
  if (!shape) {
    return (
      <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="props-empty" style={{ padding: 0, marginBottom: 24 }}>
          <div className="props-eyebrow">EDITOR DE PLANTA</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>Nada selecionado</h3>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 18px', color: 'var(--text-muted)' }}>
            Escolha uma ferramenta na barra lateral e arraste no canvas para criar apartamentos e elementos do andar.
          </p>
          <div className="props-tips">
            {[
              ['V', 'Selecionar'],
              ['A', 'Apartamento retangular'],
              ['P', 'Apartamento irregular'],
              ['C', 'Corredor'],
              ['E', 'Escada'],
              ['L', 'Elevador'],
              ['Q', 'Área Comum'],
              ['Shift+clique', 'Selecionar vários'],
              ['Arrastar vazio', 'Seleção por área'],
              ['Ctrl+C/V', 'Copiar e colar'],
              ['Alt+arrastar', 'Duplicar seleção'],
              ['Enter/Esc', 'Finalizar desenho'],
              ['Duplo clique', 'Finalizar desenho'],
              ['Ctrl+Z', 'Desfazer'],
              ['Del', 'Apagar selecionado'],
            ].map(([k, v]) => (
              <div key={k} className="props-tip">
                <kbd>{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="props-canvas-size">
          <div className="props-legend-title">QUADRO DO ANDAR</div>
          <div className="canvas-size-grid">
            <label>
              <span>Largura</span>
              <input type="number" step="40" min={MIN_W} max={MAX_W}
                value={canvasSize.w}
                onChange={(e) => onCanvasSizeChange({ w: e.target.value })} />
            </label>
            <label>
              <span>Altura</span>
              <input type="number" step="40" min={MIN_H} max={MAX_H}
                value={canvasSize.h}
                onChange={(e) => onCanvasSizeChange({ h: e.target.value })} />
            </label>
          </div>
          <div className="canvas-size-actions">
            <button onClick={() => onCanvasSizeChange({ w: canvasSize.w - 160, h: canvasSize.h - 120 })}>Diminuir</button>
            <button onClick={() => onCanvasSizeChange({ w: canvasSize.w + 160, h: canvasSize.h + 120 })}>Aumentar</button>
          </div>
        </div>

        <div className="props-legend" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="props-legend-title">LEGENDA DOS APARTAMENTOS</div>
          {Object.entries(AP_COLORS).map(([s, c]) => (
            <div key={s} className="props-legend-row">
              <span style={{ background: c }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <div className="props-legend-title">ELEMENTOS</div>
            {Object.entries(SHAPE_CFG).map(([k, cfg]) => (
              <div key={k} className="props-legend-row">
                <span style={{ background: cfg.fill, border: `1.5px solid ${cfg.stroke}` }} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isAp = shape.kind === 'ap' || shape.kind === 'ap-poly';

  if (isAp) {
    return (
      <div className="props">
        <div className="props-head">
          <div>
            <div className="props-eyebrow">APARTAMENTO</div>
            <div className="props-title">{shape.ap_id}</div>
          </div>
          <button className="props-del" onClick={onDelete} title="Apagar (Del)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <PSection title="Identificação">
          <PRow label="Número / ID">
            <input value={shape.ap_id || ''} onChange={(e) => onChange({ ap_id: e.target.value })} />
          </PRow>
          <PRow label="Status">
            <div className="p-segmented p-status-grid">
              {Object.keys(AP_COLORS).map((st) => (
                <button key={st}
                  className={'p-seg' + (shape.status === st ? ' p-seg-active p-seg-' + st : '')}
                  onClick={() => onChange({ status: st })}>
                  <span className="p-status-dot" style={{ background: AP_COLORS[st] }} />
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </PRow>
        </PSection>

        <PSection title="Dimensões">
          {shape.kind === 'ap' ? (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>Largura (m)</span>
                  <input type="number" min="1" step="1"
                    value={shape.largura_m ?? Math.round((shape.w || GRID) / GRID)}
                    style={{ width: '100%' }}
                    onChange={(e) => {
                      const largura_m = Math.max(1, Number(e.target.value) || 1);
                      const comprimento_m = shape.comprimento_m ?? Math.round((shape.h || GRID) / GRID);
                      onChange({ largura_m, comprimento_m, w: largura_m * GRID, h: comprimento_m * GRID, area: largura_m * comprimento_m });
                      const neededW = (shape.x || 0) + largura_m * GRID + GRID * 2;
                      if (neededW > canvasSize.w) onCanvasSizeChange({ w: neededW });
                    }} />
                </label>
                <div style={{ alignSelf: 'flex-end', paddingBottom: 8, color: 'var(--text-muted)', fontSize: 13 }}>×</div>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>Comprimento (m)</span>
                  <input type="number" min="1" step="1"
                    value={shape.comprimento_m ?? Math.round((shape.h || GRID) / GRID)}
                    style={{ width: '100%' }}
                    onChange={(e) => {
                      const comprimento_m = Math.max(1, Number(e.target.value) || 1);
                      const largura_m = shape.largura_m ?? Math.round((shape.w || GRID) / GRID);
                      onChange({ largura_m, comprimento_m, w: largura_m * GRID, h: comprimento_m * GRID, area: largura_m * comprimento_m });
                      const neededH = (shape.y || 0) + comprimento_m * GRID + GRID * 2;
                      if (neededH > canvasSize.h) onCanvasSizeChange({ h: neededH });
                    }} />
                </label>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, marginBottom: 8, textAlign: 'right' }}>
                = {(shape.largura_m ?? Math.round((shape.w || GRID) / GRID)) * (shape.comprimento_m ?? Math.round((shape.h || GRID) / GRID))} m²
              </div>
            </>
          ) : (
            <PRow label="Área (m²)">
              <input type="number" min="0" value={shape.area ?? ''}
                onChange={(e) => onChange({ area: Number(e.target.value) })} />
            </PRow>
          )}
          <PRow label="Quartos">
            <input type="number" min="0" value={shape.quartos ?? ''}
              onChange={(e) => onChange({ quartos: Number(e.target.value) })} />
          </PRow>
          <PRow label="Banheiros">
            <input type="number" min="0" value={shape.banheiros ?? ''}
              onChange={(e) => onChange({ banheiros: Number(e.target.value) })} />
          </PRow>
        </PSection>

        <PSection title="Comercial">
          <PRow label="Tipo">
            <select className="p-ctl-select" value={shape.tipo || 'venda'}
              onChange={(e) => onChange({ tipo: e.target.value })}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 9px', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}>
              <option value="venda">Venda</option>
              <option value="aluguel">Aluguel</option>
              <option value="ambos">Venda e Aluguel</option>
            </select>
          </PRow>
          {(shape.tipo === 'venda' || shape.tipo === 'ambos' || !shape.tipo) && (
            <PRow label="Preço Venda">
              <input type="number" min="0" step="1000" value={shape.preco_venda ?? ''}
                placeholder="R$ 0"
                onChange={(e) => onChange({ preco_venda: Number(e.target.value) || null })} />
            </PRow>
          )}
          {(shape.tipo === 'aluguel' || shape.tipo === 'ambos') && (
            <PRow label="Aluguel/mês">
              <input type="number" min="0" step="100" value={shape.preco_aluguel ?? ''}
                placeholder="R$ 0"
                onChange={(e) => onChange({ preco_aluguel: Number(e.target.value) || null })} />
            </PRow>
          )}
        </PSection>
      </div>
    );
  }

  const cfg = SHAPE_CFG[shape.kind];
  return (
    <div className="props">
      <div className="props-head">
        <div>
          <div className="props-eyebrow">{cfg?.label?.toUpperCase() ?? shape.kind.toUpperCase()}</div>
          <div className="props-title">{shape.name || '—'}</div>
        </div>
        <button className="props-del" onClick={onDelete} title="Apagar (Del)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <PSection title="Identificação">
        <PRow label="Nome">
          <input value={shape.name || ''} onChange={(e) => onChange({ name: e.target.value })}
            placeholder={cfg?.label || 'Nome'} />
        </PRow>
      </PSection>
    </div>
  );
}

// ── ToolButton ───────────────────────────────────────────────────────────────

function ToolButton({ tool, active, onClick }) {
  return (
    <button
      className={'ed-tool' + (active ? ' ed-tool-active' : '')}
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
    >
      <span className="ed-tool-ic">{TOOL_ICONS[tool.id]}</span>
      <span className="ed-tool-lbl">{tool.label}</span>
      <span className="ed-tool-shortcut">{tool.shortcut}</span>
    </button>
  );
}

// ── ReadOnlyFloorPlan ────────────────────────────────────────────────────────

function ReadOnlyFloorPlan({ shapes, apartments, canvasW, canvasH, onSelectAp }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef(null);
  const svgRef = useRef(null);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('[data-shape-id]')) return;
    if (e.button === 1 || e.button === 0) {
      isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning.current || !panStart.current) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    });
  };

  const handleMouseUp = () => { isPanning.current = false; };

  return (
    <div className="fpe-ro-wrap"
      style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#2a2f33', cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}>
      <svg ref={svgRef} viewBox={`0 0 ${canvasW} ${canvasH}`}
        style={{
          width: '100%', height: '100%', display: 'block',
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center',
        }}
        onWheel={handleWheel}>
        <defs>
          <FloorPlanTextureDefs />
          <pattern id="ro-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M${GRID} 0L0 0L0 ${GRID}`} fill="none" stroke="rgba(180,210,255,0.12)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={canvasW} height={canvasH} fill="#f8fafc" />
        <rect width={canvasW} height={canvasH} fill="url(#ro-grid)" />
        {shapes.map((sh, idx) => {
          const isAp = sh.kind === 'ap' || sh.kind === 'ap-poly';
          const apartment = isAp
            ? apartments?.find((item) => String(item.ap_id) === String(sh.ap_id)) || sh
            : null;
          const displayShape = isAp && apartment ? { ...sh, status: apartment.status } : sh;
          return (
            <g key={sh.id || idx}
              onClick={isAp ? (event) => {
                event.stopPropagation();
                onSelectAp?.(apartment, {
                  left: `${event.clientX + 18}px`,
                  top: `${event.clientY + 18}px`,
                  transform: 'none',
                });
              } : undefined}
              style={{ cursor: isAp ? 'pointer' : 'default' }}>
              <EditorShape shape={displayShape} selected={false} />
            </g>
          );
        })}
      </svg>
      <div className="ed-zoom" style={{ top: 16, right: 16 }}>
        <button className="ed-zbtn" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</button>
        <div className="ed-zval">{Math.round(zoom * 100)}%</div>
        <button className="ed-zbtn" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <button className="ed-zbtn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Centralizar">⊙</button>
      </div>
    </div>
  );
}

// ── FloorPlanEditor ──────────────────────────────────────────────────────────

export function FloorPlanEditor({
  andar,
  predio,
  onSave,
  onClose,
  readOnly = false,
  onSelectAp,
  allAndares,
  onSelectAndar,
  defaultApM2 = 700,
}) {
  const [tool, setTool] = useState('ap');
  const [shapes, setShapes] = useState(() => normalizeFloorShapes(andar?.editor_shapes));
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedNodeKeys, setSelectedNodeKeys] = useState(new Set());
  const [boxSelect, setBoxSelect] = useState(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [drawing, setDrawing] = useState(null);   // { x1, y1, x2, y2, kind }
  const [polyPoints, setPolyPoints] = useState([]); // for ap-poly
  const [mousePos, setMousePos] = useState(null);
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snap, setSnap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState(() =>
    clampCanvas(andar?.canvas_w || DEFAULT_W, andar?.canvas_h || DEFAULT_H)
  );

  const svgRef = useRef(null);
  const isPanning = useRef(false);
  const panStart = useRef(null);
  const dragShape = useRef(null);
  const activeNodeDrag = useRef(null);
  const clipboardShapes = useRef([]);

  const selectedShape = shapes.find((s) => s.id === selectedId);

  // Reset when andar changes
  useEffect(() => {
    setShapes(normalizeFloorShapes(andar?.editor_shapes));
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedNodeKeys(new Set());
    setBoxSelect(null);
    setDrawing(null);
    setPolyPoints([]);
    setHistory([]);
    setCanvasSize(clampCanvas(andar?.canvas_w || DEFAULT_W, andar?.canvas_h || DEFAULT_H));
  }, [andar?.id]);

  // ── coordinate helpers ───────────────────────────────────────────────────

  const screenToSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const xR = (clientX - rect.left) / rect.width;
    const yR = (clientY - rect.top) / rect.height;
    return [xR * canvasSize.w, yR * canvasSize.h];
  };

  const toSnap = (v) => snapV(v, snap);

  // ── history ───────────────────────────────────────────────────────────────

  const pushHistory = () => setHistory((h) => [...h.slice(-30), shapes]);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setShapes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  // ── shape helpers ─────────────────────────────────────────────────────────

  const updateShape = (id, patch) => {
    pushHistory();
    setShapes((s) => s.map((sh) => {
      if (sh.id !== id) return sh;
      const next = { ...sh, ...patch };
      if (next.kind === 'ap' && ['x', 'y', 'w', 'h'].some((key) => Object.prototype.hasOwnProperty.call(patch, key))) {
        next.center = [next.x + next.w / 2, next.y + next.h / 2];
      }
      return next;
    }));
  };

  const deleteShape = (id) => {
    pushHistory();
    setShapes((s) => s.filter((sh) => sh.id !== id));
    setSelectedIds((ids) => ids.filter((selected) => selected !== id));
    if (selectedId === id) setSelectedId(null);
    setSelectedNodeKeys(new Set());
  };

  const selectedShapeIds = () => {
    if (selectedIds.length) return selectedIds;
    return selectedId ? [selectedId] : [];
  };

  const copySelectedShapes = () => {
    if (tool !== 'select') return false;
    const ids = selectedShapeIds();
    if (!ids.length) return false;
    clipboardShapes.current = shapes
      .filter((shape) => ids.includes(shape.id))
      .map(cloneShape);
    return clipboardShapes.current.length > 0;
  };

  const createCopiedShapes = (sourceShapes, dx = GRID, dy = GRID) => {
    const copyKey = Date.now();
    const occupied = [...shapes];
    return sourceShapes.map((shape, index) => {
      const next = moveShapeBy(cloneShape(shape), dx, dy);
      next.id = `floor-copy-${copyKey}-${index}`;
      if (next.kind === 'ap' || next.kind === 'ap-poly') {
        next.ap_id = nextApartmentId(occupied, andar?.numero ?? 1);
        next.status = 'disponivel';
      }
      occupied.push(next);
      return next;
    });
  };

  const pasteCopiedShapes = () => {
    if (tool !== 'select' || !clipboardShapes.current.length) return false;
    pushHistory();
    const pasted = createCopiedShapes(clipboardShapes.current);
    const pastedIds = pasted.map((shape) => shape.id);
    clipboardShapes.current = pasted.map(cloneShape);
    setShapes((current) => [...current, ...pasted]);
    setSelectedIds(pastedIds);
    setSelectedId(pastedIds[pastedIds.length - 1] || null);
    setSelectedNodeKeys(new Set());
    return true;
  };

  const activateTool = (id) => {
    setTool(id);
    setDrawing(null);
    setPolyPoints([]);
    setBoxSelect(null);
    setSelectedNodeKeys(new Set());
    activeNodeDrag.current = null;
    dragShape.current = null;
  };

  const finishPoly = (pts) => {
    if (pts.length < 3) { setPolyPoints([]); return; }
    const [cx, cy] = centroid(pts);
    const apPolyArea = polygonArea(pts);
    const newShape = {
      id: `ap-poly-${Date.now()}`,
      kind: 'ap-poly',
      points: pts,
      center: [cx, cy],
      ap_id: nextApartmentId(shapes, andar?.numero ?? 1),
      area: apPolyArea,
      quartos: 2,
      banheiros: 1,
      preco_venda: apPolyArea > 0 && defaultApM2 > 0 ? Math.round(defaultApM2 * apPolyArea) : null,
      preco_aluguel: null,
      tipo: 'venda',
      status: 'disponivel',
    };
    pushHistory();
    setShapes((s) => [...s, newShape]);
    setPolyPoints([]);
    setSelectedId(newShape.id);
    setSelectedIds([newShape.id]);
  };

  // ── mouse events ──────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const target = e.target;

    if (tool === 'pan') {
      isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      return;
    }

    const [rawX, rawY] = screenToSvg(e.clientX, e.clientY);
    const x = toSnap(rawX);
    const y = toSnap(rawY);

    if (tool === 'ap-poly') {
      if (polyPoints.length >= 3) {
        const first = polyPoints[0];
        const dist = Math.hypot(x - first[0], y - first[1]);
        if (dist < GRID * 1.5) { finishPoly(polyPoints); return; }
      }
      setPolyPoints((pts) => [...pts, [x, y]]);
      return;
    }

    if (tool === 'select') {
      const nodeEl = target.closest('[data-node-key]');
      if (nodeEl) {
        const key = nodeEl.dataset.nodeKey;
        const separator = key.lastIndexOf(':');
        const shapeId = key.slice(0, separator);
        const nodeIdx = Number(key.slice(separator + 1));
        const shape = shapes.find((item) => item.id === shapeId);
        if (shape) {
          setSelectedId(shapeId);
          if (!selectedIds.includes(shapeId)) setSelectedIds([shapeId]);

          if (e.ctrlKey || e.metaKey) {
            setSelectedNodeKeys((previous) => {
              const next = new Set(previous);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          } else {
            activeNodeDrag.current = {
              shapeId,
              nodeIdx,
              originShape: shape,
              didPush: false,
            };
          }
        }
        return;
      }

      const shapeEl = target.closest('[data-shape-id]');
      if (shapeEl) {
        const id = shapeEl.dataset.shapeId;
        const shape = shapes.find((item) => item.id === id);
        setSelectedNodeKeys(new Set());

        if (e.shiftKey) {
          const next = selectedIds.includes(id)
            ? selectedIds.filter((selected) => selected !== id)
            : [...selectedIds, id];
          setSelectedIds(next);
          setSelectedId(next.includes(id) ? id : (next[next.length - 1] || null));
        } else {
          if (!selectedIds.includes(id)) setSelectedIds([id]);
          setSelectedId(id);
        }

        if (shape) {
          const dragIds = selectedIds.includes(id) && !e.shiftKey ? selectedIds : [id];
          const origins = dragIds.map((dragId) => shapes.find((item) => item.id === dragId)).filter(Boolean);

          if (e.altKey && origins.length) {
            pushHistory();
            const copied = createCopiedShapes(origins, 0, 0);
            const copiedIds = copied.map((item) => item.id);
            setShapes((current) => [...current, ...copied]);
            setSelectedIds(copiedIds);
            setSelectedId(copiedIds[copiedIds.length - 1] || null);
            clipboardShapes.current = copied.map(cloneShape);
            dragShape.current = { ids: copiedIds, origins: copied, startX: rawX, startY: rawY, didPush: true };
          } else if (!e.shiftKey) {
            dragShape.current = { ids: dragIds, origins, startX: rawX, startY: rawY, didPush: false };
          }
        }
        return;
      }

      setBoxSelect({ startX: rawX, startY: rawY, curX: rawX, curY: rawY });
      setSelectedId(null);
      setSelectedIds([]);
      setSelectedNodeKeys(new Set());
      dragShape.current = null;
      activeNodeDrag.current = null;
      return;
    }

    if (tool === 'apagar') {
      const shapeEl = target.closest('[data-shape-id]');
      if (shapeEl) deleteShape(shapeEl.dataset.shapeId);
      return;
    }

    const drawKinds = ['ap', 'corredor', 'escada', 'elevador', 'area-comum'];
    if (drawKinds.includes(tool)) {
      setDrawing({ x1: x, y1: y, x2: x, y2: y, kind: tool });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning.current && panStart.current) {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
      return;
    }

    const [rawX, rawY] = screenToSvg(e.clientX, e.clientY);
    const x = toSnap(rawX);
    const y = toSnap(rawY);
    setMousePos([x, y]);

    if (activeNodeDrag.current) {
      const drag = activeNodeDrag.current;
      if (!drag.didPush) {
        pushHistory();
        drag.didPush = true;
      }
      setShapes((current) => current.map((shape) => (
        shape.id === drag.shapeId
          ? moveNodeInShape(drag.originShape, drag.nodeIdx, x, y)
          : shape
      )));
      return;
    }

    if (boxSelect) {
      setBoxSelect((current) => ({ ...current, curX: rawX, curY: rawY }));
      return;
    }

    if (dragShape.current) {
      const drag = dragShape.current;
      const dx = snap ? Math.round((rawX - drag.startX) / GRID) * GRID : Math.round(rawX - drag.startX);
      const dy = snap ? Math.round((rawY - drag.startY) / GRID) * GRID : Math.round(rawY - drag.startY);

      if (dx || dy) {
        if (!drag.didPush) {
          pushHistory();
          drag.didPush = true;
        }
        setIsDraggingShape(true);
        setShapes((current) => current.map((shape) => {
          const index = drag.ids.indexOf(shape.id);
          return index === -1 ? shape : moveShapeBy(drag.origins[index], dx, dy);
        }));
      }
      return;
    }

    if (drawing) {
      setDrawing((d) => ({ ...d, x2: x, y2: y }));
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
      return;
    }

    if (activeNodeDrag.current) {
      activeNodeDrag.current = null;
      return;
    }

    if (boxSelect) {
      const x1 = Math.min(boxSelect.startX, boxSelect.curX);
      const y1 = Math.min(boxSelect.startY, boxSelect.curY);
      const x2 = Math.max(boxSelect.startX, boxSelect.curX);
      const y2 = Math.max(boxSelect.startY, boxSelect.curY);
      if (x2 - x1 > 5 || y2 - y1 > 5) {
        const ids = shapesInBox(shapes, x1, y1, x2, y2).map((shape) => shape.id);
        setSelectedIds(ids);
        setSelectedId(ids[ids.length - 1] || null);
      }
      setBoxSelect(null);
      return;
    }

    if (dragShape.current) {
      dragShape.current = null;
      setIsDraggingShape(false);
      return;
    }

    if (drawing) {
      const x = Math.min(drawing.x1, drawing.x2);
      const y = Math.min(drawing.y1, drawing.y2);
      const w = Math.abs(drawing.x2 - drawing.x1);
      const h = Math.abs(drawing.y2 - drawing.y1);

      if (w >= GRID && h >= GRID) {
        pushHistory();
        const cx = x + w / 2;
        const cy = y + h / 2;

        if (drawing.kind === 'ap') {
          const largura_m = Math.round(w / GRID);
          const comprimento_m = Math.round(h / GRID);
          const apArea = largura_m * comprimento_m;
          const newShape = {
            id: `ap-${Date.now()}`,
            kind: 'ap',
            x, y, w, h,
            largura_m,
            comprimento_m,
            center: [cx, cy],
            ap_id: nextApartmentId(shapes, andar?.numero ?? 1),
            area: apArea,
            quartos: 2,
            banheiros: 1,
            preco_venda: apArea > 0 && defaultApM2 > 0 ? Math.round(defaultApM2 * apArea) : null,
            preco_aluguel: null,
            tipo: 'venda',
            status: 'disponivel',
          };
          setShapes((s) => [...s, newShape]);
          setSelectedId(newShape.id);
          setSelectedIds([newShape.id]);
        } else {
          const cfg = SHAPE_CFG[drawing.kind];
          const newShape = {
            id: `${drawing.kind}-${Date.now()}`,
            kind: drawing.kind,
            x, y, w, h,
            center: [cx, cy],
            name: cfg?.label || '',
          };
          setShapes((s) => [...s, newShape]);
          setSelectedId(newShape.id);
          setSelectedIds([newShape.id]);
        }
      }
      setDrawing(null);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  // ── keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'c') {
        if (copySelectedShapes()) e.preventDefault();
        return;
      }

      if (mod && key === 'v') {
        if (pasteCopiedShapes()) e.preventDefault();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (polyPoints.length > 0) { setPolyPoints([]); return; }
        setDrawing(null);
        setBoxSelect(null);
        activeNodeDrag.current = null;
        dragShape.current = null;
        setSelectedId(null);
        setSelectedIds([]);
        setSelectedNodeKeys(new Set());
        activateTool('select');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (polyPoints.length >= 3) finishPoly(polyPoints);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = selectedShapeIds();
        if (ids.length > 1) {
          pushHistory();
          setShapes((current) => current.filter((shape) => !ids.includes(shape.id)));
          setSelectedId(null);
          setSelectedIds([]);
          setSelectedNodeKeys(new Set());
        } else if (selectedId) {
          deleteShape(selectedId);
        }
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      const t = TOOL_LIST.find((t) => t.shortcut === e.key.toUpperCase());
      if (t) activateTool(t.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, polyPoints, selectedId, selectedIds, shapes, history, tool]);

  // ── save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const aps = shapes
        .filter((s) => s.kind === 'ap' || s.kind === 'ap-poly')
        .map((s) => {
          const pts = s.kind === 'ap'
            ? [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]]
            : s.points;
          return {
            ap_id: s.ap_id,
            polygon: pts.map((p) => p.join(',')).join(' '),
            center: s.center,
            area: s.area,
            quartos: s.quartos,
            banheiros: s.banheiros,
            preco_venda: s.preco_venda || null,
            preco_aluguel: s.preco_aluguel || null,
            tipo: s.tipo || 'venda',
            status: s.status || 'disponivel',
            shape_data: s.kind === 'ap'
              ? { kind: 'ap', x: s.x, y: s.y, w: s.w, h: s.h }
              : { kind: 'ap-poly', points: s.points },
          };
        });
      await onSave(shapes, aps, { canvas_w: canvasSize.w, canvas_h: canvasSize.h });
    } finally {
      setSaving(false);
    }
  };

  // ── canvas size ───────────────────────────────────────────────────────────

  const updateCanvasSize = (patch) => {
    setCanvasSize((cs) => clampCanvas(patch.w ?? cs.w, patch.h ?? cs.h));
  };

  // ── stats ─────────────────────────────────────────────────────────────────

  const stats = {
    aps: shapes.filter((s) => s.kind === 'ap' || s.kind === 'ap-poly').length,
    corredores: shapes.filter((s) => s.kind === 'corredor').length,
    outros: shapes.filter((s) => !['ap', 'ap-poly', 'corredor'].includes(s.kind)).length,
  };

  // ── draw preview rect ─────────────────────────────────────────────────────

  const drawRect = drawing
    ? {
        x: Math.min(drawing.x1, drawing.x2),
        y: Math.min(drawing.y1, drawing.y2),
        w: Math.abs(drawing.x2 - drawing.x1),
        h: Math.abs(drawing.y2 - drawing.y1),
        kind: drawing.kind,
      }
    : null;

  // ── read-only mode ────────────────────────────────────────────────────────

  if (readOnly) {
    return (
      <ReadOnlyFloorPlan
        shapes={shapes}
        apartments={andar?.apartamentos}
        canvasW={canvasSize.w}
        canvasH={canvasSize.h}
        onSelectAp={onSelectAp}
      />
    );
  }

  // ── editor mode ───────────────────────────────────────────────────────────

  const andares = allAndares ?? predio?.andares ?? [];

  return (
    <div className="editor">
      {/* Top bar */}
      <header className="ed-top">
        <button className="tb-back" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          Sair
        </button>
        <div className="ed-title">
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {predio?.nome ?? 'Planta Baixa'}{andar ? ` — ${andar.numero}° Andar` : ''}
          </span>
          {(predio?.cidade || predio?.bairro) && (
            <div className="ed-title-loc">
              {[predio.bairro, predio.cidade, predio.estado].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="ed-top-right">
          <button className="ed-tbtn" onClick={undo} disabled={!history.length} title="Desfazer (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 8H3l3-3 3 3H7a4 4 0 0 1 4 4 4 4 0 0 1-4 4H5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/></svg>
            Desfazer
          </button>
          <button className="ed-tbtn" onClick={() => setSnap(!snap)} title="Snap">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h2M7 3h2M11 3h2M3 7h2M7 7h2M11 7h2M3 11h2M7 11h2M11 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Snap {snap ? 'on' : 'off'}
          </button>
          <button className="ed-tbtn ed-tbtn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 10"/></svg>
                Salvando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Salvar Andar
              </>
            )}
          </button>
        </div>
      </header>

      <div className="ed-body">
        {/* Left toolbar */}
        <aside className="ed-toolbar">
          {TOOL_LIST.filter((t) => t.group === 'core' && t.id !== 'apagar').map((t) => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => activateTool(t.id)} />
          ))}
          <div className="ed-tb-sep" />
          <div className="ed-tb-label">DESENHAR</div>
          {TOOL_LIST.filter((t) => t.group === 'draw').map((t) => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => activateTool(t.id)} />
          ))}
          <ToolButton tool={TOOL_LIST.find((t) => t.id === 'apagar')} active={tool === 'apagar'} onClick={() => activateTool('apagar')} />

          {andares.length > 1 && (
            <>
              <div className="ed-tb-sep" />
              <div className="ed-tb-label">ANDAR</div>
              <div className="ed-quadra-picker" style={{ gridTemplateColumns: `repeat(${Math.min(andares.length, 4)}, 1fr)` }}>
                {andares.map((a) => (
                  <button
                    key={a.numero}
                    className={'ed-qbtn' + (a.numero === andar?.numero ? ' ed-qbtn-active' : '')}
                    onClick={() => onSelectAndar?.(a.numero)}
                    title={`${a.numero}° Andar`}
                  >
                    {a.numero}°
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Canvas */}
        <div
          className="ed-canvas"
          style={{
            cursor: tool === 'pan' ? (isPanning.current ? 'grabbing' : 'grab')
              : tool === 'apagar' ? 'not-allowed'
              : tool === 'select' ? (isDraggingShape ? 'grabbing' : 'default')
              : 'crosshair',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (isPanning.current || dragShape.current || activeNodeDrag.current || boxSelect) handleMouseUp();
            setMousePos(null);
          }}
          onDoubleClick={() => { if (polyPoints.length >= 3) finishPoly(polyPoints); }}
        >
          <svg
            className={tool === 'select' ? 'ed-svg-select' : undefined}
            ref={svgRef}
            viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
            style={{
              width: '100%', height: '100%',
              display: 'block',
              transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              userSelect: 'none',
            }}
            onWheel={handleWheel}
          >
            <defs>
              <FloorPlanTextureDefs />
              <pattern id="fpe-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M${GRID} 0L0 0L0 ${GRID}`} fill="none" stroke="rgba(180,210,255,0.13)" strokeWidth="0.5" />
              </pattern>
              <pattern id="fpe-grid-big" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                <path d={`M${GRID*5} 0L0 0L0 ${GRID*5}`} fill="none" stroke="rgba(180,210,255,0.25)" strokeWidth="0.9" />
              </pattern>
            </defs>

            {/* Background */}
            <rect width={canvasSize.w} height={canvasSize.h} fill="#f0f2f5" />
            <rect width={canvasSize.w} height={canvasSize.h} fill="url(#fpe-grid)" />
            <rect width={canvasSize.w} height={canvasSize.h} fill="url(#fpe-grid-big)" />

            {/* Canvas border */}
            <rect width={canvasSize.w} height={canvasSize.h}
              fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />

            {/* Shapes */}
            {shapes.map((s) => (
              <EditorShape
                key={s.id}
                shape={s}
                selected={selectedId === s.id || selectedIds.includes(s.id)}
              />
            ))}

            {/* Drawing preview */}
            {drawRect && drawRect.w > 0 && drawRect.h > 0 && (
              <g>
                <rect
                  x={drawRect.x} y={drawRect.y}
                  width={drawRect.w} height={drawRect.h}
                  fill={drawRect.kind === 'ap' ? 'rgba(50,136,224,0.2)' : 'rgba(120,120,120,0.18)'}
                  stroke="#3288e0"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <text
                  x={drawRect.x + drawRect.w / 2}
                  y={drawRect.y + drawRect.h / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                  fill="#3288e0"
                  pointerEvents="none"
                >
                  {Math.round(drawRect.w / GRID)}x{Math.round(drawRect.h / GRID)} m
                </text>
              </g>
            )}

            {/* Polygon in progress */}
            {polyPoints.length > 0 && (
              <g className="ed-poly-progress">
                <polygon
                  points={[...polyPoints, mousePos ?? polyPoints[polyPoints.length - 1]].map((p) => p.join(',')).join(' ')}
                  fill="rgba(50,136,224,0.18)"
                  stroke="#3288e0"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                {polyPoints.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#3288e0" stroke="#fff" strokeWidth="1.5" />
                ))}
                {polyPoints.length >= 3 && (
                  <circle cx={polyPoints[0][0]} cy={polyPoints[0][1]} r="7"
                    fill="none" stroke="#3288e0" strokeWidth="2" opacity="0.7" />
                )}
              </g>
            )}

            {/* Crosshair */}
            {mousePos && !['select', 'pan'].includes(tool) && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={mousePos[0]} y1={0} x2={mousePos[0]} y2={canvasSize.h}
                  stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1={0} y1={mousePos[1]} x2={canvasSize.w} y2={mousePos[1]}
                  stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
              </g>
            )}

            {tool === 'select' && (
              <g className="ed-node-layer" style={{ pointerEvents: 'all' }}>
                {shapes.map((shape) => {
                  const active = shape.id === selectedId || selectedIds.includes(shape.id);
                  return getShapeNodes(shape).map(([x, y], index) => {
                    const key = `${shape.id}:${index}`;
                    return (
                      <circle
                        key={key}
                        data-node-key={key}
                        cx={x}
                        cy={y}
                        r={active ? 5 : 4}
                        className={
                          'ed-node' +
                          (active ? ' ed-node-active' : ' ed-node-dim') +
                          (selectedNodeKeys.has(key) ? ' ed-node-selected' : '')
                        }
                        style={{ cursor: resizeCursorForNode(shape, index) }}
                      />
                    );
                  });
                })}
              </g>
            )}

            {boxSelect && (
              <rect
                x={Math.min(boxSelect.startX, boxSelect.curX)}
                y={Math.min(boxSelect.startY, boxSelect.curY)}
                width={Math.abs(boxSelect.curX - boxSelect.startX)}
                height={Math.abs(boxSelect.curY - boxSelect.startY)}
                className="ed-box-select"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>

          {/* Bottom statusbar */}
          <div className="ed-statusbar">
            <span className="ed-stat"><b>{stats.aps}</b> apto{stats.aps !== 1 ? 's' : ''}</span>
            <span className="ed-stat"><b>{stats.corredores}</b> corredor{stats.corredores !== 1 ? 'es' : ''}</span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat ed-stat-mono">
              {mousePos ? `${mousePos[0]}, ${mousePos[1]}` : '—, —'}
            </span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat">Quadro <b>{canvasSize.w}×{canvasSize.h}</b></span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat">Zoom <b>{Math.round(zoom * 100)}%</b></span>
            <span className="ed-stat-spacer" />
            {polyPoints.length > 0 && (
              <span className="ed-stat ed-stat-hint">
                {polyPoints.length} ponto{polyPoints.length > 1 ? 's' : ''} · <b>Enter</b>/<b>Esc</b>/duplo clique finaliza · clique no 1º ponto fecha
              </span>
            )}
            {tool === 'ap' && !drawing && !polyPoints.length && (
              <span className="ed-stat ed-stat-hint">
                Arraste para criar um apartamento · próx. <b>{nextApartmentId(shapes, andar?.numero ?? 1)}</b>
              </span>
            )}
          </div>

          {/* Zoom controls */}
          <div className="ed-zoom">
            <button className="ed-zbtn" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
            <div className="ed-zval">{Math.round(zoom * 100)}%</div>
            <button className="ed-zbtn" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>−</button>
            <button className="ed-zbtn" onClick={() => { setZoom(0.9); setPan({ x: 0, y: 0 }); }} title="Centralizar">⊙</button>
          </div>
        </div>

        {/* Right properties panel */}
        <aside className="ed-props">
          <PropertiesPanel
            shape={selectedShape}
            onChange={(patch) => selectedShape && updateShape(selectedShape.id, patch)}
            onDelete={() => selectedShape && deleteShape(selectedShape.id)}
            canvasSize={canvasSize}
            onCanvasSizeChange={updateCanvasSize}
          />
        </aside>
      </div>
    </div>
  );
}

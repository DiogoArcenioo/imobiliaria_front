'use client';

import { fmtBRL, statusLabel } from '../lib/data';
import { AiLoteamentoGenerator } from './AiLoteamentoGenerator';
// editor.jsx — Loteamento map editor (paint-like tools)

import { useCallback as useCallbackEd, useEffect as useEffectEd, useMemo as useMemoEd, useRef as useRefEd, useState as useStateEd } from 'react';

const DEFAULT_VIEW_W = 1400;
const DEFAULT_VIEW_H = 900;
const MIN_VIEW_W = 600;
const MIN_VIEW_H = 420;
const MAX_VIEW_W = 4000;
const MAX_VIEW_H = 3000;
const GRID = 20;
const ROAD_WIDTH_M = 15;
const ROAD_WIDTH = ROAD_WIDTH_M * 4;
const ROAD_DRAG_THRESHOLD = 6;
const ROAD_NODE_SNAP_RADIUS = 24;

function clampCanvasSize(width, height) {
  return {
    width: Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, Math.round(Number(width) || DEFAULT_VIEW_W))),
    height: Math.min(MAX_VIEW_H, Math.max(MIN_VIEW_H, Math.round(Number(height) || DEFAULT_VIEW_H))),
  };
}

function parseViewBox(viewBox) {
  const parts = String(viewBox || '').split(/\s+/).map(Number);
  return clampCanvasSize(parts[2] || DEFAULT_VIEW_W, parts[3] || DEFAULT_VIEW_H);
}

function buildRoadPath(start, segments = []) {
  if (!start) return '';
  let d = `M ${start[0]} ${start[1]}`;
  for (const segment of segments) {
    if (segment.type === 'curve') {
      d += ` Q ${segment.control[0]} ${segment.control[1]} ${segment.to[0]} ${segment.to[1]}`;
    } else {
      d += ` L ${segment.to[0]} ${segment.to[1]}`;
    }
  }
  return d;
}

function roadShapeFromDraft(draft) {
  return {
    kind: 'rua',
    roadType: 'path',
    start: draft.start,
    startConnection: draft.startConnection || null,
    segments: draft.segments,
    d: buildRoadPath(draft.start, draft.segments),
    width: ROAD_WIDTH,
    widthM: ROAD_WIDTH_M,
    name: '',
    label: true,
  };
}

function getRoadEnd(draft) {
  if (!draft?.segments?.length) return draft?.start || [0, 0];
  return draft.segments[draft.segments.length - 1].to;
}

function movePoint(point, dx, dy) {
  return [point[0] + dx, point[1] + dy];
}

function moveRoadShape(shape, dx, dy) {
  if (shape.roadType !== 'path') return { ...shape, x: shape.x + dx, y: shape.y + dy };
  if (!shape.start) return shape;
  const start = movePoint(shape.start, dx, dy);
  const segments = (shape.segments || []).map((segment) => ({
    ...segment,
    to: movePoint(segment.to, dx, dy),
    ...(segment.control ? { control: movePoint(segment.control, dx, dy) } : {}),
  }));
  return {
    ...shape,
    start,
    segments,
    d: buildRoadPath(start, segments),
  };
}

function roadAnchorPoints(shape) {
  if (shape.roadType !== 'path') return [];
  return [shape.start, ...(shape.segments || []).map((segment) => segment.to)].filter(Boolean);
}

function rectRoadAnchorPoints(shape) {
  if (shape.roadType === 'path') return [];
  const horizontal = shape.w >= shape.h;
  if (horizontal) {
    const cy = shape.y + shape.h / 2;
    return [[shape.x, cy], [shape.x + shape.w / 2, cy], [shape.x + shape.w, cy]];
  }
  const cx = shape.x + shape.w / 2;
  return [[cx, shape.y], [cx, shape.y + shape.h / 2], [cx, shape.y + shape.h]];
}

function pointKey(point) {
  return `${Math.round(point[0])}:${Math.round(point[1])}`;
}

function roadSnapPayload(target) {
  if (!target) return null;
  return {
    key: target.key,
    point: target.point,
    shapeIds: target.shapeIds,
  };
}

function collectRoadGraph(shapes) {
  const connectionMap = new Map();
  const controlPoints = [];

  const addConnection = (point, meta) => {
    if (!point) return;
    const key = pointKey(point);
    const existing = connectionMap.get(key);
    if (existing) {
      if (!existing.shapeIds.includes(meta.shapeId)) existing.shapeIds.push(meta.shapeId);
      existing.kinds.add(meta.kind);
      return;
    }
    connectionMap.set(key, {
      key,
      point,
      shapeIds: [meta.shapeId],
      kinds: new Set([meta.kind]),
    });
  };

  for (const shape of shapes) {
    if (shape.kind !== 'rua') continue;

    if (shape.roadType === 'path') {
      const anchors = roadAnchorPoints(shape);
      anchors.forEach((point, index) => {
        addConnection(point, {
          shapeId: shape.id,
          kind: index === 0 || index === anchors.length - 1 ? 'endpoint' : 'vertex',
        });
      });

      let from = shape.start;
      for (const [index, segment] of (shape.segments || []).entries()) {
        if (segment.type === 'curve' && segment.control) {
          controlPoints.push({
            key: `${shape.id}:control:${index}`,
            point: segment.control,
            from,
            to: segment.to,
            shapeId: shape.id,
          });
        }
        from = segment.to;
      }
      continue;
    }

    rectRoadAnchorPoints(shape).forEach((point, index) => {
      addConnection(point, {
        shapeId: shape.id,
        kind: index === 1 ? 'midpoint' : 'endpoint',
      });
    });
  }

  return {
    connectionPoints: Array.from(connectionMap.values()).map((point) => ({
      ...point,
      kinds: Array.from(point.kinds),
    })),
    controlPoints,
  };
}

function findRoadSnapPoint(connectionPoints, rawX, rawY) {
  let best = null;
  for (const target of connectionPoints) {
    const dist = Math.hypot(rawX - target.point[0], rawY - target.point[1]);
    if (dist <= ROAD_NODE_SNAP_RADIUS && (!best || dist < best.distance)) {
      best = { ...target, distance: dist };
    }
  }
  return best;
}

// ── Node editing helpers ───────────────────────────────────────────────────

function getShapeNodes(shape) {
  if (shape.kind === 'lote') {
    const { x, y, w, h } = shape;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  if (shape.kind === 'lote-poly') return shape.points || [];
  if (shape.kind === 'rua' && shape.roadType === 'path') {
    return [shape.start, ...(shape.segments || []).map((s) => s.to)].filter(Boolean);
  }
  if (shape.kind === 'praca' || shape.kind === 'lago') {
    if (shape.shape === 'rect') {
      const { x, y, w, h } = shape;
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }
    if (shape.shape === 'poly') return shape.points || [];
    if (shape.shape === 'ellipse') return [[shape.cx, shape.cy]];
  }
  return [];
}

function moveNodeInShape(shape, nodeIdx, newX, newY) {
  const minSize = GRID;
  if (shape.kind === 'lote') {
    const { x, y, w, h } = shape;
    switch (nodeIdx) {
      case 0: return { ...shape, x: newX, y: newY, w: Math.max(minSize, x + w - newX), h: Math.max(minSize, y + h - newY) };
      case 1: return { ...shape, w: Math.max(minSize, newX - x), y: newY, h: Math.max(minSize, y + h - newY) };
      case 2: return { ...shape, w: Math.max(minSize, newX - x), h: Math.max(minSize, newY - y) };
      case 3: return { ...shape, x: newX, w: Math.max(minSize, x + w - newX), h: Math.max(minSize, newY - y) };
      default: return shape;
    }
  }
  if (shape.kind === 'lote-poly') {
    const pts = [...shape.points]; pts[nodeIdx] = [newX, newY]; return { ...shape, points: pts };
  }
  if (shape.kind === 'rua' && shape.roadType === 'path') {
    if (nodeIdx === 0) {
      const ns = [newX, newY];
      return { ...shape, start: ns, d: buildRoadPath(ns, shape.segments) };
    }
    const segs = [...shape.segments];
    segs[nodeIdx - 1] = { ...segs[nodeIdx - 1], to: [newX, newY] };
    return { ...shape, segments: segs, d: buildRoadPath(shape.start, segs) };
  }
  if (shape.kind === 'praca' || shape.kind === 'lago') {
    if (shape.shape === 'rect') {
      const { x, y, w, h } = shape;
      switch (nodeIdx) {
        case 0: return { ...shape, x: newX, y: newY, w: Math.max(minSize, x + w - newX), h: Math.max(minSize, y + h - newY) };
        case 1: return { ...shape, w: Math.max(minSize, newX - x), y: newY, h: Math.max(minSize, y + h - newY) };
        case 2: return { ...shape, w: Math.max(minSize, newX - x), h: Math.max(minSize, newY - y) };
        case 3: return { ...shape, x: newX, w: Math.max(minSize, x + w - newX), h: Math.max(minSize, newY - y) };
        default: return shape;
      }
    }
    if (shape.shape === 'ellipse' && nodeIdx === 0) return { ...shape, cx: newX, cy: newY };
    if (shape.shape === 'poly') {
      const pts = [...shape.points]; pts[nodeIdx] = [newX, newY]; return { ...shape, points: pts };
    }
  }
  return shape;
}

function getShapeBBox(shape) {
  if (shape.kind === 'lote') return { x1: shape.x, y1: shape.y, x2: shape.x + shape.w, y2: shape.y + shape.h };
  if (shape.kind === 'lote-poly') {
    const xs = shape.points.map(([x]) => x), ys = shape.points.map(([, y]) => y);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  if (shape.kind === 'rua') {
    if (shape.roadType === 'path') {
      const pts = [shape.start, ...(shape.segments || []).map((s) => s.to)].filter(Boolean);
      if (!pts.length) return { x1: 0, y1: 0, x2: 0, y2: 0 };
      const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
      return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    }
    return { x1: shape.x, y1: shape.y, x2: shape.x + shape.w, y2: shape.y + shape.h };
  }
  if (shape.kind === 'praca' || shape.kind === 'lago') {
    if (shape.shape === 'ellipse') return { x1: shape.cx - shape.rx, y1: shape.cy - shape.ry, x2: shape.cx + shape.rx, y2: shape.cy + shape.ry };
    if (shape.shape === 'poly') {
      const xs = shape.points.map(([x]) => x), ys = shape.points.map(([, y]) => y);
      return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    }
    return { x1: shape.x, y1: shape.y, x2: shape.x + shape.w, y2: shape.y + shape.h };
  }
  return { x1: (shape.x ?? 0) - 20, y1: (shape.y ?? 0) - 20, x2: (shape.x ?? 0) + 20, y2: (shape.y ?? 0) + 20 };
}

function shapesInBox(shapes, bx1, by1, bx2, by2) {
  return shapes.filter((s) => {
    const b = getShapeBBox(s);
    return b.x2 >= bx1 && b.x1 <= bx2 && b.y2 >= by1 && b.y1 <= by2;
  });
}

// Convert existing loteamento data → editor shapes
function loteamentoToShapes(lt) {
  const shapes = [];
  if (!lt) return shapes;
  if (Array.isArray(lt.editor_shapes) && lt.editor_shapes.length) {
    return lt.editor_shapes.map((shape, i) => ({
      ...shape,
      id: shape.id || `sh-ed-${i}`,
      ...(shape.kind === 'rua' && shape.roadType === 'path'
        ? {
            width: shape.width || ROAD_WIDTH,
            widthM: shape.widthM || ROAD_WIDTH_M,
            d: shape.d || buildRoadPath(shape.start, shape.segments || []),
          }
        : {}),
    }));
  }

  // Roads (rect) → road shapes
  for (const r of lt.roads || []) {
    if (r.kind === 'rect') {
      shapes.push({
        id: 'sh-r-' + shapes.length,
        kind: 'rua',
        x: r.x, y: r.y, w: r.w, h: r.h,
        name: r.name || '',
        label: !!r.label,
      });
    }
  }
  for (const cr of lt.curvedRoads || []) {
    shapes.push({
      id: 'sh-cr-' + shapes.length,
      kind: 'rua',
      roadType: 'path',
      start: cr.start || null,
      segments: cr.segments || [],
      d: cr.d,
      width: cr.width || ROAD_WIDTH,
      widthM: cr.widthM || ROAD_WIDTH_M,
      name: cr.name || '',
      label: !!cr.label,
    });
  }
  // Landmarks
  for (const lm of lt.landmarks || []) {
    if (lm.kind === 'praca') {
      if (lm.pracaShape === 'ellipse') {
        shapes.push({ id: 'sh-p-' + shapes.length, kind: 'praca', shape: 'ellipse', cx: lm.cx, cy: lm.cy, rx: lm.rx, ry: lm.ry, name: lm.label || 'Praça' });
      } else if (lm.pracaShape === 'poly') {
        shapes.push({ id: 'sh-p-' + shapes.length, kind: 'praca', shape: 'poly', points: lm.points, name: lm.label || 'Praça' });
      } else {
        shapes.push({ id: 'sh-p-' + shapes.length, kind: 'praca', shape: 'rect', x: lm.x, y: lm.y, w: lm.w, h: lm.h, name: lm.label || 'Praça' });
      }
    }
    if (lm.kind === 'lake') {
      if (lm.lakeShape === 'rect') {
        shapes.push({ id: 'sh-l-' + shapes.length, kind: 'lago', shape: 'rect', x: lm.x, y: lm.y, w: lm.w, h: lm.h, name: lm.label || 'Lago' });
      } else if (lm.lakeShape === 'poly') {
        shapes.push({ id: 'sh-l-' + shapes.length, kind: 'lago', shape: 'poly', points: lm.points, name: lm.label || 'Lago' });
      } else {
        shapes.push({ id: 'sh-l-' + shapes.length, kind: 'lago', shape: 'ellipse', cx: lm.cx, cy: lm.cy, rx: lm.rx, ry: lm.ry, name: lm.label || 'Lago' });
      }
    }
    if (lm.kind === 'gate') shapes.push({ id: 'sh-g-' + shapes.length, kind: 'portaria', x: lm.x, y: lm.y, w: 50, h: 40, name: lm.label || 'Portaria' });
  }
  // Trees
  for (const tree of lt.trees || []) {
    const [x, y, treeType = 1] = tree;
    shapes.push({ id: 'sh-t-' + shapes.length, kind: 'arvore', x, y, treeType });
  }
  // Lots — convert polygon strings to rectangles when possible
  for (const lot of lt.lots || []) {
    const points = lot.polygon.split(' ').map((p) => p.split(',').map(Number));
    if (points.length === 4) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      // Check if it's an axis-aligned rect
      const isRect = points.every((p) => (p[0] === x || p[0] === x + w) && (p[1] === y || p[1] === y + h));
      if (isRect) {
        shapes.push({
          id: 'sh-lot-' + shapes.length,
          kind: 'lote',
          x, y, w, h,
          quadra: lot.quadra,
          numero: lot.numero,
          status: lot.status,
          preco: lot.preco,
          area: lot.area,
          frente: lot.frente,
          fundo: lot.fundo,
        });
        continue;
      }
    }
    // Otherwise polygon
    shapes.push({
      id: 'sh-lot-' + shapes.length,
      kind: 'lote-poly',
      points: points,
      quadra: lot.quadra,
      numero: lot.numero,
      status: lot.status,
      preco: lot.preco,
      area: lot.area,
    });
  }
  return shapes;
}

const TOOL_LIST = [
  { id: 'select',   label: 'Selecionar',  shortcut: 'V', group: 'core' },
  { id: 'pan',      label: 'Navegar',     shortcut: 'H', group: 'core' },
  { id: 'lote',     label: 'Lote',        shortcut: 'L', group: 'draw', primary: true },
  { id: 'lote-poly',label: 'Lote irreg.', shortcut: 'P', group: 'draw' },
  { id: 'rua',      label: 'Rua',         shortcut: 'R', group: 'draw' },
  { id: 'praca',    label: 'Praça',       shortcut: 'Q', group: 'draw' },
  { id: 'lago',     label: 'Lago',        shortcut: 'K', group: 'draw' },
  { id: 'portaria', label: 'Portaria',    shortcut: 'G', group: 'draw' },
  { id: 'arvore',   label: 'Árvore',      shortcut: 'T', group: 'draw' },
  { id: 'apagar',   label: 'Apagar',      shortcut: 'X', group: 'core' },
];

const TOOL_ICONS = {
  select: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2v11l3-2 2 4 2-1-2-4 4-1L3 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  ),
  pan: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 8V3.5a1.5 1.5 0 0 1 3 0V8M9 6V4a1.5 1.5 0 0 1 3 0v8a3 3 0 0 1-3 3H7a3 3 0 0 1-2.5-1.3l-2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  lote: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3.5" width="11" height="9" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M2.5 8h11" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/></svg>
  ),
  'lote-poly': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13l1-7 5-3 5 4-2 6-9 0z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="3" r="1.2" fill="currentColor"/></svg>
  ),
  rua: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l4 12M14 2l-4 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M8 3v2M8 7v2M8 11v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  praca: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 7v2M6 8h4" stroke="currentColor" strokeWidth="1.3"/></svg>
  ),
  lago: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6" ry="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 8q1-1 2 0t2 0M9 9q1-1 2 0t2 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/></svg>
  ),
  portaria: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="6" width="10" height="7" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M5 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
  ),
  arvore: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M8 10v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  apagar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/></svg>
  ),
};

export const MapEditor = ({ initialLoteamento, onBack, onSave, saving = false }) => {
  const [tool, setTool] = useStateEd('lote');
  const [shapes, setShapes] = useStateEd(() => loteamentoToShapes(initialLoteamento));
  const [canvasSize, setCanvasSize] = useStateEd(() => parseViewBox(initialLoteamento?.viewBox));
  const [history, setHistory] = useStateEd([]);
  const [selectedId, setSelectedId] = useStateEd(null);
  const [drawing, setDrawing] = useStateEd(null);
  const [polyPoints, setPolyPoints] = useStateEd([]);
  const [lagoSubtool, setLagoSubtool] = useStateEd('ellipse');
  const [lagoPolyPoints, setLagoPolyPoints] = useStateEd([]);
  const [pracaSubtool, setPracaSubtool] = useStateEd('rect');
  const [pracaPolyPoints, setPracaPolyPoints] = useStateEd([]);
  const [arvoreSubtool, setArvoreSubtool] = useStateEd(1);
  const [roadDraft, setRoadDraft] = useStateEd(null);
  const [roadPreview, setRoadPreview] = useStateEd(null);
  const [roadSnapTarget, setRoadSnapTarget] = useStateEd(null);
  const [mousePos, setMousePos] = useStateEd(null);
  const [zoom, setZoom] = useStateEd(0.85);
  const [pan, setPan] = useStateEd({ x: 0, y: 0 });
  const [snap, setSnap] = useStateEd(true);
  const [defaultQuadra, setDefaultQuadra] = useStateEd('A');
  const [showAiModal, setShowAiModal] = useStateEd(false);
  const [loteamentoMeta, setLoteamentoMeta] = useStateEd({
    nome: initialLoteamento?.nome || 'Novo Loteamento',
    bairro: initialLoteamento?.bairro || '',
    cidade: initialLoteamento?.cidade || '',
    estado: initialLoteamento?.estado || 'GO',
  });
  const [selectedIds, setSelectedIds] = useStateEd([]);   // multi-select IDs
  const [boxSelect, setBoxSelect] = useStateEd(null);      // { startX, startY, curX, curY }
  const [selectedNodeKeys, setSelectedNodeKeys] = useStateEd(new Set()); // "shapeId:nodeIdx"

  const svgRef = useRefEd(null);
  const isPanning = useRefEd(false);
  const panStart = useRefEd({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragShape = useRefEd(null); // { ids[], origins[], startX, startY, didPush }
  const roadSegmentDrag = useRefEd(null);
  const activeNodeDrag = useRefEd(null); // { shapeId, nodeIdx, originShape, startX, startY, didPush }
  const [isDraggingShape, setIsDraggingShape] = useStateEd(false);

  const selectedShape = shapes.find((s) => s.id === selectedId);
  const roadGraph = useMemoEd(() => collectRoadGraph(shapes), [shapes]);

  // ── helpers ────────────────────────────────────────────────────────────
  const snapV = (v) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));

  const resolveRoadPoint = (rawX, rawY) => {
    const draftAnchors = roadDraft
      ? [roadDraft.start, ...(roadDraft.segments || []).map((segment) => segment.to)].filter(Boolean)
      : [];
    const currentDraftEndKey = draftAnchors.length ? pointKey(draftAnchors[draftAnchors.length - 1]) : null;
    const draftConnectionPoints = draftAnchors
      .filter((point) => pointKey(point) !== currentDraftEndKey)
      .map((point, index) => ({
        key: `draft:${index}:${pointKey(point)}`,
        point,
        shapeIds: [],
        kinds: ['draft'],
      }));
    const target = findRoadSnapPoint([...roadGraph.connectionPoints, ...draftConnectionPoints], rawX, rawY);
    if (target) return { point: target.point, target };
    return { point: [snapV(rawX), snapV(rawY)], target: null };
  };

  const screenToSvg = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const xR = (clientX - rect.left) / rect.width;
    const yR = (clientY - rect.top) / rect.height;
    return [xR * canvasSize.width, yR * canvasSize.height];
  };

  const pushHistory = useCallbackEd(() => {
    setHistory((h) => [...h.slice(-30), shapes]);
  }, [shapes]);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setShapes(prev);
      return h.slice(0, -1);
    });
  };

  const updateShape = (id, patch) => {
    pushHistory();
    setShapes((s) => s.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)));
  };

  const updateCanvasSize = (patch) => {
    setCanvasSize((current) => clampCanvasSize(
      patch.width ?? current.width,
      patch.height ?? current.height,
    ));
  };

  const moveShapeBy = (shape, dx, dy) => {
    if (shape.kind === 'rua') {
      return moveRoadShape(shape, dx, dy);
    }
    if (shape.kind === 'lago') {
      if (shape.shape === 'rect') return { ...shape, x: shape.x + dx, y: shape.y + dy };
      if (shape.shape === 'poly') return { ...shape, points: shape.points.map(([px, py]) => [px + dx, py + dy]) };
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    }
    if (shape.kind === 'praca') {
      if (shape.shape === 'ellipse') return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
      if (shape.shape === 'poly') return { ...shape, points: shape.points.map(([px, py]) => [px + dx, py + dy]) };
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    }
    if (shape.kind === 'lote-poly') {
      return { ...shape, points: shape.points.map(([px, py]) => [px + dx, py + dy]) };
    }
    if ('x' in shape && 'y' in shape) {
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    }
    return shape;
  };

  const deleteShape = (id) => {
    pushHistory();
    setShapes((s) => s.filter((sh) => sh.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addShape = (sh) => {
    pushHistory();
    const id = 'sh-' + Date.now() + '-' + Math.floor(Math.random() * 999);
    const next = { ...sh, id };
    if (sh.kind === 'lote') {
      // Auto-number within quadra
      const inQuadra = shapes.filter((s) => s.kind === 'lote' && s.quadra === defaultQuadra);
      const maxNum = inQuadra.reduce((m, l) => Math.max(m, l.numero || 0), 0);
      next.quadra = defaultQuadra;
      next.numero = maxNum + 1;
      next.status = 'disponivel';
      const area = Math.round((sh.w / 4) * (sh.h / 4));  // assume 4 SVG units = 1m
      next.area = area;
      next.frente = (sh.w / 4).toFixed(1);
      next.fundo = (sh.h / 4).toFixed(1);
      next.preco = area * 700;
    }
    setShapes((s) => [...s, next]);
    return id;
  };

  const finishRoadDraft = () => {
    if (!roadDraft) return;
    roadSegmentDrag.current = null;
    setRoadPreview(null);

    if (!roadDraft.segments.length) {
      setRoadDraft(null);
      return;
    }

    const id = addShape(roadShapeFromDraft(roadDraft));
    setRoadDraft(null);
    setRoadSnapTarget(null);
    setSelectedId(id);
  };

  const commitRoadSegment = (segment, finishAfterCommit = false) => {
    if (!roadDraft) return;
    const nextDraft = {
      ...roadDraft,
      segments: [...roadDraft.segments, segment],
    };

    roadSegmentDrag.current = null;
    setRoadPreview(null);
    setRoadSnapTarget(null);

    if (finishAfterCommit) {
      const id = addShape(roadShapeFromDraft(nextDraft));
      setRoadDraft(null);
      setSelectedId(id);
      return;
    }

    setRoadDraft(nextDraft);
  };

  // ── mouse handlers ─────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const target = e.target;
    const [rawX, rawY] = screenToSvg(e.clientX, e.clientY);
    let x = snapV(rawX), y = snapV(rawY);
    let activeRoadSnap = null;
    if (tool === 'rua') {
      const resolved = resolveRoadPoint(rawX, rawY);
      [x, y] = resolved.point;
      activeRoadSnap = resolved.target;
      setRoadSnapTarget(activeRoadSnap);
    }

    if (tool === 'pan') {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (tool === 'select') {
      // 1. Node handle click?
      const nodeEl = target.closest('[data-node-key]');
      if (nodeEl) {
        const key = nodeEl.dataset.nodeKey;
        const [shapeId, nodeIdxStr] = key.split(':');
        const nodeIdx = parseInt(nodeIdxStr, 10);
        const shape = shapes.find((s) => s.id === shapeId);
        if (shape) {
          // Always select the shape the node belongs to
          setSelectedId(shapeId);
          if (!selectedIds.includes(shapeId)) setSelectedIds([shapeId]);

          if (e.ctrlKey || e.metaKey) {
            setSelectedNodeKeys((prev) => {
              const next = new Set(prev);
              next.has(key) ? next.delete(key) : next.add(key);
              return next;
            });
          } else {
            // Start node drag immediately — no pre-selection step needed
            activeNodeDrag.current = {
              shapeId, nodeIdx,
              originShape: shape,
              startX: rawX, startY: rawY,
              didPush: false,
            };
          }
        }
        return;
      }

      // 2. Shape click?
      const shapeEl = target.closest('[data-shape-id]');
      if (shapeEl) {
        const id = shapeEl.dataset.shapeId;
        const shape = shapes.find((s) => s.id === id);
        setSelectedNodeKeys(new Set()); // clear node selection when clicking a shape

        if (e.shiftKey) {
          // Shift-click: toggle in multi-selection
          const next = selectedIds.includes(id)
            ? selectedIds.filter((x) => x !== id)
            : [...selectedIds, id];
          setSelectedIds(next);
          setSelectedId(id);
        } else {
          // Regular click: if not already in selection, reset to single
          if (!selectedIds.includes(id)) {
            setSelectedIds([id]);
          }
          setSelectedId(id);
        }

        // Start dragging selected group
        if (shape) {
          const dragIds = selectedIds.includes(id) && !e.shiftKey ? selectedIds : (selectedIds.includes(id) ? selectedIds : [id]);
          const origins = dragIds.map((did) => shapes.find((s) => s.id === did)).filter(Boolean);
          dragShape.current = { ids: dragIds, origins, startX: rawX, startY: rawY, didPush: false };
        }
        return;
      }

      // 3. Empty space: start box selection
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

    if (tool === 'arvore' || tool === 'portaria') {
      const id = addShape({ kind: tool, x, y, ...(tool === 'portaria' ? { w: 50, h: 40, name: 'Portaria' } : { treeType: arvoreSubtool }) });
      setSelectedId(id);
      return;
    }

    if (tool === 'lote-poly') {
      if (polyPoints.length >= 3) {
        const first = polyPoints[0];
        if (Math.hypot(rawX - first[0], rawY - first[1]) <= ROAD_NODE_SNAP_RADIUS) {
          finishPolygon();
          return;
        }
      }
      // Add point to current polygon
      const pts = [...polyPoints, [x, y]];
      setPolyPoints(pts);
      return;
    }

    if (tool === 'rua') {
      if (!roadDraft) {
        setRoadDraft({
          start: [x, y],
          startConnection: roadSnapPayload(activeRoadSnap),
          segments: [],
        });
        setRoadPreview(null);
        setSelectedId(null);
        return;
      }

      const anchor = [x, y];
      roadSegmentDrag.current = {
        anchor,
        from: getRoadEnd(roadDraft),
        snapTarget: activeRoadSnap,
      };
      setRoadPreview({ type: 'line', to: anchor });
      return;
    }

    if (tool === 'lago' && lagoSubtool === 'poly') {
      if (lagoPolyPoints.length >= 3) {
        const first = lagoPolyPoints[0];
        if (Math.hypot(rawX - first[0], rawY - first[1]) <= ROAD_NODE_SNAP_RADIUS) {
          finishLagoPoly();
          return;
        }
      }
      setLagoPolyPoints([...lagoPolyPoints, [x, y]]);
      return;
    }

    if (tool === 'praca' && pracaSubtool === 'poly') {
      if (pracaPolyPoints.length >= 3) {
        const first = pracaPolyPoints[0];
        if (Math.hypot(rawX - first[0], rawY - first[1]) <= ROAD_NODE_SNAP_RADIUS) {
          finishPracaPoly();
          return;
        }
      }
      setPracaPolyPoints([...pracaPolyPoints, [x, y]]);
      return;
    }

    // Rectangle-based tools: lote, praca, lago
    setDrawing({ kind: tool, x1: x, y1: y, x2: x, y2: y });
  };

  const onMouseMoveSvg = (e) => {
    const [rawX, rawY] = screenToSvg(e.clientX, e.clientY);
    let x = snapV(rawX), y = snapV(rawY);
    if (tool === 'rua' && !roadSegmentDrag.current) {
      const resolved = resolveRoadPoint(rawX, rawY);
      [x, y] = resolved.point;
      setRoadSnapTarget(resolved.target);
    } else if (tool === 'rua' && roadSegmentDrag.current) {
      setRoadSnapTarget(roadSegmentDrag.current.snapTarget || null);
    } else if (roadSnapTarget) {
      setRoadSnapTarget(null);
    }
    setMousePos([x, y]);

    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
      return;
    }
    // Node drag
    if (activeNodeDrag.current) {
      const drag = activeNodeDrag.current;
      const nx = snap ? snapV(rawX) : Math.round(rawX);
      const ny = snap ? snapV(rawY) : Math.round(rawY);
      if (!drag.didPush) { pushHistory(); drag.didPush = true; }
      setShapes((current) =>
        current.map((s) => s.id === drag.shapeId ? moveNodeInShape(drag.originShape, drag.nodeIdx, nx, ny) : s)
      );
      return;
    }
    // Box selection drag
    if (boxSelect) {
      setBoxSelect((prev) => ({ ...prev, curX: rawX, curY: rawY }));
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
          setIsDraggingShape(true);
        }
        setShapes((current) =>
          current.map((shape) => {
            const idx = drag.ids ? drag.ids.indexOf(shape.id) : (shape.id === drag.id ? 0 : -1);
            if (idx === -1) return shape;
            const origin = drag.origins ? drag.origins[idx] : drag.origin;
            return moveShapeBy(origin, dx, dy);
          })
        );
      }
      return;
    }
    if (roadSegmentDrag.current) {
      const drag = roadSegmentDrag.current;
      const dist = Math.hypot(rawX - drag.anchor[0], rawY - drag.anchor[1]);
      setRoadPreview(
        dist > ROAD_DRAG_THRESHOLD
          ? { type: 'curve', control: [x, y], to: drag.anchor }
          : { type: 'line', to: drag.anchor },
      );
      return;
    }
    if (drawing) {
      setDrawing({ ...drawing, x2: x, y2: y });
    }
  };

  const onMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
    }
    if (activeNodeDrag.current) {
      activeNodeDrag.current = null;
      return;
    }
    if (boxSelect) {
      const bx1 = Math.min(boxSelect.startX, boxSelect.curX);
      const by1 = Math.min(boxSelect.startY, boxSelect.curY);
      const bx2 = Math.max(boxSelect.startX, boxSelect.curX);
      const by2 = Math.max(boxSelect.startY, boxSelect.curY);
      if (bx2 - bx1 > 5 || by2 - by1 > 5) {
        const inside = shapesInBox(shapes, bx1, by1, bx2, by2);
        const ids = inside.map((s) => s.id);
        setSelectedIds(ids);
        if (ids.length) setSelectedId(ids[ids.length - 1]);
      }
      setBoxSelect(null);
      return;
    }
    if (dragShape.current) {
      dragShape.current = null;
      setIsDraggingShape(false);
      return;
    }
    if (roadSegmentDrag.current) {
      const drag = roadSegmentDrag.current;
      const segment = {
        ...(roadPreview || { type: 'line', to: drag.anchor }),
        connection: roadSnapPayload(drag.snapTarget),
      };
      const shouldFinish = !!drag.snapTarget && pointKey(drag.snapTarget.point) !== pointKey(drag.from);
      commitRoadSegment(segment, shouldFinish);
      return;
    }
    if (drawing) {
      const w = Math.abs(drawing.x2 - drawing.x1);
      const h = Math.abs(drawing.y2 - drawing.y1);
      if (w >= GRID && h >= GRID) {
        const x = Math.min(drawing.x1, drawing.x2);
        const y = Math.min(drawing.y1, drawing.y2);
        if (drawing.kind === 'lago') {
          if (lagoSubtool === 'rect') {
            addShape({ kind: 'lago', shape: 'rect', x, y, w, h, name: 'Lago' });
          } else {
            addShape({ kind: 'lago', shape: 'ellipse', cx: x + w/2, cy: y + h/2, rx: w/2, ry: h/2, name: 'Lago' });
          }
        } else if (drawing.kind === 'rua') {
          addShape({ kind: 'rua', x, y, w, h, name: '', label: true });
        } else if (drawing.kind === 'praca') {
          if (pracaSubtool === 'ellipse') {
            addShape({ kind: 'praca', shape: 'ellipse', cx: x + w/2, cy: y + h/2, rx: w/2, ry: h/2, name: 'Praça' });
          } else {
            addShape({ kind: 'praca', shape: 'rect', x, y, w, h, name: 'Praça' });
          }
        } else {
          addShape({ kind: drawing.kind, x, y, w, h });
        }
      }
      setDrawing(null);
    }
  };

  const finishPolygon = () => {
    if (polyPoints.length >= 3) {
      pushHistory();
      const inQuadra = shapes.filter((s) => (s.kind === 'lote' || s.kind === 'lote-poly') && s.quadra === defaultQuadra);
      const maxNum = inQuadra.reduce((m, l) => Math.max(m, l.numero || 0), 0);
      const id = 'sh-' + Date.now();
      // approximate area
      let area = 0;
      for (let i = 0; i < polyPoints.length; i++) {
        const [x1, y1] = polyPoints[i];
        const [x2, y2] = polyPoints[(i + 1) % polyPoints.length];
        area += x1 * y2 - x2 * y1;
      }
      area = Math.abs(area / 2) / 16;
      setShapes((s) => [...s, {
        id,
        kind: 'lote-poly',
        points: polyPoints,
        quadra: defaultQuadra,
        numero: maxNum + 1,
        status: 'disponivel',
        area: Math.round(area),
        preco: Math.round(area) * 700,
      }]);
      setSelectedId(id);
    }
    setPolyPoints([]);
  };

  const finishLagoPoly = () => {
    if (lagoPolyPoints.length >= 3) {
      const id = addShape({ kind: 'lago', shape: 'poly', points: lagoPolyPoints, name: 'Lago' });
      setSelectedId(id);
    }
    setLagoPolyPoints([]);
  };

  const finishPracaPoly = () => {
    if (pracaPolyPoints.length >= 3) {
      const id = addShape({ kind: 'praca', shape: 'poly', points: pracaPolyPoints, name: 'Praça' });
      setSelectedId(id);
    }
    setPracaPolyPoints([]);
  };

  const undoRoadDraftPoint = () => {
    if (roadSegmentDrag.current) {
      roadSegmentDrag.current = null;
      setRoadPreview(null);
      setRoadSnapTarget(null);
      return;
    }

    setRoadPreview(null);
    setRoadSnapTarget(null);
    setRoadDraft((draft) => {
      if (!draft) return draft;
      if (draft.segments.length) {
        return { ...draft, segments: draft.segments.slice(0, -1) };
      }
      return null;
    });
  };

  const handleUndo = () => {
    if (roadDraft) {
      undoRoadDraftPoint();
      return;
    }
    undo();
  };

  const finishActiveDraft = () => {
    if (roadDraft) {
      finishRoadDraft();
      return true;
    }
    if (polyPoints.length) {
      if (polyPoints.length >= 3) finishPolygon();
      else setPolyPoints([]);
      return true;
    }
    if (lagoPolyPoints.length) {
      if (lagoPolyPoints.length >= 3) finishLagoPoly();
      else setLagoPolyPoints([]);
      return true;
    }
    if (pracaPolyPoints.length) {
      if (pracaPolyPoints.length >= 3) finishPracaPoly();
      else setPracaPolyPoints([]);
      return true;
    }
    return false;
  };

  // ── keyboard ───────────────────────────────────────────────────────────
  useEffectEd(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (finishActiveDraft()) return;
        roadSegmentDrag.current = null;
        setRoadPreview(null);
        setRoadSnapTarget(null);
        setDrawing(null);
        setPolyPoints([]);
        setLagoPolyPoints([]);
        setPracaPolyPoints([]);
        setBoxSelect(null);
        setSelectedNodeKeys(new Set());
        activeNodeDrag.current = null;
        setSelectedId(null);
        setSelectedIds([]);
      }
      else if (e.key === 'Enter') {
        if (finishActiveDraft()) e.preventDefault();
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 1) {
          pushHistory();
          setShapes((s) => s.filter((sh) => !selectedIds.includes(sh.id)));
          setSelectedIds([]);
          setSelectedId(null);
        } else if (selectedId) {
          deleteShape(selectedId);
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      else {
        const t = TOOL_LIST.find((t) => t.shortcut === e.key.toUpperCase());
        if (t) activateTool(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [polyPoints, lagoPolyPoints, pracaPolyPoints, selectedId, shapes, roadDraft]);

  // ── compute stats ──────────────────────────────────────────────────────
  const stats = useMemoEd(() => {
    let lotes = 0, ruas = 0, areaTotal = 0;
    for (const s of shapes) {
      if (s.kind === 'lote' || s.kind === 'lote-poly') { lotes++; areaTotal += s.area || 0; }
      if (s.kind === 'rua') ruas++;
    }
    return { lotes, ruas, areaTotal };
  }, [shapes]);

  const activateTool = (id) => {
    setTool(id);
    setDrawing(null);
    setPolyPoints([]);
    setLagoPolyPoints([]);
    setPracaPolyPoints([]);
    setRoadDraft(null);
    setRoadPreview(null);
    setRoadSnapTarget(null);
    roadSegmentDrag.current = null;
    setBoxSelect(null);
    setSelectedNodeKeys(new Set());
    activeNodeDrag.current = null;
  };

  const handleAiGenerate = (generatedShapes) => {
    const withIds = generatedShapes.map((shape, idx) => ({
      ...shape,
      id: `ai-${Date.now()}-${idx}`,
    }));
    setHistory((h) => [...h, shapes]);
    setShapes(withIds);
    setSelectedId(null);
  };

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="editor">
      {/* Top bar */}
      <header className="ed-top">
        <button className="tb-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          Sair
        </button>
        <div className="ed-title">
          <input
            className="ed-title-name"
            value={loteamentoMeta.nome}
            onChange={(e) => setLoteamentoMeta({ ...loteamentoMeta, nome: e.target.value })}
            placeholder="Nome do loteamento"
          />
          <div className="ed-title-loc">
            <input
              className="ed-title-input"
              value={loteamentoMeta.bairro}
              onChange={(e) => setLoteamentoMeta({ ...loteamentoMeta, bairro: e.target.value })}
              placeholder="Bairro"
              size="14"
            />
            <span className="ed-title-sep">·</span>
            <input
              className="ed-title-input"
              value={loteamentoMeta.cidade}
              onChange={(e) => setLoteamentoMeta({ ...loteamentoMeta, cidade: e.target.value })}
              placeholder="Cidade"
              size="12"
            />
            <span className="ed-title-sep">/</span>
            <input
              className="ed-title-input ed-title-input-uf"
              value={loteamentoMeta.estado}
              onChange={(e) => setLoteamentoMeta({ ...loteamentoMeta, estado: e.target.value.toUpperCase().slice(0,2) })}
              size="2"
            />
          </div>
        </div>
        <div className="ed-top-right">
          <button
            className="ed-tbtn ed-tbtn-ai"
            onClick={() => setShowAiModal(true)}
            title="Gerar loteamento com IA"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Gerar com IA
          </button>
          <button className="ed-tbtn" onClick={handleUndo} disabled={!history.length && !roadDraft} title="Desfazer (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 8H3l3-3 3 3H7a4 4 0 0 1 4 4 4 4 0 0 1-4 4H5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/></svg>
            Desfazer
          </button>
          <button className="ed-tbtn" onClick={() => setSnap(!snap)} title="Alternar snap (G)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h2M7 3h2M11 3h2M3 7h2M7 7h2M11 7h2M3 11h2M7 11h2M11 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Snap {snap ? 'on' : 'off'}
          </button>
          <button
            className="ed-tbtn ed-tbtn-primary"
            onClick={() => !saving && onSave(shapes, {
              ...loteamentoMeta,
              viewBox: `0 0 ${canvasSize.width} ${canvasSize.height}`,
            })}
            disabled={saving}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 10"/></svg>
                Salvando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Salvar loteamento
              </>
            )}
          </button>
        </div>
      </header>

      <div className="ed-body">
        {/* Left toolbar */}
        <aside className="ed-toolbar">
          {TOOL_LIST.filter((t) => t.group === 'core').map((t) => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => activateTool(t.id)} />
          ))}
          <div className="ed-tb-sep" />
          <div className="ed-tb-label">DESENHAR</div>
          {TOOL_LIST.filter((t) => t.group === 'draw').map((t) => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => activateTool(t.id)} />
          ))}
          {tool === 'lago' && (
            <div className="ed-lago-subtool">
              <button
                className={'ed-lago-sub' + (lagoSubtool === 'ellipse' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setLagoSubtool('ellipse'); setLagoPolyPoints([]); }}
                title="Oval"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6" ry="4.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Oval
              </button>
              <button
                className={'ed-lago-sub' + (lagoSubtool === 'rect' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setLagoSubtool('rect'); setLagoPolyPoints([]); }}
                title="Retângulo"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="4" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Ret.
              </button>
              <button
                className={'ed-lago-sub' + (lagoSubtool === 'poly' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setLagoSubtool('poly'); setLagoPolyPoints([]); }}
                title="Irregular"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 11 C4 7 6 4 9 3 C12 5 14 8 13 12 C10 14 5 13 3 11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                Irreg.
              </button>
            </div>
          )}
          {tool === 'praca' && (
            <div className="ed-lago-subtool">
              <button
                className={'ed-lago-sub' + (pracaSubtool === 'ellipse' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setPracaSubtool('ellipse'); setPracaPolyPoints([]); }}
                title="Oval"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6" ry="4.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Oval
              </button>
              <button
                className={'ed-lago-sub' + (pracaSubtool === 'rect' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setPracaSubtool('rect'); setPracaPolyPoints([]); }}
                title="Retângulo"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="4" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Ret.
              </button>
              <button
                className={'ed-lago-sub' + (pracaSubtool === 'poly' ? ' ed-lago-sub-active' : '')}
                onClick={() => { setPracaSubtool('poly'); setPracaPolyPoints([]); }}
                title="Irregular"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 11 C4 7 6 4 9 3 C12 5 14 8 13 12 C10 14 5 13 3 11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                Irreg.
              </button>
            </div>
          )}
          {tool === 'arvore' && (
            <div className="ed-arvore-subtool">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  className={'ed-arvore-sub' + (arvoreSubtool === n ? ' ed-arvore-sub-active' : '')}
                  onClick={() => setArvoreSubtool(n)}
                  title={`Árvore tipo ${n}`}
                >
                  <img src={`/textures/trees/tree_0${n}.png`} alt={`T${n}`} />
                  <span>T{n}</span>
                </button>
              ))}
            </div>
          )}
          <div className="ed-tb-sep" />
          <div className="ed-tb-label">QUADRA</div>
          <div className="ed-quadra-picker">
            {['A', 'B', 'C', 'D'].map((q) => (
              <button
                key={q}
                className={'ed-qbtn' + (defaultQuadra === q ? ' ed-qbtn-active' : '')}
                onClick={() => setDefaultQuadra(q)}
              >{q}</button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div
          className="ed-canvas"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMoveSvg}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            if (isPanning.current || dragShape.current || roadSegmentDrag.current || activeNodeDrag.current || boxSelect) onMouseUp();
            setRoadSnapTarget(null);
          }}
          onDoubleClick={() => finishActiveDraft()}
          style={{
            cursor: tool === 'pan' ? (isPanning.current ? 'grabbing' : 'grab')
              : tool === 'select' ? (isDraggingShape ? 'grabbing' : 'default')
              : tool === 'apagar' ? 'not-allowed'
              : 'crosshair',
          }}
        >
          <svg
            className={tool === 'select' ? 'ed-svg-select' : undefined}
            ref={svgRef}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              userSelect: 'none',
            }}
          >
            {/* Grid */}
            <defs>
              <pattern id="ed-fundo" patternUnits="userSpaceOnUse" width="512" height="512">
                <image href="/textures/fundo.jpg" x="0" y="0" width="512" height="512" />
              </pattern>
              <pattern id="ed-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M${GRID} 0L0 0L0 ${GRID}`} fill="none" stroke="rgba(180,210,255,0.13)" strokeWidth="0.5" />
              </pattern>
              <pattern id="ed-grid-big" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                <path d={`M${GRID*5} 0L0 0L0 ${GRID*5}`} fill="none" stroke="rgba(180,210,255,0.28)" strokeWidth="0.9" />
              </pattern>
              <pattern id="road-asphalt" patternUnits="userSpaceOnUse" width="80" height="80">
                <rect width="80" height="80" fill="#4a4d4f"/>
                <circle cx="12" cy="18" r="1" fill="#6a6d6f" opacity="0.45"/>
                <circle cx="42" cy="9" r="1.2" fill="#727577" opacity="0.35"/>
                <circle cx="67" cy="33" r="0.8" fill="#808385" opacity="0.3"/>
                <circle cx="28" cy="61" r="1" fill="#75787a" opacity="0.35"/>
                <circle cx="18" cy="42" r="1.3" fill="#2e3032" opacity="0.45"/>
                <circle cx="54" cy="57" r="1" fill="#343638" opacity="0.4"/>
                <circle cx="72" cy="70" r="0.9" fill="#292b2d" opacity="0.35"/>
                <path d="M8 70 L18 64 L24 67" stroke="#2b2d2f" strokeWidth="1" opacity="0.25" fill="none"/>
                <path d="M50 25 L57 30 L63 28" stroke="#2f3133" strokeWidth="1" opacity="0.25" fill="none"/>
              </pattern>
              <pattern id="road-sidewalk" patternUnits="userSpaceOnUse" width="50" height="50">
                <rect width="50" height="50" fill="#d8d5ca"/>
                <path d="M0 0 H50 M0 25 H50 M0 50 H50" stroke="#bdb8aa" strokeWidth="1" opacity="0.8" fill="none"/>
                <path d="M0 0 V50 M25 0 V50 M50 0 V50" stroke="#bdb8aa" strokeWidth="1" opacity="0.8" fill="none"/>
                <circle cx="12" cy="14" r="0.8" fill="#aaa596" opacity="0.5"/>
                <circle cx="35" cy="31" r="0.7" fill="#aaa596" opacity="0.4"/>
              </pattern>
              <pattern id="lake-texture" patternUnits="userSpaceOnUse" width="512" height="512">
                <image href="/textures/lago.jpg" x="0" y="0" width="512" height="512" />
              </pattern>
              <pattern id="park-texture" patternUnits="userSpaceOnUse" width="512" height="512">
                <image href="/textures/praca.jpg" x="0" y="0" width="512" height="512" />
              </pattern>
            </defs>
            <rect width={canvasSize.width} height={canvasSize.height} fill="url(#ed-fundo)" />
            <rect width={canvasSize.width} height={canvasSize.height} fill="url(#ed-grid)" />
            <rect width={canvasSize.width} height={canvasSize.height} fill="url(#ed-grid-big)" />

            <RoadSurfaceLayer shapes={shapes} selectedId={selectedId} selectedIds={selectedIds} />

            {/* Shapes */}
            {shapes.filter((s) => s.kind !== 'rua').map((s) => (
              <EditorShape
                key={s.id}
                shape={s}
                selected={selectedId === s.id || selectedIds.includes(s.id)}
              />
            ))}

            {/* Drawing preview */}
            {drawing && <DrawingPreview drawing={drawing} lagoSubtool={lagoSubtool} pracaSubtool={pracaSubtool} />}
            {/* Lago polygon in progress */}
            {lagoPolyPoints.length > 0 && (
              <g className="ed-poly-progress">
                <path
                  d={[...lagoPolyPoints, mousePos || lagoPolyPoints[lagoPolyPoints.length - 1]]
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + (lagoPolyPoints.length >= 3 ? ' Z' : '')}
                  fill="rgba(148, 184, 213, 0.35)"
                  stroke="#3288e0"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  strokeLinejoin="round"
                />
                {lagoPolyPoints.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#3288e0" stroke="#fff" strokeWidth="1.5" />
                ))}
                {lagoPolyPoints.length >= 3 && (
                  <circle cx={lagoPolyPoints[0][0]} cy={lagoPolyPoints[0][1]} r="7"
                    fill="none" stroke="#3288e0" strokeWidth="2" opacity="0.7" />
                )}
              </g>
            )}
            {/* Praça polygon in progress */}
            {pracaPolyPoints.length > 0 && (
              <g className="ed-poly-progress">
                <path
                  d={[...pracaPolyPoints, mousePos || pracaPolyPoints[pracaPolyPoints.length - 1]]
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + (pracaPolyPoints.length >= 3 ? ' Z' : '')}
                  fill="rgba(159, 190, 94, 0.35)"
                  stroke="#5a9e3a"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  strokeLinejoin="round"
                />
                {pracaPolyPoints.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#5a9e3a" stroke="#fff" strokeWidth="1.5" />
                ))}
                {pracaPolyPoints.length >= 3 && (
                  <circle cx={pracaPolyPoints[0][0]} cy={pracaPolyPoints[0][1]} r="7"
                    fill="none" stroke="#5a9e3a" strokeWidth="2" opacity="0.7" />
                )}
              </g>
            )}
            {roadDraft && (
              <RoadDraftPreview
                draft={roadDraft}
                preview={roadPreview}
                mousePos={mousePos}
                activeSnap={roadSnapTarget}
              />
            )}

            <RoadNetworkOverlay
              graph={roadGraph}
              selectedId={selectedId}
              activeSnap={roadSnapTarget}
            />

            {/* Polygon in progress */}
            {polyPoints.length > 0 && (
              <g className="ed-poly-progress">
                <polygon
                  points={[...polyPoints, mousePos || polyPoints[polyPoints.length-1]].map(p => p.join(',')).join(' ')}
                  fill="rgba(50, 136, 224, 0.18)"
                  stroke="#3288e0"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                {polyPoints.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#3288e0" stroke="#fff" strokeWidth="1.5" />
                ))}
              </g>
            )}

            {/* Mouse coords indicator */}
            {mousePos && (tool !== 'select' && tool !== 'pan') && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={mousePos[0]} y1="0" x2={mousePos[0]} y2={canvasSize.height} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1={mousePos[1]} x2={canvasSize.width} y2={mousePos[1]} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" strokeDasharray="3 3" />
              </g>
            )}

            {/* Node handles — always visible in select mode for all shapes */}
            {tool === 'select' && (
              <g className="ed-node-layer" style={{ pointerEvents: 'all' }}>
                {shapes.map((shape) => {
                  const active = shape.id === selectedId || selectedIds.includes(shape.id);
                  return getShapeNodes(shape).map(([nx, ny], idx) => {
                    const key = `${shape.id}:${idx}`;
                    const isNodeSel = selectedNodeKeys.has(key);
                    return (
                      <circle
                        key={key}
                        data-node-key={key}
                        cx={nx}
                        cy={ny}
                        r={active ? 5 : 4}
                        className={
                          'ed-node' +
                          (active ? ' ed-node-active' : ' ed-node-dim') +
                          (isNodeSel ? ' ed-node-selected' : '')
                        }
                      />
                    );
                  });
                })}
              </g>
            )}

            {/* Box selection rectangle */}
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
            <span className="ed-stat"><b>{stats.lotes}</b> lotes</span>
            <span className="ed-stat"><b>{stats.ruas}</b> ruas</span>
            <span className="ed-stat"><b>{stats.areaTotal}</b> m² lotes</span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat ed-stat-mono">
              {mousePos ? `${mousePos[0]}, ${mousePos[1]}` : '—, —'}
            </span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat">Quadro <b>{canvasSize.width}×{canvasSize.height}</b></span>
            <span className="ed-stat-sep">·</span>
            <span className="ed-stat">Zoom <b>{Math.round(zoom * 100)}%</b></span>
            <span className="ed-stat-spacer" />
            {polyPoints.length > 0 && (
              <span className="ed-stat ed-stat-hint">
                {polyPoints.length} ponto{polyPoints.length > 1 ? 's' : ''} · <b>Enter</b>/<b>Esc</b>/duplo clique finaliza · clique no primeiro ponto fecha
              </span>
            )}
            {lagoPolyPoints.length > 0 && (
              <span className="ed-stat ed-stat-hint">
                Lago irregular · {lagoPolyPoints.length} ponto{lagoPolyPoints.length > 1 ? 's' : ''} · <b>Enter</b>/<b>Esc</b>/duplo clique finaliza · clique no 1º ponto fecha
              </span>
            )}
            {pracaPolyPoints.length > 0 && (
              <span className="ed-stat ed-stat-hint">
                Praça irregular · {pracaPolyPoints.length} ponto{pracaPolyPoints.length > 1 ? 's' : ''} · <b>Enter</b>/<b>Esc</b>/duplo clique finaliza · clique no 1º ponto fecha
              </span>
            )}
            {roadDraft && (
              <span className="ed-stat ed-stat-hint">
                <b>Enter</b>/<b>Esc</b>/duplo clique finaliza · <b>Ctrl+Z</b> desfaz ponto · clique para reta · arraste para curva
              </span>
            )}
            {tool === 'rua' && !roadDraft && (
              <span className="ed-stat ed-stat-hint">Clique para iniciar a rua · pontos verdes encaixam e finalizam conexões · grossura padrão <b>{ROAD_WIDTH_M}m</b></span>
            )}
            {tool === 'lote' && !drawing && !polyPoints.length && !roadDraft && (
              <span className="ed-stat ed-stat-hint">Arraste para criar um lote · Quadra <b>{defaultQuadra}</b> · próx. número <b>{(shapes.filter(s => s.kind === 'lote' && s.quadra === defaultQuadra).length + 1).toString().padStart(2,'0')}</b></span>
            )}
          </div>

          {/* Zoom buttons */}
          <div className="ed-zoom">
            <button className="ed-zbtn" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
            <div className="ed-zval">{Math.round(zoom * 100)}%</div>
            <button className="ed-zbtn" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>−</button>
            <button className="ed-zbtn" onClick={() => { setZoom(0.85); setPan({x:0,y:0}); }} title="Centralizar">⊙</button>
          </div>
        </div>

        {/* Right panel */}
        <aside className="ed-props">
          <PropertiesPanel
            shape={selectedShape}
            onChange={(patch) => updateShape(selectedShape.id, patch)}
            onDelete={() => deleteShape(selectedShape.id)}
            tool={tool}
            shapes={shapes}
            canvasSize={canvasSize}
            onCanvasSizeChange={updateCanvasSize}
          />
        </aside>
      </div>

      {showAiModal && (
        <AiLoteamentoGenerator
          onGenerate={handleAiGenerate}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
};

function ToolButton({ tool, active, onClick }) {
  return (
    <button
      className={'ed-tool' + (active ? ' ed-tool-active' : '') + (tool.primary ? ' ed-tool-primary' : '')}
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
    >
      <span className="ed-tool-ic">{TOOL_ICONS[tool.id]}</span>
      <span className="ed-tool-lbl">{tool.label}</span>
      <span className="ed-tool-shortcut">{tool.shortcut}</span>
    </button>
  );
}

function RoadSurfaceLayer({ shapes, selectedId }) {
  const roads = shapes.filter((shape) => shape.kind === 'rua');

  const rectRoadLine = (shape) => {
    const horizontal = shape.w >= shape.h;
    if (horizontal) {
      const y = shape.y + shape.h / 2;
      return { x1: shape.x, y1: y, x2: shape.x + shape.w, y2: y, width: shape.h };
    }
    const x = shape.x + shape.w / 2;
    return { x1: x, y1: shape.y, x2: x, y2: shape.y + shape.h, width: shape.w };
  };

  const renderSidewalkEdge = (shape) => {
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      const width = shape.width || ROAD_WIDTH;
      return (
        <path
          key={`${shape.id}-sw-edge`}
          data-shape-id={shape.id}
          d={d}
          fill="none"
          stroke="#aaa79d"
          strokeWidth={width + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.45}
        />
      );
    }
    const line = rectRoadLine(shape);
    return (
      <line
        key={`${shape.id}-sw-edge`}
        data-shape-id={shape.id}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="#aaa79d"
        strokeWidth={line.width + 4}
        strokeLinecap="round"
        opacity={0.45}
      />
    );
  };

  const renderBorder = (shape) => {
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      const width = shape.width || ROAD_WIDTH;
      return (
        <path
          key={`${shape.id}-border`}
          data-shape-id={shape.id}
          d={d}
          fill="none"
          stroke="url(#road-sidewalk)"
          strokeWidth={width + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    const line = rectRoadLine(shape);
    return (
      <line
        key={`${shape.id}-border`}
        data-shape-id={shape.id}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="url(#road-sidewalk)"
        strokeWidth={line.width + 2}
        strokeLinecap="round"
      />
    );
  };

  const renderFill = (shape) => {
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      const width = shape.width || ROAD_WIDTH;
      return (
        <path
          key={`${shape.id}-fill`}
          data-shape-id={shape.id}
          d={d}
          fill="none"
          stroke="url(#road-asphalt)"
          strokeWidth={Math.round(width * 0.72)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    const line = rectRoadLine(shape);
    return (
      <line
        key={`${shape.id}-fill`}
        data-shape-id={shape.id}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="url(#road-asphalt)"
        strokeWidth={Math.round(line.width * 0.72)}
        strokeLinecap="round"
      />
    );
  };

  const renderCenterLine = (shape) => {
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      return (
        <path
          key={`${shape.id}-center`}
          d={d}
          fill="none"
          stroke="#f2e8b8"
          strokeWidth="2"
          strokeDasharray="25 20"
          strokeLinecap="round"
          opacity={0.75}
          pointerEvents="none"
        />
      );
    }
    const line = rectRoadLine(shape);
    return (
      <line
        key={`${shape.id}-center`}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="#f2e8b8"
        strokeWidth="2"
        strokeDasharray="25 20"
        strokeLinecap="round"
        opacity={0.75}
        pointerEvents="none"
      />
    );
  };

  const renderSelectedOutline = (shape) => {
    if (shape.id !== selectedId) return null;
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      return (
        <path
          key={`${shape.id}-selected`}
          d={d}
          fill="none"
          stroke="#3288e0"
          strokeWidth="1.5"
          strokeDasharray="7 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      );
    }
    return <SelHandles key={`${shape.id}-selected`} x={shape.x} y={shape.y} w={shape.w} h={shape.h} />;
  };

  const renderLabel = (shape) => {
    if (!shape.label || !shape.name) return null;
    if (shape.roadType === 'path') {
      const anchors = roadAnchorPoints(shape);
      const width = shape.width || ROAD_WIDTH;
      if (!anchors.length) return null;
      return (
        <text
          key={`${shape.id}-label`}
          x={anchors[Math.floor(anchors.length / 2)][0]}
          y={anchors[Math.floor(anchors.length / 2)][1] - width / 2 - 8}
          fontSize="13"
          textAnchor="middle"
          fontFamily="Manrope"
          fontWeight="500"
          fill="#5a6358"
          letterSpacing="0.05em"
          pointerEvents="none"
        >
          {shape.name.toUpperCase()}
        </text>
      );
    }
    return (
      <text
        key={`${shape.id}-label`}
        x={shape.x + shape.w / 2}
        y={shape.y + shape.h / 2 + 4}
        fontSize="13"
        textAnchor="middle"
        fontFamily="Manrope"
        fontWeight="500"
        fill="#5a6358"
        letterSpacing="0.05em"
        pointerEvents="none"
      >
        {shape.name.toUpperCase()}
      </text>
    );
  };

  return (
    <g className="ed-road-surfaces">
      <g>{roads.map(renderSidewalkEdge)}</g>
      <g>{roads.map(renderBorder)}</g>
      <g>{roads.map(renderFill)}</g>
      <g>{roads.map(renderCenterLine)}</g>
      <g>{roads.map(renderSelectedOutline)}</g>
      <g>{roads.map(renderLabel)}</g>
    </g>
  );
}

function RoadNetworkOverlay({ graph, selectedId, activeSnap }) {
  return (
    <g className="ed-road-network" pointerEvents="none">
      {graph.controlPoints.map((control) => (
        <g key={control.key} opacity={control.shapeId === selectedId ? 0.95 : 0.58}>
          {control.from && (
            <line
              x1={control.from[0]}
              y1={control.from[1]}
              x2={control.point[0]}
              y2={control.point[1]}
              stroke="#1a5fa8"
              strokeWidth="1"
              strokeDasharray="5 5"
            />
          )}
          {control.to && (
            <line
              x1={control.point[0]}
              y1={control.point[1]}
              x2={control.to[0]}
              y2={control.to[1]}
              stroke="#1a5fa8"
              strokeWidth="1"
              strokeDasharray="5 5"
            />
          )}
          <rect
            x={control.point[0] - 4}
            y={control.point[1] - 4}
            width="8"
            height="8"
            rx="2"
            fill="#ffffff"
            stroke="#1a5fa8"
            strokeWidth="1.5"
            transform={`rotate(45 ${control.point[0]} ${control.point[1]})`}
          />
        </g>
      ))}

      {graph.connectionPoints.map((node) => {
        const selected = node.shapeIds.includes(selectedId);
        const active = activeSnap?.key === node.key;
        const radius = active ? 8 : selected ? 6 : 5;
        return (
          <g key={node.key} className={active ? 'ed-road-node-active' : undefined}>
            <circle
              cx={node.point[0]}
              cy={node.point[1]}
              r={radius + 4}
              fill={active ? 'rgba(50,136,224,0.18)' : 'rgba(255,255,255,0.75)'}
            />
            <circle
              cx={node.point[0]}
              cy={node.point[1]}
              r={radius}
              fill={active ? '#3288e0' : selected ? '#162347' : '#1e2f58'}
              stroke="#ffffff"
              strokeWidth="2"
            />
            {active && (
              <text
                x={node.point[0] + 12}
                y={node.point[1] - 12}
                fontSize="11"
                fontFamily="Manrope"
                fontWeight="800"
                fill="#0d3a80"
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth="4"
              >
                CONECTAR
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// Render a single shape in the editor
function EditorShape({ shape, selected }) {
  const STATUS_FILL = {
    disponivel: '#b0b8c1',
    reservado:  '#ffbb00',
    vendido:    '#e84040',
  };

  if (shape.kind === 'rua') {
    if (shape.roadType === 'path') {
      const d = shape.d || buildRoadPath(shape.start, shape.segments || []);
      const width = shape.width || ROAD_WIDTH;
      const anchors = roadAnchorPoints(shape);
      return (
        <g data-shape-id={shape.id}>
          <path
            d={d}
            fill="none"
            stroke={selected ? '#3288e0' : '#cdd1c6'}
            strokeWidth={width + (selected ? 5 : 2)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {shape.label && shape.name && anchors.length > 0 && (
            <text
              x={anchors[Math.floor(anchors.length / 2)][0]}
              y={anchors[Math.floor(anchors.length / 2)][1] - width / 2 - 8}
              fontSize="13"
              textAnchor="middle"
              fontFamily="Manrope"
              fontWeight="500"
              fill="#5a6358"
              letterSpacing="0.05em"
              pointerEvents="none"
            >
              {shape.name.toUpperCase()}
            </text>
          )}
          {selected && (
            <g pointerEvents="none">
              <path d={d} fill="none" stroke="#3288e0" strokeWidth="1.5" strokeDasharray="7 5" />
            </g>
          )}
        </g>
      );
    }
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
          fill="#ffffff" stroke={selected ? '#3288e0' : '#cdd1c6'} strokeWidth={selected ? 2.5 : 1} />
        {shape.label && shape.name && (
          <text x={shape.x + shape.w/2} y={shape.y + shape.h/2 + 4} fontSize="13" textAnchor="middle"
            fontFamily="Manrope" fontWeight="500" fill="#5a6358" letterSpacing="0.05em" pointerEvents="none">
            {shape.name.toUpperCase()}
          </text>
        )}
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }
  if (shape.kind === 'praca') {
    const strokeColor = selected ? '#3288e0' : 'rgba(0,0,0,0.35)';
    const sw = selected ? 2.5 : 1.2;
    if (shape.shape === 'ellipse') {
      return (
        <g data-shape-id={shape.id}>
          <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
            fill="url(#park-texture)" stroke={strokeColor} strokeWidth={sw} />
          <text x={shape.cx} y={shape.cy + 5} fontSize="12" textAnchor="middle"
            fontFamily="Manrope" fontWeight="600" fill="#3d5230" pointerEvents="none">
            {shape.name || 'Praça'}
          </text>
          {selected && <SelHandles x={shape.cx - shape.rx} y={shape.cy - shape.ry} w={shape.rx*2} h={shape.ry*2} />}
        </g>
      );
    }
    if (shape.shape === 'poly') {
      const d = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
      const xs = shape.points.map(p => p[0]), ys = shape.points.map(p => p[1]);
      const bx = Math.min(...xs), by = Math.min(...ys);
      const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
      return (
        <g data-shape-id={shape.id}>
          <path d={d} fill="url(#park-texture)" stroke={strokeColor} strokeWidth={sw} strokeLinejoin="round" />
          <text x={bx + bw/2} y={by + bh/2 + 5} fontSize="12" textAnchor="middle"
            fontFamily="Manrope" fontWeight="600" fill="#3d5230" pointerEvents="none">
            {shape.name || 'Praça'}
          </text>
          {selected && <SelHandles x={bx} y={by} w={bw} h={bh} />}
        </g>
      );
    }
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x + 6} y={shape.y + 6} width={shape.w - 12} height={shape.h - 12}
          fill="url(#park-texture)" stroke={strokeColor} strokeWidth={sw} rx="4" />
        <text x={shape.x + shape.w/2} y={shape.y + shape.h/2 + 4} fontSize="12" textAnchor="middle"
          fontFamily="Manrope" fontWeight="600" fill="#3d5230" pointerEvents="none">
          {shape.name || 'Praça'}
        </text>
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }
  if (shape.kind === 'lago') {
    const E = 10; // earth border width (px outside shape)
    if (shape.shape === 'rect') {
      return (
        <g data-shape-id={shape.id}>
          <rect x={shape.x - E} y={shape.y - E} width={shape.w + E*2} height={shape.h + E*2}
            fill="#9c7840" rx="8" />
          <rect x={shape.x - E + 2} y={shape.y - E + 2} width={shape.w + E*2 - 4} height={shape.h + E*2 - 4}
            fill="none" stroke="rgba(60,35,5,0.30)" strokeWidth="4" rx="7" />
          <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
            fill="url(#lake-texture)" rx="5" />
          <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
            fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" rx="5" />
          {selected && <rect x={shape.x - E - 3} y={shape.y - E - 3} width={shape.w + E*2 + 6} height={shape.h + E*2 + 6}
            fill="none" stroke="#3288e0" strokeWidth="2" strokeDasharray="5 3" rx="10" />}
          <text x={shape.x + shape.w/2} y={shape.y + shape.h/2 + 5} fontSize="14" textAnchor="middle"
            fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)" pointerEvents="none">
            {shape.name || 'Lago'}
          </text>
          {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
        </g>
      );
    }
    if (shape.shape === 'poly') {
      const d = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
      const xs = shape.points.map(p => p[0]), ys = shape.points.map(p => p[1]);
      const bx = Math.min(...xs), by = Math.min(...ys);
      const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
      return (
        <g data-shape-id={shape.id}>
          <path d={d} fill="#9c7840" stroke="#9c7840" strokeWidth={E * 2}
            strokeLinejoin="round" paintOrder="stroke fill" />
          <path d={d} fill="#9c7840" stroke="rgba(60,35,5,0.30)" strokeWidth={E * 2 - 4}
            strokeLinejoin="round" paintOrder="stroke fill" />
          <path d={d} fill="url(#lake-texture)" strokeLinejoin="round" />
          <path d={d} fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" strokeLinejoin="round" />
          {selected && <path d={d} fill="none" stroke="#3288e0" strokeWidth="2" strokeDasharray="5 3"
            strokeLinejoin="round" style={{ transform: 'scale(1.02)', transformOrigin: `${bx + bw/2}px ${by + bh/2}px` }} />}
          <text x={bx + bw/2} y={by + bh/2 + 5} fontSize="14" textAnchor="middle"
            fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)" pointerEvents="none">
            {shape.name || 'Lago'}
          </text>
          {selected && <SelHandles x={bx} y={by} w={bw} h={bh} />}
        </g>
      );
    }
    return (
      <g data-shape-id={shape.id}>
        <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx + E} ry={shape.ry + E} fill="#9c7840" />
        <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx + E - 2} ry={shape.ry + E - 2}
          fill="none" stroke="rgba(60,35,5,0.30)" strokeWidth="4" />
        <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
          fill="url(#lake-texture)" />
        <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
          fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" />
        {selected && <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx + E + 3} ry={shape.ry + E + 3}
          fill="none" stroke="#3288e0" strokeWidth="2" strokeDasharray="5 3" />}
        <text x={shape.cx} y={shape.cy + 5} fontSize="14" textAnchor="middle"
          fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)" pointerEvents="none">
          {shape.name || 'Lago'}
        </text>
        {selected && <SelHandles x={shape.cx - shape.rx} y={shape.cy - shape.ry} w={shape.rx*2} h={shape.ry*2} />}
      </g>
    );
  }
  if (shape.kind === 'arvore') {
    const t = shape.treeType || 1;
    const TREE_CFG = {
      1: { href: '/textures/trees/tree_01.png', s: 60 },
      2: { href: '/textures/trees/tree_02.png', s: 90 },
      3: { href: '/textures/trees/tree_03.png', s: 65 },
      4: { href: '/textures/trees/tree_04.png', s: 85 },
      5: { href: '/textures/trees/tree_05.png', s: 75 },
    };
    const cfg = TREE_CFG[t] || TREE_CFG[1];
    const half = cfg.s / 2;
    return (
      <g data-shape-id={shape.id}>
        <image href={cfg.href} x={shape.x - half} y={shape.y - half} width={cfg.s} height={cfg.s} />
        {selected && (
          <circle cx={shape.x} cy={shape.y} r={half + 4}
            fill="none" stroke="#3288e0" strokeWidth="2" strokeDasharray="5 3" opacity="0.85" />
        )}
      </g>
    );
  }
  if (shape.kind === 'portaria') {
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
          fill="#f5f4ee" stroke={selected ? '#3288e0' : '#c9ccc0'} strokeWidth={selected ? 2.5 : 1.5} rx="2" />
        <text x={shape.x + shape.w/2} y={shape.y + shape.h + 14} fontSize="10" textAnchor="middle"
          fontFamily="Manrope" fontWeight="600" fill="#5a6358" pointerEvents="none">
          {shape.name || 'Portaria'}
        </text>
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }
  if (shape.kind === 'lote') {
    const fill = STATUS_FILL[shape.status] || STATUS_FILL.disponivel;
    return (
      <g data-shape-id={shape.id}>
        <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
          fill={fill} fillOpacity={selected ? 0.82 : 0.62}
          stroke={selected ? '#3288e0' : '#999'} strokeWidth={selected ? 2.5 : 1.2} />
        <text x={shape.x + shape.w/2} y={shape.y + shape.h/2 + 4}
          fontSize="13" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600" fill="#1a1f24" pointerEvents="none">
          {shape.quadra}{String(shape.numero).padStart(2,'0')}
        </text>
        {selected && <SelHandles x={shape.x} y={shape.y} w={shape.w} h={shape.h} />}
      </g>
    );
  }
  if (shape.kind === 'lote-poly') {
    const fill = STATUS_FILL[shape.status] || STATUS_FILL.disponivel;
    const xs = shape.points.map(p => p[0]);
    const ys = shape.points.map(p => p[1]);
    const cx = xs.reduce((a,b)=>a+b,0)/xs.length;
    const cy = ys.reduce((a,b)=>a+b,0)/ys.length;
    const pointsStr = shape.points.map(p => p.join(',')).join(' ');
    return (
      <g data-shape-id={shape.id}>
        <polygon points={pointsStr}
          fill={fill} fillOpacity={selected ? 0.82 : 0.62}
          stroke={selected ? '#3288e0' : '#999'} strokeWidth={selected ? 2.5 : 1.2} />
        <text x={cx} y={cy + 4} fontSize="13" textAnchor="middle"
          fontFamily="JetBrains Mono" fontWeight="600" fill="#1a1f24" pointerEvents="none">
          {shape.quadra}{String(shape.numero).padStart(2,'0')}
        </text>
        {selected && shape.points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#3288e0" stroke="#fff" strokeWidth="1.5" />
        ))}
      </g>
    );
  }
  return null;
}

function SelHandles({ x, y, w, h }) {
  const handles = [
    [x, y], [x + w/2, y], [x + w, y],
    [x, y + h/2], [x + w, y + h/2],
    [x, y + h], [x + w/2, y + h], [x + w, y + h],
  ];
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#3288e0" strokeWidth="1.5" strokeDasharray="4 3" />
      {handles.map(([hx, hy], i) => (
        <rect key={i} x={hx - 4} y={hy - 4} width="8" height="8" fill="#fff" stroke="#3288e0" strokeWidth="1.5" />
      ))}
    </g>
  );
}

function RoadDraftPreview({ draft, preview, mousePos, activeSnap }) {
  const previewSegment = preview || (mousePos ? { type: 'line', to: mousePos } : null);
  const segments = previewSegment ? [...draft.segments, previewSegment] : draft.segments;
  const d = buildRoadPath(draft.start, segments);
  const anchors = [draft.start, ...segments.map((segment) => segment.to)].filter(Boolean);
  const controls = [];
  let from = draft.start;
  for (const [index, segment] of segments.entries()) {
    if (segment.type === 'curve' && segment.control) {
      controls.push({ key: index, from, to: segment.to, control: segment.control });
    }
    from = segment.to;
  }

  return (
    <g className="ed-road-draft" pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke="#cdd1c6"
        strokeWidth={ROAD_WIDTH + 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.86)"
        strokeWidth={ROAD_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={d} fill="none" stroke="#3288e0" strokeWidth="1.6" strokeDasharray="7 5" />
      {controls.map((control) => (
        <g key={control.key}>
          <line x1={control.from[0]} y1={control.from[1]} x2={control.control[0]} y2={control.control[1]} stroke="#3288e0" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={control.control[0]} y1={control.control[1]} x2={control.to[0]} y2={control.to[1]} stroke="#3288e0" strokeWidth="1" strokeDasharray="4 4" />
          <rect
            x={control.control[0] - 4}
            y={control.control[1] - 4}
            width="8"
            height="8"
            rx="2"
            fill="#3288e0"
            stroke="#fff"
            strokeWidth="1.5"
            transform={`rotate(45 ${control.control[0]} ${control.control[1]})`}
          />
        </g>
      ))}
      {anchors.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={activeSnap && activeSnap.point[0] === p[0] && activeSnap.point[1] === p[1] ? 8 : 5}
          fill="#3288e0"
          stroke="#fff"
          strokeWidth="1.5"
        />
      ))}
    </g>
  );
}

function DrawingPreview({ drawing, lagoSubtool, pracaSubtool }) {
  const x = Math.min(drawing.x1, drawing.x2);
  const y = Math.min(drawing.y1, drawing.y2);
  const w = Math.abs(drawing.x2 - drawing.x1);
  const h = Math.abs(drawing.y2 - drawing.y1);
  if (w < 1 || h < 1) return null;

  if (drawing.kind === 'lago') {
    if (lagoSubtool === 'rect') {
      return (
        <rect x={x} y={y} width={w} height={h} rx="6"
          fill="rgba(148, 184, 213, 0.45)" stroke="#3288e0" strokeWidth="1.5" strokeDasharray="6 4" />
      );
    }
    return (
      <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2}
        fill="rgba(148, 184, 213, 0.45)" stroke="#3288e0" strokeWidth="1.5" strokeDasharray="6 4" />
    );
  }
  if (drawing.kind === 'praca' && pracaSubtool === 'ellipse') {
    return (
      <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2}
        fill="rgba(197, 212, 177, 0.6)" stroke="#5a9e3a" strokeWidth="1.5" strokeDasharray="6 4" />
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={drawing.kind === 'lote' ? 'rgba(50, 136, 224, 0.25)'
          : drawing.kind === 'rua' ? 'rgba(255,255,255,0.7)'
          : drawing.kind === 'praca' ? 'rgba(197, 212, 177, 0.6)'
          : 'rgba(50, 136, 224, 0.2)'}
        stroke="#3288e0" strokeWidth="1.5" strokeDasharray="6 4" />
      <text x={x + w/2} y={y + h/2 + 4} fontSize="11" textAnchor="middle"
        fontFamily="JetBrains Mono" fontWeight="600" fill="#3288e0" pointerEvents="none">
        {Math.round(w/4)}×{Math.round(h/4)} m
      </text>
    </g>
  );
}

function PropertiesPanel({ shape, onChange, onDelete, tool, shapes, canvasSize, onCanvasSizeChange }) {
  if (!shape) {
    return (
      <div className="props-empty">
        <div className="props-eyebrow">EDITOR DE MAPA</div>
        <h3>Nada selecionado</h3>
        <p>Escolha uma ferramenta na barra lateral e arraste no canvas para criar lotes, ruas e elementos do loteamento.</p>
        <div className="props-tips">
          <div className="props-tip"><kbd>V</kbd> Selecionar</div>
          <div className="props-tip"><kbd>L</kbd> Lote retangular</div>
          <div className="props-tip"><kbd>P</kbd> Lote irregular (polígono)</div>
          <div className="props-tip"><kbd>R</kbd> Rua</div>
          <div className="props-tip"><kbd>Enter/Esc</kbd> Finalizar desenho</div>
          <div className="props-tip"><kbd>Duplo clique</kbd> Finalizar desenho</div>
          <div className="props-tip"><kbd>Ctrl+Z</kbd> Desfazer</div>
          <div className="props-tip"><kbd>Del</kbd> Apagar selecionado</div>
        </div>
        {tool === 'rua' && (
          <div className="props-road-guide">
            <div className="props-legend-title">CONSTRUCAO DE RUAS</div>
            <p>Pontos verdes sao nos de conexao. Aproxime o cursor de um ponto existente para encaixar uma rua nova exatamente nele.</p>
            <p>Quadrados verdes sao controles de curva. Clique para trecho reto; clique e arraste para criar curva.</p>
          </div>
        )}
        <div className="props-canvas-size">
          <div className="props-legend-title">QUADRO DO LOTEAMENTO</div>
          <div className="canvas-size-grid">
            <label>
              <span>Largura</span>
              <input
                type="number"
                step="100"
                min={MIN_VIEW_W}
                max={MAX_VIEW_W}
                value={canvasSize.width}
                onChange={(e) => onCanvasSizeChange({ width: e.target.value })}
              />
            </label>
            <label>
              <span>Altura</span>
              <input
                type="number"
                step="100"
                min={MIN_VIEW_H}
                max={MAX_VIEW_H}
                value={canvasSize.height}
                onChange={(e) => onCanvasSizeChange({ height: e.target.value })}
              />
            </label>
          </div>
          <div className="canvas-size-actions">
            <button onClick={() => onCanvasSizeChange({ width: canvasSize.width - 200, height: canvasSize.height - 120 })}>Diminuir</button>
            <button onClick={() => onCanvasSizeChange({ width: canvasSize.width + 200, height: canvasSize.height + 120 })}>Aumentar</button>
          </div>
        </div>
        <div className="props-legend">
          <div className="props-legend-title">LEGENDA DOS LOTES</div>
          <div className="props-legend-row"><span style={{ background: '#b0b8c1' }} /> Disponível</div>
          <div className="props-legend-row"><span style={{ background: '#ef4444' }} /> Vendido</div>
        </div>
      </div>
    );
  }

  if (shape.kind === 'lote' || shape.kind === 'lote-poly') {
    return (
      <div className="props">
        <div className="props-head">
          <div>
            <div className="props-eyebrow">LOTE</div>
            <div className="props-title">{shape.quadra}{String(shape.numero).padStart(2,'0')}</div>
          </div>
          <button className="props-del" onClick={onDelete} title="Apagar (Del)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <PSection title="Identificação">
          <PRow label="Quadra">
            <input value={shape.quadra || ''} onChange={(e) => onChange({ quadra: e.target.value.toUpperCase().slice(0,2) })} maxLength="2" />
          </PRow>
          <PRow label="Número">
            <input type="number" value={shape.numero || ''} onChange={(e) => onChange({ numero: parseInt(e.target.value) || 0 })} />
          </PRow>
          <PRow label="Status">
            <div className="p-segmented">
              {['disponivel', 'vendido'].map((st) => (
                <button
                  key={st}
                  className={'p-seg' + (shape.status === st ? ' p-seg-active p-seg-' + st : '')}
                  onClick={() => onChange({ status: st })}
                >
                  {statusLabel(st)}
                </button>
              ))}
            </div>
          </PRow>
        </PSection>

        <PSection title="Dimensões">
          {shape.kind === 'lote' ? (
            <>
              <PRow label="Frente (m)">
                <input type="number" step="0.5" value={shape.frente || (shape.w/4).toFixed(1)} onChange={(e) => onChange({ frente: e.target.value })} />
              </PRow>
              <PRow label="Fundo (m)">
                <input type="number" step="0.5" value={shape.fundo || (shape.h/4).toFixed(1)} onChange={(e) => onChange({ fundo: e.target.value })} />
              </PRow>
              <PRow label="Área (m²)">
                <input type="number" value={shape.area || Math.round(shape.w * shape.h / 16)} onChange={(e) => onChange({ area: parseInt(e.target.value) || 0 })} />
              </PRow>
            </>
          ) : (
            <PRow label="Área (m²)">
              <input type="number" value={shape.area || 0} onChange={(e) => onChange({ area: parseInt(e.target.value) || 0 })} />
            </PRow>
          )}
        </PSection>

        <PSection title="Comercial">
          <PRow label="Preço (R$)">
            <input type="number" step="1000" value={shape.preco || 0} onChange={(e) => onChange({ preco: parseInt(e.target.value) || 0 })} />
          </PRow>
          {shape.area > 0 && (
            <PRow label="Por m²">
              <span className="p-readonly">{fmtBRL(Math.round((shape.preco || 0) / shape.area))}</span>
            </PRow>
          )}
        </PSection>
      </div>
    );
  }

  if (shape.kind === 'rua') {
    return (
      <div className="props">
        <div className="props-head">
          <div>
            <div className="props-eyebrow">RUA</div>
            <div className="props-title">{shape.name || 'Sem nome'}</div>
          </div>
          <button className="props-del" onClick={onDelete}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg></button>
        </div>
        <PSection title="Identificação">
          <PRow label="Nome">
            <input value={shape.name || ''} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex.: Avenida das Acácias" />
          </PRow>
          <PRow label="Mostrar nome">
            <input type="checkbox" checked={!!shape.label} onChange={(e) => onChange({ label: e.target.checked })} />
          </PRow>
        </PSection>
        <PSection title="Dimensões (m)">
          {shape.roadType === 'path' ? (
            <>
              <PRow label="Grossura">
                <span className="p-readonly">{((shape.width || ROAD_WIDTH) / 4).toFixed(1)} m</span>
              </PRow>
              <PRow label="Trechos">
                <span className="p-readonly">{(shape.segments || []).length}</span>
              </PRow>
            </>
          ) : (
            <>
              <PRow label="Largura">
                <span className="p-readonly">{(shape.w / 4).toFixed(1)} m</span>
              </PRow>
              <PRow label="Comprimento">
                <span className="p-readonly">{(shape.h / 4).toFixed(1)} m</span>
              </PRow>
            </>
          )}
        </PSection>
      </div>
    );
  }

  // Generic
  return (
    <div className="props">
      <div className="props-head">
        <div>
          <div className="props-eyebrow">{shape.kind.toUpperCase()}</div>
          <div className="props-title">{shape.name || '—'}</div>
        </div>
        <button className="props-del" onClick={onDelete}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg></button>
      </div>
      <PSection title="Propriedades">
        <PRow label="Nome">
          <input value={shape.name || ''} onChange={(e) => onChange({ name: e.target.value })} placeholder="Nome" />
        </PRow>
      </PSection>
    </div>
  );
}

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

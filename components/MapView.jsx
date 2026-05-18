'use client';

// map-view.jsx — SVG-based loteamento map with Google Maps-inspired styling

import { useEffect, useMemo, useRef, useState } from 'react';

// Map theme tokens
export const MAP_THEMES = {
  claro: {
    bg: '#eef0e9',
    bgAlt: '#dfe4d8',
    road: '#ffffff',
    roadStroke: '#d4d8d0',
    roadLabel: '#5a6358',
    lotFill: '#f5f4ee',
    lotStroke: '#c9ccc0',
    lotLabel: '#5a5a52',
    waterFill: '#bcd6e4',
    waterStroke: '#9bb8c9',
    greenFill: '#cfd9bf',
    treeFill: '#7d9a5e',
    treeStroke: '#6a8650',
    pracaFill: '#c5d4b1',
    overlayText: '#2c2f29',
    gridLine: 'rgba(0,0,0,0.04)',
  },
  escuro: {
    bg: '#1a1f24',
    bgAlt: '#252b32',
    road: '#3a4148',
    roadStroke: '#2a3036',
    roadLabel: '#a9b2bb',
    lotFill: '#2a3138',
    lotStroke: '#3a424b',
    lotLabel: '#8a9099',
    waterFill: '#2c4c5e',
    waterStroke: '#3d6a82',
    greenFill: '#2e3a2c',
    treeFill: '#4a6440',
    treeStroke: '#3a5132',
    pracaFill: '#34402e',
    overlayText: '#e8ebef',
    gridLine: 'rgba(255,255,255,0.03)',
  },
  satelite: {
    bg: '#3d4a32',
    bgAlt: '#4a5840',
    road: '#cdc8a8',
    roadStroke: '#a8a380',
    roadLabel: '#ffffff',
    lotFill: '#6b7a4e',
    lotStroke: '#586740',
    lotLabel: '#f0ead0',
    waterFill: '#3c5c75',
    waterStroke: '#557a92',
    greenFill: '#384a2a',
    treeFill: '#2e4020',
    treeStroke: '#1f2d15',
    pracaFill: '#506434',
    overlayText: '#ffffff',
    gridLine: 'rgba(0,0,0,0.06)',
  },
};

export const STATUS_COLORS = {
  disponivel: { fill: '#10b981', stroke: '#059669', label: '#047857', glow: 'rgba(16, 185, 129, .35)' },
  reservado: { fill: '#f59e0b', stroke: '#d97706', label: '#b45309', glow: 'rgba(245, 158, 11, .35)' },
  vendido: { fill: '#ef4444', stroke: '#dc2626', label: '#b91c1c', glow: 'rgba(239, 68, 68, .3)' },
};

export function MapView({ loteamento, mapTheme = 'claro', onLotClick, selectedLotId, density }) {
  const T = MAP_THEMES[mapTheme] || MAP_THEMES.claro;
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [loteamento.id]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.min(3, Math.max(0.6, z + delta)));
  };

  const onMouseDown = (e) => {
    if (e.target.closest('.lot-poly')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  };

  const onMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const counts = useMemo(() => {
    const c = { disponivel: 0, reservado: 0, vendido: 0 };
    for (const l of loteamento.lots) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [loteamento]);

  const [vw, vh] = loteamento.viewBox.split(' ').slice(2).map(Number);

  return (
    <div className="map-wrap" style={{ background: T.bg }}>
      <div
        className="map-canvas"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          viewBox={loteamento.viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.18s ease-out',
          }}
        >
          {/* Background subtle grid for satellite feel */}
          {mapTheme === 'satelite' && (
            <defs>
              <pattern id="texGrid" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M0 0L14 0M0 0L0 14" stroke={T.gridLine} strokeWidth="0.5" />
              </pattern>
            </defs>
          )}
          {mapTheme === 'satelite' && <rect width={vw} height={vh} fill="url(#texGrid)" />}

          {/* Background areas (greens) */}
          <rect x="0" y="0" width={vw} height={vh} fill={T.bg} />
          {/* Soft inner area band */}
          <rect x="0" y="0" width={vw} height={vh} fill={T.greenFill} opacity="0.18" />

          <RoadSurface loteamento={loteamento} theme={T} />

          {/* Center dashed line on main roads */}
          {loteamento.roads?.filter(r => r.label).map((r, i) => {
            const isVertical = r.h > r.w;
            return (
              <line
                key={`dash-${i}`}
                x1={isVertical ? r.x + r.w/2 : r.x + 10}
                y1={isVertical ? r.y + 10 : r.y + r.h/2}
                x2={isVertical ? r.x + r.w/2 : r.x + r.w - 10}
                y2={isVertical ? r.y + r.h - 10 : r.y + r.h/2}
                stroke={T.roadStroke}
                strokeWidth="1"
                strokeDasharray="10 12"
              />
            );
          })}

          {/* Landmarks */}
          {loteamento.landmarks?.map((lm, i) => {
            if (lm.kind === 'praca') {
              return (
                <g key={`lm-${i}`}>
                  <rect
                    x={lm.x + 8}
                    y={lm.y + 8}
                    width={lm.w - 16}
                    height={lm.h - 16}
                    fill={T.pracaFill}
                    rx="4"
                  />
                  <text
                    x={lm.x + lm.w/2}
                    y={lm.y + lm.h/2 + 4}
                    fontSize="11"
                    textAnchor="middle"
                    fontFamily="Manrope"
                    fontWeight="600"
                    fill={T.roadLabel}
                  >
                    {lm.label}
                  </text>
                </g>
              );
            }
            if (lm.kind === 'lake') {
              return (
                <g key={`lm-${i}`}>
                  <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill={T.waterFill} stroke={T.waterStroke} strokeWidth="1.5" />
                  {/* Ripple */}
                  <ellipse cx={lm.cx - 30} cy={lm.cy - 20} rx={lm.rx*0.5} ry={lm.ry*0.4} fill="none" stroke={T.waterStroke} strokeWidth="0.8" opacity="0.4" />
                  <ellipse cx={lm.cx + 10} cy={lm.cy + 25} rx={lm.rx*0.3} ry={lm.ry*0.25} fill="none" stroke={T.waterStroke} strokeWidth="0.8" opacity="0.4" />
                  <text
                    x={lm.cx}
                    y={lm.cy + 6}
                    fontSize="16"
                    textAnchor="middle"
                    fontFamily="Manrope"
                    fontWeight="600"
                    fontStyle="italic"
                    fill={mapTheme === 'satelite' ? '#fff' : '#3d6680'}
                    opacity="0.85"
                  >
                    {lm.label}
                  </text>
                </g>
              );
            }
            if (lm.kind === 'green') {
              return <circle key={`lm-${i}`} cx={lm.cx} cy={lm.cy} r={lm.r} fill={T.greenFill} />;
            }
            if (lm.kind === 'gate') {
              return (
                <g key={`lm-${i}`}>
                  <rect x={lm.x} y={lm.y} width="50" height="40" fill={T.lotFill} stroke={T.lotStroke} strokeWidth="1.5" rx="2" />
                  <text x={lm.x + 25} y={lm.y + 60} fontSize="9" textAnchor="middle" fontFamily="Manrope" fontWeight="600" fill={T.roadLabel}>
                    {lm.label}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Trees */}
          {loteamento.trees?.map(([x, y], i) => (
            <g key={`t-${i}`}>
              <circle cx={x} cy={y+1} r="9" fill="rgba(0,0,0,0.12)" />
              <circle cx={x} cy={y} r="9" fill={T.treeFill} stroke={T.treeStroke} strokeWidth="0.8" />
            </g>
          ))}

          {/* Lots */}
          {loteamento.lots.map((lot) => {
            const s = STATUS_COLORS[lot.status];
            const isSel = selectedLotId === lot.id;
            return (
              <g key={lot.id} className="lot-group">
                <polygon
                  className="lot-poly"
                  points={lot.polygon}
                  fill={s.fill}
                  fillOpacity={isSel ? 0.65 : 0.42}
                  stroke={isSel ? s.stroke : T.lotStroke}
                  strokeWidth={isSel ? 3 : 1.2}
                  onClick={(e) => { e.stopPropagation(); onLotClick(lot); }}
                  style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s, stroke-width 0.15s' }}
                />
                {/* Lot number badge */}
                {density !== 'minimal' && (
                  <text
                    x={lot.center[0]}
                    y={lot.center[1] + 4}
                    fontSize="13"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono"
                    fontWeight="600"
                    fill={mapTheme === 'satelite' ? '#fff' : '#1a1f24'}
                    style={{ pointerEvents: 'none', textShadow: mapTheme === 'satelite' ? '0 1px 2px rgba(0,0,0,.5)' : 'none' }}
                  >
                    {lot.id}
                  </text>
                )}
              </g>
            );
          })}

          {/* Road labels — render last so they sit on top */}
          {loteamento.roads?.filter(r => r.label).map((r, i) => {
            const isVertical = r.h > r.w;
            const cx = r.x + r.w/2;
            const cy = r.y + r.h/2;
            return (
              <text
                key={`rl-${i}`}
                x={cx}
                y={cy + 4}
                fontSize="13"
                fontFamily="Manrope"
                fontWeight="500"
                fill={T.roadLabel}
                textAnchor="middle"
                transform={isVertical ? `rotate(-90 ${cx} ${cy})` : ''}
                letterSpacing="0.05em"
                style={{ pointerEvents: 'none' }}
              >
                {r.name?.toUpperCase()}
              </text>
            );
          })}
          {loteamento.curvedRoads?.filter(cr => cr.label).map((cr, i) => (
            <text key={`crl-${i}`} fontSize="13" fontFamily="Manrope" fontWeight="500" fill={T.roadLabel} letterSpacing="0.05em" style={{ pointerEvents: 'none' }}>
              <textPath href={`#crpath-${i}`} startOffset="50%" textAnchor="middle">{cr.name?.toUpperCase()}</textPath>
            </text>
          ))}
          <defs>
            {loteamento.curvedRoads?.map((cr, i) => (
              <path key={`pdef-${i}`} id={`crpath-${i}`} d={cr.d} fill="none" />
            ))}
          </defs>
        </svg>
      </div>

      {/* Map overlay UI */}
      <MapControls
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(3, z + 0.2))}
        onZoomOut={() => setZoom(z => Math.max(0.6, z - 0.2))}
        onReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        theme={T}
      />
      <MapLegend counts={counts} theme={T} />
      <MapInfoBadge loteamento={loteamento} theme={T} />
    </div>
  );
}

function MapControls({ zoom, onZoomIn, onZoomOut, onReset, theme }) {
  return (
    <div className="map-ctrls">
      <button className="map-btn" onClick={onZoomIn} aria-label="Aproximar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
      <div className="map-zoom-val">{Math.round(zoom * 100)}%</div>
      <button className="map-btn" onClick={onZoomOut} aria-label="Afastar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
      <button className="map-btn" onClick={onReset} aria-label="Centralizar" title="Centralizar">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function RoadSurface({ loteamento, theme }) {
  const rectRoadLine = (road) => {
    const horizontal = road.w >= road.h;
    if (horizontal) {
      const y = road.y + road.h / 2;
      return { x1: road.x, y1: y, x2: road.x + road.w, y2: y, width: road.h };
    }
    const x = road.x + road.w / 2;
    return { x1: x, y1: road.y, x2: x, y2: road.y + road.h, width: road.w };
  };

  const rectRoads = (loteamento.roads || []).filter((road) => road.kind === 'rect');
  const pathRoads = loteamento.curvedRoads || [];

  return (
    <g>
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line
              key={`road-border-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={theme.roadStroke}
              strokeWidth={line.width + 2}
              strokeLinecap="round"
            />
          );
        })}
        {pathRoads.map((road, i) => {
          const width = road.width || 60;
          return (
            <path
              key={`path-border-${i}`}
              d={road.d}
              fill="none"
              stroke={theme.roadStroke}
              strokeWidth={width + 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line
              key={`road-fill-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={theme.road}
              strokeWidth={line.width}
              strokeLinecap="round"
            />
          );
        })}
        {pathRoads.map((road, i) => (
          <path
            key={`path-fill-${i}`}
            d={road.d}
            fill="none"
            stroke={theme.road}
            strokeWidth={road.width || 60}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </g>
  );
}

function MapLegend({ counts, theme }) {
  return (
    <div className="map-legend">
      <div className="legend-title">LEGENDA</div>
      <div className="legend-row">
        <span className="legend-dot" style={{ background: STATUS_COLORS.disponivel.fill, boxShadow: `0 0 0 3px ${STATUS_COLORS.disponivel.glow}` }} />
        <span className="legend-lbl">Disponível</span>
        <span className="legend-num">{counts.disponivel}</span>
      </div>
      <div className="legend-row">
        <span className="legend-dot" style={{ background: STATUS_COLORS.reservado.fill, boxShadow: `0 0 0 3px ${STATUS_COLORS.reservado.glow}` }} />
        <span className="legend-lbl">Reservado</span>
        <span className="legend-num">{counts.reservado}</span>
      </div>
      <div className="legend-row">
        <span className="legend-dot" style={{ background: STATUS_COLORS.vendido.fill, boxShadow: `0 0 0 3px ${STATUS_COLORS.vendido.glow}` }} />
        <span className="legend-lbl">Vendido</span>
        <span className="legend-num">{counts.vendido}</span>
      </div>
    </div>
  );
}

function MapInfoBadge({ loteamento, theme }) {
  return (
    <div className="map-info-badge">
      <div className="mib-row">
        <span className="mib-k">Loteamento</span>
        <span className="mib-v">{loteamento.nome}</span>
      </div>
      <div className="mib-row">
        <span className="mib-k">Bairro</span>
        <span className="mib-v">{loteamento.bairro}, {loteamento.cidade}/{loteamento.estado}</span>
      </div>
      <div className="mib-row">
        <span className="mib-k">Fase</span>
        <span className="mib-v">{loteamento.fase}</span>
      </div>
    </div>
  );
}

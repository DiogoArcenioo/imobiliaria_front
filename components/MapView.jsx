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
  disponivel: { fill: '#b0b8c1', stroke: '#7a8490', label: '#555e66', glow: 'rgba(150,160,170,.4)' },
  reservado:  { fill: '#ffbb00', stroke: '#d49500', label: '#a06e00', glow: 'rgba(255,187,0,.45)'  },
  vendido:    { fill: '#e84040', stroke: '#be1a1a', label: '#961010', glow: 'rgba(220,40,40,.4)'   },
};

export function MapView({ loteamento, mapTheme = 'claro', onLotClick, selectedLotId, density, responsiveOverlays = false, showInfoOverlays = true }) {
  const T = MAP_THEMES[mapTheme] || MAP_THEMES.claro;
  const mapRootRef = useRef(null);
  const svgRef = useRef(null);
  const [compactOverlays, setCompactOverlays] = useState(Boolean(responsiveOverlays));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchMoved = useRef(false);
  const [filtros, setFiltros] = useState({ status: [], precoMin: '', precoMax: '', areaMin: '', areaMax: '', quadra: '' });
  const [showFiltros, setShowFiltros] = useState(false);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFiltros({ status: [], precoMin: '', precoMax: '', areaMin: '', areaMax: '', quadra: '' });
    setShowFiltros(false);
  }, [loteamento.id]);

  useEffect(() => {
    if (!responsiveOverlays || !mapRootRef.current) {
      setCompactOverlays(false);
      return undefined;
    }

    const update = () => setCompactOverlays(mapRootRef.current?.clientWidth <= 900);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(mapRootRef.current);
    return () => observer.disconnect();
  }, [responsiveOverlays]);

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

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touchMoved.current = false;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e) => {
    if (e.pointerType === 'mouse' || !isDragging) return;
    if (Math.abs(e.clientX - dragStart.current.x) > 5 || Math.abs(e.clientY - dragStart.current.y) > 5) {
      touchMoved.current = true;
    }
    setPan({
      x: dragStart.current.panX + e.clientX - dragStart.current.x,
      y: dragStart.current.panY + e.clientY - dragStart.current.y,
    });
  };

  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const quadras = useMemo(() => {
    const qs = [...new Set((loteamento.lots || []).map(l => l.quadra).filter(Boolean))];
    return qs.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [loteamento.lots]);

  const filteredLots = useMemo(() => {
    const { status, precoMin, precoMax, areaMin, areaMax, quadra } = filtros;
    return (loteamento.lots || []).filter(lot => {
      if (status.length > 0 && !status.includes(lot.status)) return false;
      const preco = Number(lot.preco) || 0;
      if (precoMin && preco < Number(precoMin)) return false;
      if (precoMax && preco > Number(precoMax)) return false;
      const area = Number(lot.area) || 0;
      if (areaMin && area < Number(areaMin)) return false;
      if (areaMax && area > Number(areaMax)) return false;
      if (quadra && String(lot.quadra) !== String(quadra)) return false;
      return true;
    });
  }, [loteamento.lots, filtros]);

  const filtroAtivos = useMemo(() => {
    let n = 0;
    if (filtros.status.length) n++;
    if (filtros.precoMin || filtros.precoMax) n++;
    if (filtros.areaMin || filtros.areaMax) n++;
    if (filtros.quadra) n++;
    return n;
  }, [filtros]);

  const counts = useMemo(() => {
    const c = { disponivel: 0, reservado: 0, vendido: 0 };
    for (const l of filteredLots) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [filteredLots]);

  const [vw, vh] = loteamento.viewBox.split(' ').slice(2).map(Number);

  return (
    <div ref={mapRootRef} className="map-wrap" style={{ background: T.bg }}>
      <div
        className="map-canvas"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
          <defs>
            <pattern id="mv-fundo" patternUnits="userSpaceOnUse" width="512" height="512">
              <image href="/textures/fundo.jpg" x="0" y="0" width="512" height="512" />
            </pattern>
            <pattern id="mv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0L0 0L0 20" fill="none" stroke="rgba(180,210,255,0.13)" strokeWidth="0.5"/>
            </pattern>
            <pattern id="mv-grid-big" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M100 0L0 0L0 100" fill="none" stroke="rgba(180,210,255,0.26)" strokeWidth="0.9"/>
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
            {mapTheme === 'satelite' && (
              <pattern id="texGrid" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M0 0L14 0M0 0L0 14" stroke={T.gridLine} strokeWidth="0.5" />
              </pattern>
            )}
          </defs>
          {/* Background */}
          {mapTheme === 'claro' ? (
            <>
              <rect x="0" y="0" width={vw} height={vh} fill="url(#mv-fundo)" />
              <rect x="0" y="0" width={vw} height={vh} fill="url(#mv-grid)" />
              <rect x="0" y="0" width={vw} height={vh} fill="url(#mv-grid-big)" />
            </>
          ) : (
            <>
              <rect x="0" y="0" width={vw} height={vh} fill={T.bg} />
              <rect x="0" y="0" width={vw} height={vh} fill={T.greenFill} opacity="0.18" />
              {mapTheme === 'satelite' && <rect width={vw} height={vh} fill="url(#texGrid)" />}
            </>
          )}

          <RoadSurface loteamento={loteamento} />

          {/* Landmarks */}
          {loteamento.landmarks?.map((lm, i) => {
            if (lm.kind === 'praca') {
              const labelColor = mapTheme === 'satelite' ? '#d4edba' : '#3d5230';
              if (lm.pracaShape === 'ellipse') {
                return (
                  <g key={`lm-${i}`}>
                    <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry}
                      fill="url(#park-texture)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
                    <text x={lm.cx} y={lm.cy + 4} fontSize="11" textAnchor="middle"
                      fontFamily="Manrope" fontWeight="600" fill={labelColor}>
                      {lm.label}
                    </text>
                  </g>
                );
              }
              if (lm.pracaShape === 'poly') {
                const d = lm.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
                const xs = lm.points.map(p => p[0]), ys = lm.points.map(p => p[1]);
                const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
                const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
                return (
                  <g key={`lm-${i}`}>
                    <path d={d} fill="url(#park-texture)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinejoin="round" />
                    <text x={cx} y={cy + 4} fontSize="11" textAnchor="middle"
                      fontFamily="Manrope" fontWeight="600" fill={labelColor}>
                      {lm.label}
                    </text>
                  </g>
                );
              }
              return (
                <g key={`lm-${i}`}>
                  <rect
                    x={lm.x + 8}
                    y={lm.y + 8}
                    width={lm.w - 16}
                    height={lm.h - 16}
                    fill="url(#park-texture)"
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth="1.2"
                    rx="4"
                  />
                  <text
                    x={lm.x + lm.w/2}
                    y={lm.y + lm.h/2 + 4}
                    fontSize="11"
                    textAnchor="middle"
                    fontFamily="Manrope"
                    fontWeight="600"
                    fill={labelColor}
                  >
                    {lm.label}
                  </text>
                </g>
              );
            }
            if (lm.kind === 'lake') {
              const E = 10;
              if (lm.lakeShape === 'rect') {
                const cx = lm.x + lm.w / 2, cy = lm.y + lm.h / 2;
                return (
                  <g key={`lm-${i}`}>
                    <rect x={lm.x - E} y={lm.y - E} width={lm.w + E*2} height={lm.h + E*2} fill="#9c7840" rx="8" />
                    <rect x={lm.x - E + 2} y={lm.y - E + 2} width={lm.w + E*2 - 4} height={lm.h + E*2 - 4}
                      fill="none" stroke="rgba(60,35,5,0.30)" strokeWidth="4" rx="7" />
                    <rect x={lm.x} y={lm.y} width={lm.w} height={lm.h} fill="url(#lake-texture)" rx="5" />
                    <rect x={lm.x} y={lm.y} width={lm.w} height={lm.h}
                      fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" rx="5" />
                    <text x={cx} y={cy + 6} fontSize="16" textAnchor="middle"
                      fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)">
                      {lm.label}
                    </text>
                  </g>
                );
              }
              if (lm.lakeShape === 'poly') {
                const pts = lm.points || [];
                const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
                const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
                const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                return (
                  <g key={`lm-${i}`}>
                    <path d={d} fill="#9c7840" stroke="#9c7840" strokeWidth={E * 2}
                      strokeLinejoin="round" paintOrder="stroke fill" />
                    <path d={d} fill="url(#lake-texture)" strokeLinejoin="round" />
                    <path d={d} fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" strokeLinejoin="round" />
                    <text x={cx} y={cy + 6} fontSize="16" textAnchor="middle"
                      fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)">
                      {lm.label}
                    </text>
                  </g>
                );
              }
              return (
                <g key={`lm-${i}`}>
                  <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx + E} ry={lm.ry + E} fill="#9c7840" />
                  <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx + E - 2} ry={lm.ry + E - 2}
                    fill="none" stroke="rgba(60,35,5,0.30)" strokeWidth="4" />
                  <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill="url(#lake-texture)" />
                  <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry}
                    fill="none" stroke="rgba(0,45,60,0.22)" strokeWidth="5" />
                  <text x={lm.cx} y={lm.cy + 6} fontSize="16" textAnchor="middle"
                    fontFamily="Manrope" fontWeight="600" fontStyle="italic" fill="rgba(255,255,255,0.75)">
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
          {loteamento.trees?.map((tree, i) => {
            const [x, y, treeType = 1] = tree;
            const TREE_CFG = {
              1: { href: '/textures/trees/tree_01.png', s: 60 },
              2: { href: '/textures/trees/tree_02.png', s: 90 },
              3: { href: '/textures/trees/tree_03.png', s: 65 },
              4: { href: '/textures/trees/tree_04.png', s: 85 },
              5: { href: '/textures/trees/tree_05.png', s: 75 },
            };
            const cfg = TREE_CFG[treeType] || TREE_CFG[1];
            const half = cfg.s / 2;
            return (
              <image key={`t-${i}`} href={cfg.href}
                x={x - half} y={y - half} width={cfg.s} height={cfg.s} />
            );
          })}

          {/* Lots */}
          {filteredLots.map((lot) => {
            const s = STATUS_COLORS[lot.status] || STATUS_COLORS.disponivel;
            const isSel = selectedLotId === lot.id;
            return (
              <g key={lot.id} className="lot-group">
                <polygon
                  className="lot-poly"
                  points={lot.polygon}
                  fill={s.fill}
                  fillOpacity={isSel ? 0.82 : 0.62}
                  stroke={isSel ? s.stroke : T.lotStroke}
                  strokeWidth={isSel ? 3 : 1.2}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (touchMoved.current) {
                      touchMoved.current = false;
                      return;
                    }
                    onLotClick(lot);
                  }}
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
      {!compactOverlays && <MapControls
          zoom={zoom}
          onZoomIn={() => setZoom(z => Math.min(3, z + 0.2))}
          onZoomOut={() => setZoom(z => Math.max(0.6, z - 0.2))}
          onReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          theme={T}
          onToggleFiltros={() => setShowFiltros(f => !f)}
          filtroAtivos={filtroAtivos}
          showFiltros={showFiltros}
        />}
      {!compactOverlays && showFiltros && (
        <MapFilters
          filtros={filtros}
          setFiltros={setFiltros}
          quadras={quadras}
          onClose={() => setShowFiltros(false)}
        />
      )}
      {showInfoOverlays && !compactOverlays && <MapLegend counts={counts} theme={T} />}
      {showInfoOverlays && !compactOverlays && <MapInfoBadge loteamento={loteamento} theme={T} />}
    </div>
  );
}

function MapControls({ zoom, onZoomIn, onZoomOut, onReset, theme, onToggleFiltros, filtroAtivos, showFiltros }) {
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
      <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.12)', margin: '0 2px' }} />
      <button
        className="map-btn"
        onClick={onToggleFiltros}
        aria-label="Filtros"
        title="Filtros"
        style={{ position: 'relative', ...(showFiltros || filtroAtivos > 0 ? { background: '#2563eb', color: '#fff' } : {}) }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {filtroAtivos > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 14, height: 14, fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {filtroAtivos}
          </span>
        )}
      </button>
    </div>
  );
}

function MapFilters({ filtros, setFiltros, quadras, onClose }) {
  const STATUS_OPTIONS = [
    { key: 'disponivel', label: 'Disponível', color: STATUS_COLORS.disponivel.fill },
    { key: 'reservado',  label: 'Reservado',  color: STATUS_COLORS.reservado.fill  },
    { key: 'vendido',    label: 'Vendido',    color: STATUS_COLORS.vendido.fill    },
  ];

  const toggleStatus = (s) =>
    setFiltros(f => ({
      ...f,
      status: f.status.includes(s) ? f.status.filter(x => x !== s) : [...f.status, s],
    }));

  const reset = () => setFiltros({ status: [], precoMin: '', precoMax: '', areaMin: '', areaMax: '', quadra: '' });

  const inputStyle = { flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.75rem', width: '100%', boxSizing: 'border-box' };
  const sectionLabel = { fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block' };

  return (
    <div className="map-filters" style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
      border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,.13)', width: 230,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.07em' }}>Filtros</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={reset} style={{ fontSize: '0.7rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>Limpar</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 12 }}>
        <span style={sectionLabel}>Status</span>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(({ key, label, color }) => {
            const active = filtros.status.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleStatus(key)}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                  cursor: 'pointer', border: `1.5px solid ${color}`,
                  background: active ? color : 'transparent',
                  color: active ? '#fff' : '#374151',
                  transition: 'all .12s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price range */}
      <div style={{ marginBottom: 12 }}>
        <span style={sectionLabel}>Preço (R$)</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" placeholder="Mín" value={filtros.precoMin}
            onChange={e => setFiltros(f => ({ ...f, precoMin: e.target.value }))}
            style={inputStyle} />
          <span style={{ color: '#9ca3af', fontSize: '0.75rem', flexShrink: 0 }}>—</span>
          <input type="number" placeholder="Máx" value={filtros.precoMax}
            onChange={e => setFiltros(f => ({ ...f, precoMax: e.target.value }))}
            style={inputStyle} />
        </div>
      </div>

      {/* Area range */}
      <div style={{ marginBottom: quadras.length > 0 ? 12 : 0 }}>
        <span style={sectionLabel}>Área (m²)</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" placeholder="Mín" value={filtros.areaMin}
            onChange={e => setFiltros(f => ({ ...f, areaMin: e.target.value }))}
            style={inputStyle} />
          <span style={{ color: '#9ca3af', fontSize: '0.75rem', flexShrink: 0 }}>—</span>
          <input type="number" placeholder="Máx" value={filtros.areaMax}
            onChange={e => setFiltros(f => ({ ...f, areaMax: e.target.value }))}
            style={inputStyle} />
        </div>
      </div>

      {/* Quadra */}
      {quadras.length > 0 && (
        <div>
          <span style={sectionLabel}>Quadra</span>
          <select
            value={filtros.quadra}
            onChange={e => setFiltros(f => ({ ...f, quadra: e.target.value }))}
            style={{ ...inputStyle, flex: 'none', background: '#fff', cursor: 'pointer' }}
          >
            <option value="">Todas</option>
            {quadras.map(q => <option key={q} value={q}>Quadra {q}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function RoadSurface({ loteamento }) {
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
      {/* Sidewalk outer edge */}
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line key={`road-sw-edge-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#aaa79d" strokeWidth={line.width + 4} strokeLinecap="round" opacity={0.45} />
          );
        })}
        {pathRoads.map((road, i) => (
          <path key={`path-sw-edge-${i}`} d={road.d} fill="none"
            stroke="#aaa79d" strokeWidth={(road.width || 60) + 4}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
        ))}
      </g>
      {/* Sidewalk texture */}
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line key={`road-sw-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="url(#road-sidewalk)" strokeWidth={line.width + 2} strokeLinecap="round" />
          );
        })}
        {pathRoads.map((road, i) => (
          <path key={`path-sw-${i}`} d={road.d} fill="none"
            stroke="url(#road-sidewalk)" strokeWidth={(road.width || 60) + 2}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </g>
      {/* Asphalt texture */}
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line key={`road-asph-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="url(#road-asphalt)" strokeWidth={Math.round(line.width * 0.72)} strokeLinecap="round" />
          );
        })}
        {pathRoads.map((road, i) => (
          <path key={`path-asph-${i}`} d={road.d} fill="none"
            stroke="url(#road-asphalt)" strokeWidth={Math.round((road.width || 60) * 0.72)}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </g>
      {/* Center dashed lines */}
      <g>
        {rectRoads.map((road, i) => {
          const line = rectRoadLine(road);
          return (
            <line key={`road-dash-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#f2e8b8" strokeWidth="2" strokeDasharray="25 20"
              strokeLinecap="round" opacity={0.75} />
          );
        })}
        {pathRoads.map((road, i) => (
          <path key={`path-dash-${i}`} d={road.d} fill="none"
            stroke="#f2e8b8" strokeWidth="2" strokeDasharray="25 20"
            strokeLinecap="round" opacity={0.75} />
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
        <span className="legend-dot" style={{ background: STATUS_COLORS.disponivel.fill, opacity: 0.85, boxShadow: `0 0 0 3px ${STATUS_COLORS.disponivel.glow}` }} />
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

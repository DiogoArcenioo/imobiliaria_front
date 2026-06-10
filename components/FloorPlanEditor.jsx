'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GRID = 20;
const AP_COLORS = {
  disponivel: '#22c55e',
  reservado: '#f59e0b',
  vendido: '#ef4444',
  alugado: '#8b5cf6',
};
const CANVAS_W = 800;
const CANVAS_H = 560;

function snapToGrid(v) {
  return Math.round(v / GRID) * GRID;
}

function rectToPolygon(x, y, w, h) {
  return `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
}

function polygonToPoints(poly) {
  return poly.trim().split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

function centroid(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return [cx, cy];
}

function generateApId(andarNum, idx) {
  return `${andarNum}${String(idx + 1).padStart(2, '0')}`;
}

/**
 * FloorPlanEditor
 * Editor de planta baixa de um andar — permite desenhar apartamentos (retângulos).
 *
 * Props:
 *   andar       – objeto andar { numero, editor_shapes, apartamentos[] }
 *   predio      – objeto prédio (para contexto)
 *   onSave(shapes, apartamentos) – callback ao salvar
 *   onClose     – fechar o editor
 *   readOnly    – modo visualização sem edição
 *   onSelectAp  – ao clicar num apartamento existente (modo view)
 */
export function FloorPlanEditor({ andar, predio, onSave, onClose, readOnly = false, onSelectAp }) {
  const svgRef = useRef(null);
  const [shapes, setShapes] = useState(() => andar?.editor_shapes ?? []);
  const [drawing, setDrawing] = useState(null); // { x, y, w, h }
  const [selected, setSelected] = useState(null); // índice shape selecionado
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const [tool, setTool] = useState('draw'); // 'draw' | 'select' | 'pan'

  // Diálogo de propriedades ao criar/editar ap
  const [apDialog, setApDialog] = useState(null); // { shapeIdx, ap }

  const [saving, setSaving] = useState(false);

  // Inicializa shapes do andar ao mudar de andar
  useEffect(() => {
    setShapes(andar?.editor_shapes ?? []);
    setSelected(null);
    setDrawing(null);
  }, [andar?.id]);

  const toSVG = (clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: snapToGrid((clientX - rect.left - pan.x) / zoom),
      y: snapToGrid((clientY - rect.top - pan.y) / zoom),
    };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (tool === 'pan') {
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    if (tool === 'draw') {
      const p = toSVG(e.clientX, e.clientY);
      setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
      return;
    }
    if (drawing && tool === 'draw') {
      const p = toSVG(e.clientX, e.clientY);
      setDrawing((d) => ({ ...d, w: p.x - d.x, h: p.y - d.y }));
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    if (drawing && tool === 'draw') {
      const w = Math.abs(drawing.w);
      const h = Math.abs(drawing.h);
      if (w < GRID || h < GRID) {
        setDrawing(null);
        return;
      }
      const x = drawing.w < 0 ? drawing.x + drawing.w : drawing.x;
      const y = drawing.h < 0 ? drawing.y + drawing.h : drawing.y;
      const polygon = rectToPolygon(x, y, w, h);
      const pts = polygonToPoints(polygon);
      const [cx, cy] = centroid(pts);
      const idx = shapes.length;
      const newShape = {
        id: `ap-${Date.now()}`,
        type: 'apartment',
        x, y, w, h,
        polygon,
        center: [cx, cy],
        ap_id: generateApId(andar?.numero ?? 1, idx),
        area: Number(((w / GRID) * (h / GRID)).toFixed(1)),
        quartos: 2,
        banheiros: 1,
        preco_venda: null,
        preco_aluguel: null,
        tipo: 'venda',
        status: 'disponivel',
      };
      setDrawing(null);
      setShapes((s) => [...s, newShape]);
      setApDialog({ shapeIdx: idx, ap: { ...newShape } });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.5, z - e.deltaY * 0.001)));
  };

  const handleShapeClick = (e, idx) => {
    e.stopPropagation();
    if (readOnly) {
      onSelectAp?.(shapes[idx]);
      return;
    }
    if (tool === 'select') {
      setSelected(idx);
      setApDialog({ shapeIdx: idx, ap: { ...shapes[idx] } });
    }
  };

  const deleteSelected = () => {
    if (selected === null) return;
    setShapes((s) => s.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(shapes, shapes.map((s) => ({
      ap_id: s.ap_id,
      polygon: s.polygon,
      center: s.center,
      area: s.area,
      quartos: s.quartos,
      banheiros: s.banheiros,
      preco_venda: s.preco_venda || null,
      preco_aluguel: s.preco_aluguel || null,
      tipo: s.tipo,
      status: s.status,
      shape_data: { x: s.x, y: s.y, w: s.w, h: s.h },
    })));
    setSaving(false);
  };

  const confirmApDialog = () => {
    if (!apDialog) return;
    setShapes((s) =>
      s.map((sh, i) => (i === apDialog.shapeIdx ? { ...sh, ...apDialog.ap } : sh)),
    );
    setApDialog(null);
  };

  const drawRect = drawing
    ? {
        x: drawing.w < 0 ? drawing.x + drawing.w : drawing.x,
        y: drawing.h < 0 ? drawing.y + drawing.h : drawing.y,
        w: Math.abs(drawing.w),
        h: Math.abs(drawing.h),
      }
    : null;

  return (
    <div className="fpe-container">
      {/* Toolbar — oculto em readOnly (o pai já provê navegação) */}
      {!readOnly && (
        <div className="fpe-toolbar">
          <div className="fpe-title">
            {andar?.numero}° Andar — {predio?.nome}
          </div>
          <div className="fpe-tools">
            <button
              className={`fpe-tool${tool === 'draw' ? ' active' : ''}`}
              onClick={() => setTool('draw')}
              title="Desenhar apartamento"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              Desenhar
            </button>
            <button
              className={`fpe-tool${tool === 'select' ? ' active' : ''}`}
              onClick={() => setTool('select')}
              title="Selecionar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2l5 12 2-5 5-2L2 2z" />
              </svg>
              Selecionar
            </button>
            <button
              className={`fpe-tool${tool === 'pan' ? ' active' : ''}`}
              onClick={() => setTool('pan')}
              title="Mover"
            >
              ✥ Mover
            </button>
            {selected !== null && (
              <button className="fpe-tool danger" onClick={deleteSelected}>
                Excluir
              </button>
            )}
          </div>
          <div className="fpe-actions">
            <span className="fpe-info">
              {shapes.length} ap{shapes.length !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Andar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Legenda de status */}
      <div className="fpe-legend">
        {Object.entries(AP_COLORS).map(([s, c]) => (
          <span key={s} className="fpe-leg-item">
            <span className="fpe-leg-dot" style={{ background: c }} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {/* Canvas SVG */}
      <div
        className="fpe-canvas-wrap"
        style={{ cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : tool === 'draw' ? 'crosshair' : 'default' }}
      >
        <svg
          ref={svgRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Grid de fundo */}
            <defs>
              <pattern id="fpe-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect
              x={-pan.x / zoom}
              y={-pan.y / zoom}
              width={CANVAS_W / zoom}
              height={CANVAS_H / zoom}
              fill="url(#fpe-grid)"
            />

            {/* Apartamentos existentes */}
            {shapes.map((sh, idx) => {
              const isSelected = selected === idx;
              const fill = AP_COLORS[sh.status] || '#22c55e';
              return (
                <g
                  key={sh.id || idx}
                  onClick={(e) => handleShapeClick(e, idx)}
                  style={{ cursor: readOnly ? 'pointer' : tool === 'select' ? 'pointer' : 'default' }}
                >
                  <polygon
                    points={sh.polygon}
                    fill={fill}
                    fillOpacity={isSelected ? 0.85 : 0.55}
                    stroke={isSelected ? '#1e293b' : fill}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={sh.center?.[0]}
                    y={(sh.center?.[1] ?? 0) - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="bold"
                    fill="#1e293b"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {sh.ap_id}
                  </text>
                  {sh.area > 0 && (
                    <text
                      x={sh.center?.[0]}
                      y={(sh.center?.[1] ?? 0) + 8}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#475569"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {sh.area}m²
                    </text>
                  )}
                </g>
              );
            })}

            {/* Retângulo em curso */}
            {drawRect && drawRect.w > 0 && drawRect.h > 0 && (
              <rect
                x={drawRect.x}
                y={drawRect.y}
                width={drawRect.w}
                height={drawRect.h}
                fill="#3288e0"
                fillOpacity={0.25}
                stroke="#3288e0"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
          </g>
        </svg>
      </div>

      {/* Diálogo de propriedades do ap */}
      {apDialog && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setApDialog(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 className="modal-title">Apartamento {apDialog.ap.ap_id}</h3>
            <div className="modal-body">
              <div className="field-row">
                <label className="field-label">
                  Número / ID
                  <input
                    className="field-input"
                    value={apDialog.ap.ap_id}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, ap_id: e.target.value } }))}
                  />
                </label>
                <label className="field-label">
                  Área (m²)
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    value={apDialog.ap.area ?? ''}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, area: Number(e.target.value) } }))}
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field-label">
                  Quartos
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    value={apDialog.ap.quartos ?? ''}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, quartos: Number(e.target.value) } }))}
                  />
                </label>
                <label className="field-label">
                  Banheiros
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    value={apDialog.ap.banheiros ?? ''}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, banheiros: Number(e.target.value) } }))}
                  />
                </label>
              </div>

              <label className="field-label">
                Tipo
                <select
                  className="field-input"
                  value={apDialog.ap.tipo}
                  onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, tipo: e.target.value } }))}
                >
                  <option value="venda">Venda</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="ambos">Venda e Aluguel</option>
                </select>
              </label>

              {(apDialog.ap.tipo === 'venda' || apDialog.ap.tipo === 'ambos') && (
                <label className="field-label">
                  Preço de Venda (R$)
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="1000"
                    value={apDialog.ap.preco_venda ?? ''}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, preco_venda: Number(e.target.value) || null } }))}
                    placeholder="0,00"
                  />
                </label>
              )}

              {(apDialog.ap.tipo === 'aluguel' || apDialog.ap.tipo === 'ambos') && (
                <label className="field-label">
                  Aluguel Mensal (R$)
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="100"
                    value={apDialog.ap.preco_aluguel ?? ''}
                    onChange={(e) => setApDialog((d) => ({ ...d, ap: { ...d.ap, preco_aluguel: Number(e.target.value) || null } }))}
                    placeholder="0,00"
                  />
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setApDialog(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmApDialog}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

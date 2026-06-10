'use client';

import { useRef, useState } from 'react';
import { Building3DView } from './Building3DView';

const STEP_INFO = 0;
const STEP_FOOTPRINT = 1;
const STEP_LAYOUT = 2;
const STEP_DONE = 3;

// Canvas de desenho do tamanho do prédio
// Escala: 4px = 1m | Snap: 5m (20px) | Grid: 10m (40px)
const SCALE = 4;
const SNAP_PX = 20;
const CANVAS_W = 480;
const CANVAS_H = 320;
const GRID_PX = 40;

function snapVal(v) {
  return Math.round(v / SNAP_PX) * SNAP_PX;
}

function FootprintCanvas({ largura, profundidade, onChange }) {
  const svgRef = useRef(null);
  const [drawing, setDrawing] = useState(null); // { x1, y1, x2, y2 }
  const [shape, setShape] = useState(() =>
    largura && profundidade
      ? { x: SNAP_PX, y: SNAP_PX, w: largura * SCALE, h: profundidade * SCALE }
      : null
  );

  const getPos = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = Math.max(0, Math.min(CANVAS_W, snapVal((e.clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(CANVAS_H, snapVal((e.clientY - rect.top) * scaleY)));
    return { x, y };
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const pos = getPos(e);
    setDrawing({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    setShape(null);
    onChange(0, 0);
  };

  const onMouseMove = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    setDrawing((d) => ({ ...d, x2: pos.x, y2: pos.y }));
  };

  const finalize = (e) => {
    if (!drawing) return;
    const w = Math.abs(drawing.x2 - drawing.x1);
    const h = Math.abs(drawing.y2 - drawing.y1);
    if (w >= SNAP_PX && h >= SNAP_PX) {
      const x = Math.min(drawing.x1, drawing.x2);
      const y = Math.min(drawing.y1, drawing.y2);
      setShape({ x, y, w, h });
      onChange(Math.round(w / SCALE), Math.round(h / SCALE));
    }
    setDrawing(null);
  };

  const activeRect = drawing
    ? {
        x: Math.min(drawing.x1, drawing.x2),
        y: Math.min(drawing.y1, drawing.y2),
        w: Math.abs(drawing.x2 - drawing.x1),
        h: Math.abs(drawing.y2 - drawing.y1),
      }
    : shape;

  const wm = activeRect ? Math.round(activeRect.w / SCALE) : 0;
  const hm = activeRect ? Math.round(activeRect.h / SCALE) : 0;

  // Grid lines
  const gridLines = [];
  for (let x = 0; x <= CANVAS_W; x += GRID_PX) {
    gridLines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_H}
        stroke={x % (GRID_PX * 2) === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth="1" />
    );
  }
  for (let y = 0; y <= CANVAS_H; y += GRID_PX) {
    gridLines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={CANVAS_W} y2={y}
        stroke={y % (GRID_PX * 2) === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth="1" />
    );
  }

  // Scale labels (every 20m)
  const scaleLabels = [];
  for (let x = GRID_PX * 2; x < CANVAS_W; x += GRID_PX * 2) {
    scaleLabels.push(
      <text key={`lx${x}`} x={x} y={CANVAS_H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
        {x / SCALE}m
      </text>
    );
  }
  for (let y = GRID_PX * 2; y < CANVAS_H; y += GRID_PX * 2) {
    scaleLabels.push(
      <text key={`ly${y}`} x={6} y={y} textAnchor="middle" fontSize={9} fill="#94a3b8" dominantBaseline="middle">
        {y / SCALE}m
      </text>
    );
  }

  return (
    <div className="fp-canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', maxWidth: '100%', cursor: 'crosshair', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={finalize}
        onMouseLeave={finalize}
      >
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#f8fafc" />
        {gridLines}
        {scaleLabels}

        {activeRect && activeRect.w > 0 && activeRect.h > 0 && (
          <g>
            <rect
              x={activeRect.x}
              y={activeRect.y}
              width={activeRect.w}
              height={activeRect.h}
              fill="rgba(50,136,224,0.15)"
              stroke="#3288e0"
              strokeWidth="2"
              strokeDasharray={drawing ? '6 3' : 'none'}
            />
            {/* Dimensão horizontal */}
            <text
              x={activeRect.x + activeRect.w / 2}
              y={activeRect.y - 6}
              textAnchor="middle"
              fontSize={12}
              fontWeight="700"
              fill="#3288e0"
            >
              {wm}m
            </text>
            {/* Dimensão vertical */}
            <text
              x={activeRect.x + activeRect.w + 6}
              y={activeRect.y + activeRect.h / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight="700"
              fill="#3288e0"
            >
              {hm}m
            </text>
            {/* Label central */}
            {!drawing && wm > 0 && hm > 0 && (
              <text
                x={activeRect.x + activeRect.w / 2}
                y={activeRect.y + activeRect.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={13}
                fontWeight="800"
                fill="#1e40af"
              >
                {wm} × {hm}m
              </text>
            )}
          </g>
        )}
      </svg>
      <p className="fp-canvas-hint">
        Clique e arraste para definir o tamanho do prédio. Cada célula = 10m × 10m. Snap: 5m.
      </p>
    </div>
  );
}

export function PredioWizard({ onConfirm, onCancel }) {
  const [step, setStep] = useState(STEP_INFO);

  const [nome, setNome] = useState('');
  const [numAndares, setNumAndares] = useState(4);
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cor, setCor] = useState('#3288e0');

  const [largura, setLargura] = useState(0);   // metros
  const [profundidade, setProfundidade] = useState(0); // metros

  const [andaresIguais, setAndaresIguais] = useState(true);
  const [error, setError] = useState('');

  const cols = Math.max(1, Math.round(largura / 5));
  const rows = Math.max(1, Math.round(profundidade / 5));

  const previewPredio = {
    nome,
    num_andares: numAndares,
    footprint_cols: cols,
    footprint_rows: rows,
    cor,
    andares: Array.from({ length: numAndares }, (_, i) => ({
      numero: i + 1,
      stats: { total: 0, disponivel: 0, reservado: 0, vendido: 0, alugado: 0 },
    })),
  };

  function handleNext() {
    setError('');
    if (step === STEP_INFO) {
      if (!nome.trim()) return setError('Informe o nome do prédio.');
      if (numAndares < 1 || numAndares > 50) return setError('Número de andares deve ser entre 1 e 50.');
    }
    if (step === STEP_FOOTPRINT) {
      if (largura < 5 || profundidade < 5) return setError('Desenhe o tamanho do prédio no canvas.');
    }
    if (step < STEP_DONE) setStep(step + 1);
  }

  function handleBack() {
    setError('');
    if (step > 0) setStep(step - 1);
  }

  function handleConfirm() {
    onConfirm?.({
      nome: nome.trim(),
      num_andares: numAndares,
      footprint_cols: cols,
      footprint_rows: rows,
      andares_iguais: andaresIguais,
      bairro: bairro.trim() || undefined,
      cidade: cidade.trim() || undefined,
      estado: estado.trim() || undefined,
      cor,
    });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="modal-box wizard-box">
        {/* Steps indicator */}
        <div className="wizard-steps">
          {['Informações', 'Tamanho', 'Layout', 'Confirmar'].map((label, i) => (
            <div key={i} className={`wstep${i === step ? ' active' : i < step ? ' done' : ''}`}>
              <div className="wstep-num">{i + 1}</div>
              <div className="wstep-lbl">{label}</div>
            </div>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="wizard-content">

          {/* STEP 1 — Informações */}
          {step === STEP_INFO && (
            <div className="wizard-panel">
              <div>
                <h2 className="wizard-title">Novo Prédio</h2>
                <p className="wizard-sub">Defina as informações básicas do prédio.</p>
              </div>

              <label className="field-label">
                Nome do Prédio *
                <input
                  className="field-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Residencial Aurora"
                  autoFocus
                />
              </label>

              <label className="field-label">
                Número de Andares *
                <div className="andar-picker">
                  <button type="button" className="andar-btn" onClick={() => setNumAndares((v) => Math.max(1, v - 1))}>−</button>
                  <span className="andar-val">{numAndares}</span>
                  <button type="button" className="andar-btn" onClick={() => setNumAndares((v) => Math.min(50, v + 1))}>+</button>
                </div>
              </label>

              <div className="wizard-preview">
                <Building3DView predio={previewPredio} />
              </div>

              <div className="field-row">
                <label className="field-label">
                  Bairro
                  <input className="field-input" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
                </label>
                <label className="field-label">
                  Cidade
                  <input className="field-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
                </label>
                <label className="field-label" style={{ maxWidth: 80 }}>
                  UF
                  <input
                    className="field-input"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value.slice(0, 2).toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                  />
                </label>
              </div>

              <label className="field-label">
                Cor do Prédio
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: 13, color: '#64748b' }}>{cor}</span>
                </div>
              </label>
            </div>
          )}

          {/* STEP 2 — Tamanho */}
          {step === STEP_FOOTPRINT && (
            <div className="wizard-panel">
              <div>
                <h2 className="wizard-title">Tamanho do Prédio</h2>
                <p className="wizard-sub">
                  Clique e arraste no canvas para desenhar o contorno do prédio. As dimensões aparecem em tempo real.
                </p>
              </div>

              <FootprintCanvas
                largura={largura}
                profundidade={profundidade}
                onChange={(w, h) => { setLargura(w); setProfundidade(h); }}
              />

              {largura > 0 && profundidade > 0 && (
                <div className="fp-result">
                  <span className="fp-result-label">Dimensões:</span>
                  <strong>{largura} × {profundidade}m</strong>
                  <span className="fp-result-label" style={{ marginLeft: 16 }}>Grade interna:</span>
                  <strong>{cols} × {rows} células</strong>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Layout */}
          {step === STEP_LAYOUT && (
            <div className="wizard-panel">
              <div>
                <h2 className="wizard-title">Layout dos Andares</h2>
                <p className="wizard-sub">
                  Os andares terão o mesmo layout ou você quer criar cada um individualmente?
                </p>
              </div>

              <div className="layout-options">
                <button
                  type="button"
                  className={`layout-opt${andaresIguais ? ' selected' : ''}`}
                  onClick={() => setAndaresIguais(true)}
                >
                  <div className="lo-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      {[0, 1, 2].map((i) => (
                        <rect key={i} x="6" y={8 + i * 13} width="36" height="10" rx="2"
                          fill={andaresIguais ? '#3288e0' : '#cbd5e1'} />
                      ))}
                    </svg>
                  </div>
                  <div className="lo-label">Todos os andares iguais</div>
                  <div className="lo-desc">
                    Crie o layout do 1° andar e ele é replicado para todos os outros automaticamente.
                  </div>
                </button>

                <button
                  type="button"
                  className={`layout-opt${!andaresIguais ? ' selected' : ''}`}
                  onClick={() => setAndaresIguais(false)}
                >
                  <div className="lo-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="6" y="8" width="36" height="10" rx="2" fill={!andaresIguais ? '#3288e0' : '#cbd5e1'} />
                      <rect x="6" y="21" width="22" height="10" rx="2" fill={!andaresIguais ? '#f59e0b' : '#cbd5e1'} />
                      <rect x="30" y="21" width="12" height="10" rx="2" fill={!andaresIguais ? '#22c55e' : '#cbd5e1'} />
                      <rect x="6" y="34" width="36" height="10" rx="2" fill={!andaresIguais ? '#ef4444' : '#cbd5e1'} />
                    </svg>
                  </div>
                  <div className="lo-label">Criar andar por andar</div>
                  <div className="lo-desc">
                    Defina o layout de cada andar individualmente — útil para térreo comercial, coberturas, etc.
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Confirmar */}
          {step === STEP_DONE && (
            <div className="wizard-panel">
              <div>
                <h2 className="wizard-title">Tudo pronto!</h2>
                <p className="wizard-sub">Confirme os dados antes de criar o prédio.</p>
              </div>

              <div className="confirm-summary">
                <div className="cs-row"><span>Nome:</span><strong>{nome}</strong></div>
                <div className="cs-row"><span>Andares:</span><strong>{numAndares}</strong></div>
                <div className="cs-row"><span>Dimensões:</span><strong>{largura} × {profundidade}m</strong></div>
                <div className="cs-row"><span>Layout:</span><strong>{andaresIguais ? 'Todos iguais' : 'Andar por andar'}</strong></div>
                {cidade && (
                  <div className="cs-row">
                    <span>Cidade:</span>
                    <strong>{cidade}{estado ? ` / ${estado}` : ''}</strong>
                  </div>
                )}
              </div>

              <div className="wizard-preview">
                <Building3DView predio={previewPredio} />
              </div>
            </div>
          )}
        </div>

        {error && <div className="wizard-error">{error}</div>}

        {/* Footer */}
        <div className="wizard-footer">
          <button type="button" className="table-action table-action-ghost" onClick={step === 0 ? onCancel : handleBack}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < STEP_DONE ? (
            <button type="button" className="table-action" onClick={handleNext}>
              Continuar
            </button>
          ) : (
            <button type="button" className="table-action" onClick={handleConfirm}>
              Criar Prédio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

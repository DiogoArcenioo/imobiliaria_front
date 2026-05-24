"use client";

import { useRef, useState } from "react";
import { gerarLoteamentoIA } from "../lib/api";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const MAX_SIZE_MB = 15;

export function AiLoteamentoGenerator({ onGenerate, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Apenas imagens são suportadas (JPEG, PNG, WebP).");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`A imagem deve ter no máximo ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError("");
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function handleInputChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function handleGenerate() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const result = await gerarLoteamentoIA(file);
      if (!result?.shapes?.length) {
        setError("A IA não identificou elementos no loteamento. Tente com uma imagem mais clara.");
        return;
      }
      onGenerate(result.shapes);
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao processar imagem com IA.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="ai-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ai-modal">
        <div className="ai-modal-head">
          <div>
            <h2 className="ai-modal-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "middle", marginRight: 6 }}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Gerar loteamento com IA
            </h2>
            <p className="ai-modal-sub">
              Faça upload de uma imagem aérea, satélite ou mapa do terreno. A IA identificará os lotes, ruas e áreas verdes automaticamente.
            </p>
          </div>
          <button className="ai-modal-close" onClick={onClose} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div
          className={"ai-dropzone" + (dragOver ? " ai-dropzone-active" : "") + (preview ? " ai-dropzone-filled" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !preview && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            style={{ display: "none" }}
            onChange={handleInputChange}
          />

          {preview ? (
            <div className="ai-preview-wrap">
              <img src={preview} alt="Preview" className="ai-preview-img" />
              <div className="ai-preview-info">
                <span className="ai-preview-name">{file.name}</span>
                <span className="ai-preview-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button className="ai-preview-remove" onClick={(e) => { e.stopPropagation(); handleReset(); }} disabled={loading}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Remover
              </button>
            </div>
          ) : (
            <div className="ai-dropzone-empty">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="4" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                <path d="M20 14v12M14 20l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="ai-dropzone-label">Arraste uma imagem ou <span>clique para selecionar</span></p>
              <p className="ai-dropzone-hint">JPEG, PNG ou WebP · Máximo {MAX_SIZE_MB} MB</p>
            </div>
          )}
        </div>

        {error && <div className="ai-error">{error}</div>}

        <div className="ai-modal-tips">
          <b>Dicas para melhor resultado:</b>
          <ul>
            <li>Imagens aéreas ou de satélite com divisões visíveis de lotes funcionam melhor</li>
            <li>Certifique-se que o loteamento esteja centralizado na imagem</li>
            <li>Após a geração, revise e ajuste cada lote no editor</li>
          </ul>
        </div>

        <div className="ai-modal-foot">
          <button className="ed-tbtn" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="ed-tbtn ed-tbtn-primary"
            onClick={handleGenerate}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 10"/>
                </svg>
                Analisando imagem...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Gerar loteamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

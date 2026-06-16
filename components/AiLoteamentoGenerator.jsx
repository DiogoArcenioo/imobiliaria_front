"use client";

import { useRef, useState } from "react";
import { gerarLoteamentoIA } from "../lib/api";

const ACCEPTED_TYPES = "application/pdf,image/jpeg,image/png,image/webp,image/gif";
const MAX_SIZE_MB = 32;

function isPdf(f) {
  return f?.type === "application/pdf";
}

export function AiLoteamentoGenerator({ onGenerate, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    const allowed = f.type.startsWith("image/") || f.type === "application/pdf";
    if (!allowed) {
      setError("Apenas PDF ou imagens são suportados (JPEG, PNG, WebP).");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`O arquivo deve ter no máximo ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError("");
    setFile(f);
    if (isPdf(f)) {
      setPreview(null);
    } else {
      setPreview(URL.createObjectURL(f));
    }
  }

  function handleInputChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function compressIfNeeded(f) {
    if (isPdf(f)) return f; // PDFs não precisam de compressão
    const MAX_DIM = 7500;
    const MAX_BYTES = 4.5 * 1024 * 1024;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const dimRatio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
        const sizeRatio = f.size > MAX_BYTES ? Math.sqrt(MAX_BYTES / f.size) * 0.85 : 1;
        const ratio = Math.min(dimRatio, sizeRatio);
        if (ratio >= 1) { resolve(f); return; }
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        cv.toBlob(
          (blob) => resolve(new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })),
          "image/jpeg",
          0.88
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleGenerate() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const fileToSend = await compressIfNeeded(file);
      const result = await gerarLoteamentoIA(fileToSend);
      if (!result?.shapes?.length) {
        setError("A IA não identificou elementos no loteamento. Tente com um arquivo mais claro.");
        return;
      }
      onGenerate(result.shapes, result.canvas);
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao processar arquivo com IA.");
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

  const fileIsSelected = !!file;

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
              Faça upload do PDF ou imagem da planta do terreno. A IA identificará os lotes, ruas e áreas verdes automaticamente.
            </p>
          </div>
          <button className="ai-modal-close" onClick={onClose} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div
          className={"ai-dropzone" + (dragOver ? " ai-dropzone-active" : "") + (fileIsSelected ? " ai-dropzone-filled" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !fileIsSelected && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            style={{ display: "none" }}
            onChange={handleInputChange}
          />

          {fileIsSelected ? (
            <div className="ai-preview-wrap">
              {preview ? (
                <img src={preview} alt="Preview" className="ai-preview-img" />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80 }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="4" width="26" height="34" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                    <path d="M28 4v10h10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                    <path d="M14 20h20M14 26h14M14 32h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <rect x="28" y="30" width="12" height="14" rx="2" fill="currentColor" opacity="0.15"/>
                    <text x="34" y="41" textAnchor="middle" fontSize="5" fill="currentColor" fontWeight="bold">PDF</text>
                  </svg>
                </div>
              )}
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
              <p className="ai-dropzone-label">Arraste o arquivo ou <span>clique para selecionar</span></p>
              <p className="ai-dropzone-hint">PDF (recomendado) · JPEG, PNG ou WebP · Máx. {MAX_SIZE_MB} MB</p>
            </div>
          )}
        </div>

        {error && <div className="ai-error">{error}</div>}

        <div className="ai-modal-tips">
          <b>Dicas para melhor resultado:</b>
          <ul>
            <li>PDF da planta vetorial é o formato ideal — mais preciso que imagem</li>
            <li>Certifique-se que todos os lotes e ruas estejam visíveis</li>
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
            disabled={!fileIsSelected || loading}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 10"/>
                </svg>
                Analisando planta...
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

/**
 * FileItem — Variante 5: ANATOMIA SILENTE
 * Estética: O consultório de Hannibal Lecter. Branco clínico sobre preto absoluto.
 * Linhas arquitetônicas precisas. Vermelho carmesim como único acento de cor —
 * discreto e perturbador. Cada card é uma placa de museu, uma peça de coleção.
 * Refinamento psicótico: tudo no lugar, tudo com propósito.
 * Fonte: Libre Caslon Display + Space Mono (para os metadados)
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3 } from 'lucide-react';
import { DriveFile, MIME_TYPES } from '../../types';

interface FileItemProps {
  file: DriveFile;
  onSelect: (file: DriveFile) => void;
  onTogglePin: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onMove: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  isOffline?: boolean;
  isPinned?: boolean;
  isActiveMenu?: boolean;
  setActiveMenu: (id: string | null) => void;
  isLocalMode?: boolean;
  accessToken?: string;
  isExpanding?: boolean;
  childCount?: number;
}

// Código de espécime anatômico
function specimenCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const prefix = ['HBL','FBM','NAT','SPC','INS','LAC','OBS','SIL'][h % 8];
  return `${prefix}·${String(h).slice(-4).padStart(4,'0')}`;
}

// Tipo de espécime
function specimenType(mimeType: string, name: string): string {
  if (mimeType === MIME_TYPES.FOLDER) return 'COLEÇÃO';
  if (name.endsWith('.mindmap')) return 'MAPA COGNITIVO';
  if (mimeType === MIME_TYPES.PDF) return 'DOCUMENTO';
  if (mimeType?.includes('image')) return 'IMAGEM';
  return 'ARQUIVO';
}

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const code = specimenCode(file.id);
  const type = specimenType(file.mimeType, file.name);
  const displayName = file.name.length > 28 ? file.name.slice(0, 26) + '…' : file.name;

  useEffect(() => {
    if (!isActiveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActiveMenu, setActiveMenu]);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=Space+Mono:ital@0;1&family=Cormorant+SC:wght@400;500;600&display=swap');
        .anatomia-card {
          transition: transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.25s ease;
        }
        .anatomia-card:hover {
          transform: translateY(-3px);
        }
        @keyframes crimson-pulse {
          0%,100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .crimson-pulse { animation: crimson-pulse 2s ease-in-out infinite; }
        @keyframes scan-line {
          from { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          to { transform: translateY(100%); opacity: 0; }
        }
        .anatomia-card:hover .scan-effect { animation: scan-line 1.5s ease-in-out; }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="anatomia-card w-full text-left overflow-hidden"
        style={{
          background: '#000000',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
          borderTop: `2px solid ${hovered ? '#8B0000' : 'rgba(139,0,0,0.6)'}`,
          borderRadius: '0',
          boxShadow: hovered
            ? '0 8px 32px rgba(0,0,0,0.9), 0 -1px 0 rgba(139,0,0,0.4)'
            : '0 2px 12px rgba(0,0,0,0.7)',
          minHeight: '160px',
          position: 'relative',
        }}
      >
        {/* Scan line effect on hover */}
        <div className="scan-effect absolute inset-0 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
            height: '30%',
          }}
        />

        <div className="relative z-10 p-4 flex flex-col gap-3">
          {/* Header: código + tipo */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em]"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: 'rgba(139,0,0,0.9)',
              }}>
              {code}
            </span>
            <span className="text-[8px] tracking-[0.15em]"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: 'rgba(255,255,255,0.2)',
              }}>
              {type}
            </span>
          </div>

          {/* Linha divisória carmesim */}
          <div className="h-px w-full" style={{ background: 'rgba(139,0,0,0.4)' }} />

          {/* Ícone geométrico central */}
          <div className="flex justify-center py-2">
            <div className="relative"
              style={{
                width: '40px',
                height: '40px',
              }}>
              {/* Quadrado rotacionado */}
              <div className="absolute inset-0 rotate-45"
                style={{
                  border: `1px solid ${hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
                  transition: 'border-color 0.3s',
                }}
              />
              {/* Centro */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2"
                  style={{
                    background: isFolder ? 'rgba(139,0,0,0.9)' : 'rgba(255,255,255,0.4)',
                    transform: 'rotate(45deg)',
                  }}
                />
              </div>
              {/* Pin indicator */}
              {isPinned && (
                <div className="absolute -top-1 -right-1 w-2 h-2 crimson-pulse"
                  style={{ background: '#8B0000' }} />
              )}
            </div>
          </div>

          {/* Nome do arquivo */}
          <div>
            <p className="text-[13px] leading-tight"
              style={{
                fontFamily: "'Cormorant SC', 'Libre Caslon Display', 'Didot', Georgia, serif",
                color: hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
                fontWeight: isFolder ? 500 : 400,
                letterSpacing: '0.04em',
                transition: 'color 0.2s',
              }}>
              {displayName}
            </p>
          </div>

          {/* Footer com metadados */}
          <div className="flex items-center justify-between mt-auto pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[8px]"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: 'rgba(255,255,255,0.15)',
              }}>
              {file.modifiedTime
                ? new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
                : '——'}
            </span>
            <div className="flex items-center gap-1">
              {isOffline && (
                <div className="w-1 h-1" style={{ background: 'rgba(80,200,80,0.8)' }} />
              )}
              {/* Indicador de pasta */}
              {isFolder && (
                <div className="text-[8px] tracking-widest"
                  style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(139,0,0,0.6)' }}>
                  DIR
                </div>
              )}
            </div>
          </div>
        </div>

        {isExpanding && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="w-5 h-5 border border-[rgba(139,0,0,0.9)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Menu */}
      <div ref={menuRef} className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <MoreVertical size={12} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-6 w-44 z-50 animate-in fade-in duration-150"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderTop: '1px solid rgba(139,0,0,0.6)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.95)',
              fontFamily: "'Space Mono', monospace",
            }}>
            {[
              { icon: <Pin size={11} />, label: isPinned ? 'DESAFIXAR' : 'FIXAR', action: () => onTogglePin(file) },
              { icon: <Edit3 size={11} />, label: 'RENOMEAR', action: () => onRename(file) },
              { icon: <FolderInput size={11} />, label: 'MOVER', action: () => onMove(file) },
              { icon: <Share2 size={11} />, label: 'COMPARTILHAR', action: () => onShare(file) },
              { icon: <Trash2 size={11} />, label: 'EXCLUIR', action: () => onDelete(file), danger: true },
            ].map(({ icon, label, action, danger }: any) => (
              <button key={label}
                onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[9px] tracking-widest transition-colors"
                style={{ color: danger ? '#8B0000' : 'rgba(255,255,255,0.5)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = danger ? '#cc0000' : 'rgba(255,255,255,0.85)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = danger ? '#8B0000' : 'rgba(255,255,255,0.5)';
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

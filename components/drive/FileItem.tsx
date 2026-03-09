/**
 * FileItem — Variante 2 rev.2: CABINET DE CURIOSITÉS — ÉDITION NOIRE
 *
 * MUDANÇAS desta revisão:
 * — Fundo metálico preto polido (gradiente de aço escuro com reflexo sutil)
 * — Texto branco puro; inicial prata brilhante com efeito metálico
 * — Faixa de hover (drawer-handle) usa var(--brand) do tema ativo
 * — Faixa extrema esquerda: vermelho real (#CC0000)
 * — Arquivos: card com thumbnail preview + fundo pedra polida (#0a0a0c)
 * — Offline indicator: selo de cera vermelho com textura de lacre
 * — Nome e data em branco puro abaixo da preview
 */

import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3, BookOpen, Map, FileText, ChevronRight } from 'lucide-react';
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

function catalogLetter(name: string): string {
  const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
  return upper.charAt(0) || '·';
}

function refCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
  const a = letters[h % letters.length];
  const b = letters[(h >> 4) % letters.length];
  const n = String(h % 999 + 1).padStart(3, '0');
  return `${a}${b}·${n}`;
}

function getBrandColor(): string {
  if (typeof document === 'undefined') return '#4ade80';
  return getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#4ade80';
}

// Selo de lacre SVG — cera vermelha carmesim
// Ícone de disponível offline — checkmark circular verde
const OfflineCheck: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="11" fill="#22c55e" />
    <circle cx="11" cy="11" r="10" fill="#16a34a" opacity="0.4" />
    {/* Checkmark path */}
    <path d="M6 11.5L9.5 15L16 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Menu contextual compartilhado
interface CtxProps {
  file: DriveFile;
  isPinned?: boolean;
  brandColor: string;
  onTogglePin: (f: DriveFile) => void;
  onRename: (f: DriveFile) => void;
  onMove: (f: DriveFile) => void;
  onShare: (f: DriveFile) => void;
  onDelete: (f: DriveFile) => void;
  setActiveMenu: (id: string | null) => void;
}

const ContextMenu: React.FC<CtxProps> = ({
  file, isPinned, brandColor,
  onTogglePin, onRename, onMove, onShare, onDelete, setActiveMenu
}) => (
  <div className="absolute right-0 top-6 w-44 z-50 animate-in fade-in duration-150"
    style={{
      background: 'linear-gradient(160deg, #101014 0%, #0a0a0d 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: `1px solid ${brandColor}50`,
      borderRadius: '2px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.04)',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
    {[
      { icon: <Pin size={12} />, label: isPinned ? 'Desafixar' : 'Fixar', action: () => onTogglePin(file) },
      { icon: <Edit3 size={12} />, label: 'Renomear', action: () => onRename(file) },
      { icon: <FolderInput size={12} />, label: 'Mover', action: () => onMove(file) },
      { icon: <Share2 size={12} />, label: 'Compartilhar', action: () => onShare(file) },
      { icon: <Trash2 size={12} />, label: 'Excluir', action: () => onDelete(file), danger: true },
    ].map(({ icon, label, action, danger }: any) => (
      <button key={label}
        onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors"
        style={{ color: danger ? '#cc3333' : 'rgba(255,255,255,0.7)' }}
        onMouseEnter={e => {
          e.currentTarget.style.background = danger ? 'rgba(204,0,0,0.1)' : 'rgba(255,255,255,0.05)';
          if (!danger) e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = danger ? '#cc3333' : 'rgba(255,255,255,0.7)';
        }}
      >
        {icon}{label}
      </button>
    ))}
  </div>
);

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const isMindmap = file.name.endsWith('.mindmap') || file.mimeType === MIME_TYPES.MINDMAP;
  const menuRef = useRef<HTMLDivElement>(null);
  const [brandColor, setBrandColor] = useState('#4ade80');

  useLayoutEffect(() => {
    setBrandColor(getBrandColor());
    const observer = new MutationObserver(() => setBrandColor(getBrandColor()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActiveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActiveMenu, setActiveMenu]);

  const letter = catalogLetter(file.name);
  const ref = refCode(file.id);
  const displayName = file.name.length > 34 ? file.name.slice(0, 32) + '…' : file.name;
  const formattedDate = file.modifiedTime
    ? new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const sharedStyles = `
    .silver-letter {
      background: linear-gradient(150deg, #c8c8c8 0%, #ffffff 28%, #a8a8a8 52%, #d8d8d8 72%, #efefef 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
    }
  `;

  // ── ARQUIVO: card vertical com thumbnail — estilo original ────────────────
  if (!isFolder) {
    return (
      <div className="relative group">
        <style>{`
          .file-card-noir {
            transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
          }
          .file-card-noir:hover {
            transform: translateY(-5px) scale(1.015);
            box-shadow: 0 18px 45px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.07) !important;
          }
          .brand-reveal {
            opacity: 0;
            transform: scaleX(0.5);
            transition: opacity 0.3s ease, transform 0.35s ease;
          }
          .file-card-noir:hover .brand-reveal {
            opacity: 1;
            transform: scaleX(1);
          }
        `}</style>

        <button
          onClick={() => onSelect(file)}
          className="file-card-noir w-full text-left overflow-hidden"
          style={{
            background: '#0a0a0d',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '3px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.85)',
            position: 'relative',
            minHeight: '180px',
          }}
        >
          {/* Linha brand no topo — revela no hover */}
          <div className="brand-reveal absolute top-0 left-0 right-0 h-[2px] z-10"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${brandColor} 50%, transparent 100%)` }}
          />

          {/* Preview / thumbnail — ocupa quase todo o card */}
          <div className="relative overflow-hidden" style={{ height: '155px', background: '#060609' }}>
            {file.thumbnailLink ? (
              <>
                <img src={file.thumbnailLink} alt="" loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.92, filter: 'contrast(1.03) brightness(0.95)' }}
                />
                <div className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(140deg, #0a0a0f 0%, #111118 100%)' }}>
                <div className="flex flex-col items-center gap-2" style={{ opacity: 0.2 }}>
                  {isMindmap
                    ? <Map size={36} strokeWidth={0.8} style={{ color: '#fff' }} />
                    : <FileText size={36} strokeWidth={0.8} style={{ color: '#fff' }} />}
                </div>
              </div>
            )}

            {/* Gradiente de fade no rodapé da preview — funde com o info abaixo */}
            <div className="absolute bottom-0 left-0 right-0 h-14"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.88))' }} />

            {/* Nome e data sobrepostos no rodapé da preview */}
            <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 z-10">
              <p className="truncate text-[12.5px] font-medium leading-snug"
                style={{ color: 'rgba(255,255,255,0.92)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                {displayName}
              </p>
              {formattedDate && (
                <p className="text-[10px] mt-0.5 tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.38)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {formattedDate}
                </p>
              )}
            </div>

            {/* Ícone offline — checkmark verde, canto superior direito */}
            {isOffline && (
              <div className="absolute top-2 right-2 z-20"
                title="Disponível offline"
                style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))' }}>
                <OfflineCheck size={20} />
              </div>
            )}

            {isPinned && (
              <div className="absolute top-2 left-2 z-20 w-2 h-2 rounded-full"
                style={{ background: brandColor, boxShadow: `0 0 6px ${brandColor}` }} />
            )}
          </div>

          {isExpanding && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="w-5 h-5 border border-white/25 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>

        <div ref={menuRef} className="absolute top-7 right-2 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.65)' }}>
            <MoreVertical size={13} />
          </button>
          {isActiveMenu && (
            <ContextMenu file={file} isPinned={isPinned} brandColor={brandColor}
              onTogglePin={onTogglePin} onRename={onRename} onMove={onMove}
              onShare={onShare} onDelete={onDelete} setActiveMenu={setActiveMenu} />
          )}
        </div>
      </div>
    );
  }

  // ── PASTA: gaveta metálica horizontal ─────────────────────────────────────
  return (
    <div className="relative w-full group">
      <style>{sharedStyles + `
        .cabinet-drawer-noir {
          transition: transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.22s ease;
        }
        .cabinet-drawer-noir:hover {
          transform: translateX(7px);
          box-shadow: -8px 3px 28px rgba(0,0,0,0.88),
                      inset 0 1px 0 rgba(255,255,255,0.06) !important;
        }
        .drawer-brand-handle {
          transition: background 0.22s ease, box-shadow 0.22s ease;
        }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="cabinet-drawer-noir w-full text-left relative overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, #111115 0%, #0d0d11 40%, #0a0a0e 70%, #0f0f13 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid #CC0000',
          borderRadius: '2px',
          boxShadow: '0 2px 14px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
          padding: '0',
          display: 'flex',
          alignItems: 'stretch',
          minHeight: '64px',
        }}
      >
        {/* Micro-reflexo metálico no topo */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.07) 50%, transparent 95%)' }}
        />

        {/* Faixa de indexação */}
        <div className="flex-shrink-0 w-11 flex flex-col items-center justify-center gap-0.5"
          style={{ background: 'rgba(0,0,0,0.45)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="silver-letter"
            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>
            {letter}
          </span>
          <div className="w-4 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <span style={{
            color: 'rgba(255,255,255,0.16)', fontSize: '6.5px', letterSpacing: '0.06em',
            transform: 'rotate(-90deg)', whiteSpace: 'nowrap', marginTop: '3px', fontFamily: 'monospace',
          }}>
            {ref}
          </span>
        </div>

        {/* Puxador brand */}
        <div
          className="drawer-brand-handle flex-shrink-0 w-[6px] self-stretch"
          style={{
            background: `linear-gradient(180deg, ${brandColor}25 0%, ${brandColor}55 50%, ${brandColor}25 100%)`,
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        />

        {/* Conteúdo */}
        <div className="flex-1 flex items-center px-3 py-2 gap-3">
          <BookOpen size={17} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} strokeWidth={1.5} />

          <div className="flex-1 min-w-0">
            <p className="truncate leading-tight"
              style={{
                color: 'rgba(255,255,255,0.93)',
                fontWeight: 500,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '16px',
                letterSpacing: '-0.01em',
              }}>
              {file.name}
            </p>
            {formattedDate && (
              <p className="text-[10px] mt-0.5 tracking-wider"
                style={{ color: 'rgba(200,160,60,0.75)', fontFamily: "'Inter', system-ui, sans-serif" }}>
                {formattedDate}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            {isPinned && (
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: brandColor, boxShadow: `0 0 5px ${brandColor}80` }} />
            )}
            {isOffline && <OfflineCheck size={18} />}
            <ChevronRight size={13} style={{ color: 'rgba(200,160,60,0.85)' }} />
          </div>
        </div>

        {isExpanding && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border border-white/25 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <div ref={menuRef} className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 rounded opacity-40 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(200,160,60,0.9)', background: 'rgba(0,0,0,0.55)' }}>
          <MoreVertical size={13} />
        </button>
        {isActiveMenu && (
          <ContextMenu file={file} isPinned={isPinned} brandColor={brandColor}
            onTogglePin={onTogglePin} onRename={onRename} onMove={onMove}
            onShare={onShare} onDelete={onDelete} setActiveMenu={setActiveMenu} />
        )}
      </div>
    </div>
  );
};

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
const WaxSeal: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <defs>
      <radialGradient id="wax-g" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stopColor="#ff4444" />
        <stop offset="50%" stopColor="#cc0000" />
        <stop offset="100%" stopColor="#6b0000" />
      </radialGradient>
      <radialGradient id="wax-s" cx="33%" cy="28%" r="38%">
        <stop offset="0%" stopColor="rgba(255,160,160,0.55)" />
        <stop offset="100%" stopColor="rgba(255,160,160,0)" />
      </radialGradient>
    </defs>
    <path d="M14,2.5 C17.5,2.5 22.5,4.5 23.5,8.5 C25.5,10.5 26.5,13.5 24.5,16.5 C25.5,19.5 23.5,24.5 19.5,25.5 C17.5,27 10.5,27 7.5,24.5 C4.5,23 1.5,19 2.5,15 C1.5,12 2.5,8 5.5,6 C7.5,3 11,2.5 14,2.5 Z"
      fill="url(#wax-g)" />
    <path d="M14,2.5 C17.5,2.5 22.5,4.5 23.5,8.5 C25.5,10.5 26.5,13.5 24.5,16.5 C25.5,19.5 23.5,24.5 19.5,25.5 C17.5,27 10.5,27 7.5,24.5 C4.5,23 1.5,19 2.5,15 C1.5,12 2.5,8 5.5,6 C7.5,3 11,2.5 14,2.5 Z"
      fill="url(#wax-s)" />
    <circle cx="14" cy="14" r="6.5" stroke="rgba(60,0,0,0.45)" strokeWidth="0.6" fill="none" />
    <text x="14" y="17.5" textAnchor="middle"
      fontFamily="'Cormorant Garamond', Georgia, serif"
      fontSize="9.5" fontWeight="600"
      fill="rgba(70,0,0,0.75)"
      style={{ userSelect: 'none' }}>
      L
    </text>
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
      fontFamily: "'Cormorant Garamond', serif",
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
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
    .silver-letter {
      background: linear-gradient(150deg, #c8c8c8 0%, #ffffff 28%, #a8a8a8 52%, #d8d8d8 72%, #efefef 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
    }
  `;

  // ── ARQUIVO: card vertical com thumbnail ───────────────────────────────────
  if (!isFolder) {
    return (
      <div className="relative group">
        <style>{sharedStyles + `
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
            // Pedra polida: preto azulado muito escuro com micro-reflexo
            background: 'linear-gradient(160deg, #0e0e13 0%, #080809 50%, #0b0b0f 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderTop: '2px solid rgba(255,255,255,0.06)',
            borderRadius: '2px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative',
          }}
        >
          {/* Linha de destaque brand no topo — revela no hover */}
          <div className="brand-reveal absolute top-0 left-0 right-0 h-[2px] z-10"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${brandColor} 50%, transparent 100%)` }}
          />

          {/* Preview / thumbnail */}
          <div className="relative overflow-hidden" style={{ height: '140px', background: '#06060a' }}>
            {file.thumbnailLink ? (
              <>
                <img src={file.thumbnailLink} alt="" loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.9, filter: 'contrast(1.04) brightness(0.94)' }}
                />
                {/* Vignette sobre a imagem */}
                <div className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(140deg, #0a0a0f 0%, #0f0f14 100%)' }}>
                <div className="flex flex-col items-center gap-2" style={{ opacity: 0.22 }}>
                  {isMindmap
                    ? <Map size={34} strokeWidth={0.8} style={{ color: '#fff' }} />
                    : <FileText size={34} strokeWidth={0.8} style={{ color: '#fff' }} />}
                  <span style={{
                    color: '#fff', fontSize: '8px', letterSpacing: '0.22em',
                    fontFamily: "'Cormorant Garamond', serif", textTransform: 'uppercase',
                  }}>
                    {isMindmap ? 'mapa cognitivo' : 'documento'}
                  </span>
                </div>
              </div>
            )}

            {/* Fade inferior — integra preview com info block */}
            <div className="absolute bottom-0 left-0 right-0 h-10"
              style={{ background: 'linear-gradient(to bottom, transparent, #08080c)' }} />

            {/* Selo de lacre offline — canto inferior direito */}
            {isOffline && (
              <div className="absolute bottom-1.5 right-2"
                title="Disponível offline"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(180,0,0,0.6))' }}>
                <WaxSeal size={32} />
              </div>
            )}
          </div>

          {/* Info block — pedra polida */}
          <div className="px-3 py-2.5"
            style={{ background: 'linear-gradient(180deg, #08080c 0%, #060609 100%)' }}>
            <p className="truncate text-[13px] font-medium"
              style={{
                color: 'rgba(255,255,255,0.90)',
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 500,
                letterSpacing: '0.01em',
                lineHeight: 1.3,
              }}>
              {displayName}
            </p>
            {formattedDate && (
              <p className="text-[10px] mt-0.5 tracking-wider"
                style={{
                  color: 'rgba(255,255,255,0.24)',
                  fontFamily: "'Cormorant Garamond', serif",
                  fontVariant: 'small-caps',
                }}>
                {formattedDate}
              </p>
            )}
            {isPinned && (
              <div className="absolute bottom-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                style={{ background: brandColor, boxShadow: `0 0 5px ${brandColor}90` }} />
            )}
          </div>

          {isExpanding && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="w-5 h-5 border border-white/25 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>

        <div ref={menuRef} className="absolute top-2 right-2 z-20">
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
            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: 600, lineHeight: 1 }}>
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
            <p className="truncate text-[14px] leading-tight"
              style={{
                color: 'rgba(255,255,255,0.91)',
                fontWeight: 500,
                fontFamily: "'Cormorant Garamond', serif",
                letterSpacing: '0.015em',
              }}>
              {file.name}
            </p>
            {formattedDate && (
              <p className="text-[10px] mt-0.5 tracking-wider"
                style={{ color: 'rgba(255,255,255,0.2)', fontVariant: 'small-caps', fontFamily: "'Cormorant Garamond', serif" }}>
                {formattedDate}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            {isPinned && (
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: brandColor, boxShadow: `0 0 5px ${brandColor}80` }} />
            )}
            {isOffline && <WaxSeal size={20} />}
            <ChevronRight size={11} style={{ color: 'rgba(255,255,255,0.14)' }} />
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
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.55)' }}>
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

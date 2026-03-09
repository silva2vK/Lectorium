/**
 * FileItem — Variante 1: CODEX OBSCURA
 * Estética: Biblioteca vitoriana. Volumes encadernados em couro escuro.
 * Cada pasta é um tomo numerado em romano, com nervuras douradas na lombada.
 * Arquivos são manuscritos selados com lacre.
 * Fonte: Playfair Display + EB Garamond
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3, Download, BookOpen, ScrollText, FileText, Map } from 'lucide-react';
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

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

function toRoman(n: number): string {
  return ROMAN[(n - 1) % ROMAN.length] || 'I';
}

// Pseudo-determinístico: índice baseado no id da pasta
function folderIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return (h % 15) + 1;
}

const SPINE_COLORS = [
  '#1a0f0a','#0a1018','#0d1a0e','#1a0a14','#100a1a',
  '#1a1208','#0a1414','#180e0a','#0e0a18','#141008',
];

function spineColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) & 0xff;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isLocalMode, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const isMindmap = file.name.endsWith('.mindmap') || file.mimeType === MIME_TYPES.MINDMAP;
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!isActiveMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActiveMenu, setActiveMenu]);

  const roman = toRoman(folderIndex(file.id));
  const bgColor = spineColor(file.id);

  // Truncar nome elegantemente
  const displayName = file.name.length > 28 ? file.name.slice(0, 26) + '…' : file.name;

  return (
    <div
      className="relative group"
      style={{ fontFamily: "'EB Garamond', 'Palatino Linotype', Georgia, serif" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Playfair+Display:wght@400;500;700&display=swap');
        .codex-card { transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease; }
        .codex-card:hover { transform: translateY(-4px) scale(1.01); }
        .codex-spine-line { background: linear-gradient(90deg, transparent, rgba(184,148,76,0.6), transparent); }
        .codex-gilded { background: linear-gradient(135deg, #b8944c 0%, #e8c97a 40%, #b8944c 60%, #f0d898 80%, #b8944c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        @keyframes codex-breathe { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .codex-breathe { animation: codex-breathe 3s ease-in-out infinite; }
      `}</style>

      {/* Card principal */}
      <button
        onClick={() => onSelect(file)}
        className="codex-card w-full text-left relative overflow-hidden rounded-sm"
        style={{
          background: `linear-gradient(160deg, ${bgColor} 0%, #0d0b09 100%)`,
          border: '1px solid rgba(184,148,76,0.25)',
          boxShadow: hovered
            ? '0 12px 40px rgba(0,0,0,0.8), 0 0 20px rgba(184,148,76,0.12), inset 0 1px 0 rgba(184,148,76,0.15)'
            : '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(184,148,76,0.08)',
          minHeight: isFolder ? '160px' : '140px',
        }}
      >
        {/* Nervura esquerda (lombada) */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: 'linear-gradient(180deg, rgba(184,148,76,0.8) 0%, rgba(184,148,76,0.3) 50%, rgba(184,148,76,0.8) 100%)' }}
        />

        {/* Linhas de nervura horizontais */}
        {isFolder && [20, 55, 90].map(top => (
          <div key={top} className="codex-spine-line absolute left-0 right-0 h-px" style={{ top: `${top}%` }} />
        ))}

        {/* Textura de papel envelhecido */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.5) 18px, rgba(255,255,255,0.5) 19px)' }}
        />

        <div className="relative z-10 p-4 flex flex-col gap-2">
          {/* Ícone / Símbolo */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center">
              {isFolder ? (
                <>
                  <BookOpen size={22} style={{ color: 'rgba(184,148,76,0.9)' }} strokeWidth={1.5} />
                  <span className="codex-gilded text-[11px] font-bold mt-1 tracking-widest"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                    {roman}
                  </span>
                </>
              ) : isMindmap ? (
                <Map size={22} style={{ color: 'rgba(184,148,76,0.7)' }} strokeWidth={1.5} />
              ) : (
                <ScrollText size={22} style={{ color: 'rgba(184,148,76,0.7)' }} strokeWidth={1.5} />
              )}
            </div>

            {/* Pin e indicadores */}
            <div className="flex flex-col items-end gap-1">
              {isPinned && (
                <div className="w-1.5 h-1.5 rounded-full codex-breathe"
                  style={{ background: 'rgba(184,148,76,0.9)' }} />
              )}
              {isOffline && (
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'rgba(100,200,100,0.7)' }} />
              )}
            </div>
          </div>

          {/* Divider ornamental */}
          <div className="flex items-center gap-1 my-1">
            <div className="h-px flex-1" style={{ background: 'rgba(184,148,76,0.2)' }} />
            <div className="w-1 h-1 rotate-45" style={{ background: 'rgba(184,148,76,0.4)' }} />
            <div className="h-px flex-1" style={{ background: 'rgba(184,148,76,0.2)' }} />
          </div>

          {/* Nome do arquivo/pasta */}
          <div>
            <p className="text-[13px] leading-snug"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: 'rgba(230,210,170,0.95)',
                fontWeight: isFolder ? 500 : 400,
                letterSpacing: '0.01em',
              }}>
              {displayName}
            </p>
            {file.modifiedTime && (
              <p className="text-[10px] mt-1.5 tracking-wide"
                style={{ color: 'rgba(184,148,76,0.45)', fontFamily: "'EB Garamond', serif" }}>
                {new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
              </p>
            )}
          </div>
        </div>

        {/* Expanding overlay */}
        {isExpanding && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(184,148,76,0.8)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </button>

      {/* Menu contextual */}
      <div ref={menuRef} className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(184,148,76,0.7)', background: 'rgba(0,0,0,0.5)' }}
        >
          <MoreVertical size={14} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-7 w-44 rounded-sm overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              background: '#0f0c09',
              border: '1px solid rgba(184,148,76,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              fontFamily: "'EB Garamond', serif",
            }}>
            {[
              { icon: <Pin size={12} />, label: isPinned ? 'Desafixar' : 'Fixar', action: () => onTogglePin(file) },
              { icon: <Edit3 size={12} />, label: 'Renomear', action: () => onRename(file) },
              { icon: <FolderInput size={12} />, label: 'Mover', action: () => onMove(file) },
              { icon: <Share2 size={12} />, label: 'Compartilhar', action: () => onShare(file) },
              { icon: <Trash2 size={12} />, label: 'Excluir', action: () => onDelete(file), danger: true },
            ].map(({ icon, label, action, danger }: any) => (
              <button key={label} onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
                style={{
                  color: danger ? 'rgba(220,100,100,0.9)' : 'rgba(210,190,150,0.85)',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,148,76,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

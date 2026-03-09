/**
 * FileItem — Variante 2: CABINET DE CURIOSITÉS
 * Estética: Gavetas de um armário de catalogação do séc. XIX.
 * Cada item é uma gaveta com puxador de metal envelhecido e etiqueta escrita à mão.
 * Pastas são gavetas maiores; arquivos são fichas deslizantes.
 * Layout: lista horizontal (gavetas empilhadas), não grid.
 * Fonte: Cormorant Garamond + Crimson Pro
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3, FileText, BookOpen, Map, ChevronRight } from 'lucide-react';
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

// Gera uma letra de catalogação a partir do nome
function catalogLetter(name: string): string {
  const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
  return upper.charAt(0) || '·';
}

// Código de referência interno
function refCode(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
  const a = letters[h % letters.length];
  const b = letters[(h >> 4) % letters.length];
  const n = String(h % 999 + 1).padStart(3, '0');
  return `${a}${b}·${n}`;
}

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const isMindmap = file.name.endsWith('.mindmap') || file.mimeType === MIME_TYPES.MINDMAP;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pulled, setPulled] = useState(false);

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

  return (
    <div
      className="relative w-full"
      style={{ fontFamily: "'Crimson Pro', 'Crimson Text', 'Cormorant Garamond', Georgia, serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&display=swap');
        .cabinet-drawer {
          transition: transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.2s ease;
        }
        .cabinet-drawer:hover {
          transform: translateX(6px);
          box-shadow: -6px 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }
        .cabinet-drawer:hover .drawer-handle {
          background: rgba(160,130,80,0.9) !important;
          box-shadow: 0 0 8px rgba(160,130,80,0.4) !important;
        }
        @keyframes cabinet-slide { from{transform:translateX(0)} to{transform:translateX(8px)} }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="cabinet-drawer w-full text-left relative overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, #1c1409 0%, #120e07 60%, #0d0b08 100%)',
          border: '1px solid rgba(120,90,40,0.3)',
          borderLeft: '4px solid rgba(140,105,45,0.6)',
          borderRadius: '2px',
          boxShadow: '-2px 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
          padding: '0',
          display: 'flex',
          alignItems: 'stretch',
          minHeight: isFolder ? '68px' : '56px',
        }}
      >
        {/* Faixa lateral de indexação */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center justify-center gap-0.5"
          style={{ background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(120,90,40,0.2)' }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            color: 'rgba(180,145,65,0.9)',
            fontSize: '18px',
            fontWeight: 600,
            lineHeight: 1,
          }}>{letter}</span>
          <div className="w-4 h-px" style={{ background: 'rgba(180,145,65,0.3)' }} />
          <span style={{
            color: 'rgba(180,145,65,0.35)',
            fontSize: '7px',
            letterSpacing: '0.05em',
            transform: 'rotate(-90deg)',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}>{ref}</span>
        </div>

        {/* Puxador da gaveta */}
        <div className="drawer-handle flex-shrink-0 w-2 self-stretch"
          style={{
            background: 'rgba(140,110,50,0.5)',
            borderRight: '1px solid rgba(120,90,40,0.4)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        />

        {/* Conteúdo */}
        <div className="flex-1 flex items-center px-3 py-2 gap-3">
          <div className="flex-shrink-0">
            {isFolder
              ? <BookOpen size={18} style={{ color: 'rgba(180,145,65,0.8)' }} strokeWidth={1.5} />
              : isMindmap
              ? <Map size={18} style={{ color: 'rgba(180,145,65,0.7)' }} strokeWidth={1.5} />
              : <FileText size={18} style={{ color: 'rgba(180,145,65,0.6)' }} strokeWidth={1.5} />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className="truncate text-[14px] leading-tight"
              style={{
                color: isFolder ? 'rgba(230,205,155,0.95)' : 'rgba(200,185,150,0.85)',
                fontWeight: isFolder ? 500 : 400,
                fontStyle: isFolder ? 'normal' : 'italic',
              }}>
              {file.name}
            </p>
            {file.modifiedTime && (
              <p className="text-[10px] mt-0.5 tracking-wider"
                style={{ color: 'rgba(150,120,60,0.5)', fontVariant: 'small-caps' }}>
                {new Date(file.modifiedTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Indicadores */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {isPinned && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(180,145,65,0.9)' }} />}
            {isOffline && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(80,180,100,0.8)' }} />}
            {isFolder && <ChevronRight size={12} style={{ color: 'rgba(150,120,60,0.4)' }} />}
          </div>
        </div>

        {isExpanding && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(180,145,65,0.8)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </button>

      {/* Menu */}
      <div ref={menuRef} className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(180,145,65,0.6)', background: 'rgba(0,0,0,0.4)' }}
        >
          <MoreVertical size={13} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-6 w-44 z-50 animate-in fade-in duration-150"
            style={{
              background: '#110e08',
              border: '1px solid rgba(140,105,45,0.35)',
              borderRadius: '2px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
              fontFamily: "'Crimson Pro', serif",
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
                style={{ color: danger ? 'rgba(210,90,90,0.9)' : 'rgba(200,175,120,0.85)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(140,105,45,0.1)')}
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

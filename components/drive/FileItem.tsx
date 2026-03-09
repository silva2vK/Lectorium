/**
 * FileItem — Variante 3: LACQUER NOIR
 * Estética: Arte japonesa de laca preta (urushi) com detalhes dourados e vermelho carmesim.
 * A elegância de Hannibal é aqui oriental — contenção, simetria, beleza no vazio.
 * Pastas: placas lacadas com símbolo de mon (brasão familiar).
 * Arquivos: pergaminhos selados com fita vermelha.
 * Fonte: Noto Serif JP + Cinzel
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pin, Trash2, Share2, FolderInput, Edit3, FileText, Map } from 'lucide-react';
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

// Mon (brasão circular) — padrões geométricos determinísticos
const MON_PATTERNS = [
  // Triskell
  'M12,6 L18,18 L6,18 Z M12,18 A6,6 0 0,0 12,6',
  // Cruz
  'M12,4 L12,20 M4,12 L20,12',
  // Círculos concêntricos
  'M12,12 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 M12,12 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0',
  // Losango
  'M12,4 L20,12 L12,20 L4,12 Z',
  // Hexágono
  'M12,5 L18.9,9 L18.9,15 L12,19 L5.1,15 L5.1,9 Z',
];

function monPattern(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 7 + id.charCodeAt(i)) & 0xff;
  return MON_PATTERNS[h % MON_PATTERNS.length];
}

const LACQUER_TONES = [
  { base: '#0a0a0a', accent: 'rgba(184,148,76,0.9)', seal: '#8B0000' },
  { base: '#080c08', accent: 'rgba(184,148,76,0.9)', seal: '#722F37' },
  { base: '#08080c', accent: 'rgba(184,148,76,0.9)', seal: '#8B0000' },
  { base: '#0c0808', accent: 'rgba(184,148,76,0.9)', seal: '#6B1414' },
];

function lacquerTone(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 13 + id.charCodeAt(i)) & 0xff;
  return LACQUER_TONES[h % LACQUER_TONES.length];
}

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
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

  const pattern = monPattern(file.id);
  const tone = lacquerTone(file.id);
  const shortName = file.name.replace(/\.[^/.]+$/, ''); // remove extensão para pastas
  const displayName = file.name.length > 30 ? file.name.slice(0, 28) + '…' : file.name;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cinzel+Decorative:wght@400;700&family=Noto+Serif:ital,wght@0,400;1,400&display=swap');
        .lacquer-card {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
          will-change: transform;
        }
        .lacquer-card:hover { transform: translateY(-6px) rotate(0.3deg); }
        @keyframes lacquer-glow {
          0%,100% { box-shadow: 0 0 20px rgba(139,0,0,0.2); }
          50% { box-shadow: 0 0 35px rgba(139,0,0,0.4); }
        }
        .lacquer-seal-pulse { animation: lacquer-glow 2.5s ease-in-out infinite; }
        .mon-stroke { stroke-dasharray: 60; stroke-dashoffset: 60; transition: stroke-dashoffset 0.6s ease; }
        .lacquer-card:hover .mon-stroke { stroke-dashoffset: 0; }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="lacquer-card w-full text-left overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${tone.base === '#0a0a0a' ? '#141010' : tone.base} 0%, #050505 100%)`,
          border: `1px solid ${hovered ? 'rgba(184,148,76,0.5)' : 'rgba(184,148,76,0.18)'}`,
          borderRadius: '1px',
          boxShadow: hovered
            ? `0 16px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(184,148,76,0.2), inset 0 1px 0 rgba(184,148,76,0.12)`
            : `0 4px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(184,148,76,0.05)`,
          minHeight: '170px',
          position: 'relative',
        }}
      >
        {/* Bordas ornamentais nos cantos */}
        {[
          'top-0 left-0 border-t border-l',
          'top-0 right-0 border-t border-r',
          'bottom-0 left-0 border-b border-l',
          'bottom-0 right-0 border-b border-r',
        ].map((cls, i) => (
          <div key={i} className={`absolute ${cls} w-3 h-3`}
            style={{ borderColor: 'rgba(184,148,76,0.5)' }} />
        ))}

        {/* Linha horizontal superior */}
        <div className="absolute top-5 left-4 right-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(184,148,76,0.3), transparent)' }} />

        <div className="relative z-10 p-5 flex flex-col items-center gap-3">
          {/* Mon (brasão circular) */}
          <div className="relative">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: `2px solid ${hovered ? tone.accent : 'rgba(184,148,76,0.3)'}`,
                boxShadow: hovered ? `0 0 20px rgba(184,148,76,0.2), inset 0 0 12px rgba(184,148,76,0.05)` : 'none',
                transition: 'border-color 0.3s, box-shadow 0.3s',
              }}>
              {isFolder ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path className="mon-stroke" d={pattern}
                    stroke="rgba(184,148,76,0.9)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isMindmap ? (
                <Map size={20} style={{ color: 'rgba(184,148,76,0.8)' }} strokeWidth={1} />
              ) : (
                <FileText size={20} style={{ color: 'rgba(184,148,76,0.7)' }} strokeWidth={1} />
              )}
            </div>

            {/* Lacre (selo vermelho) para arquivos */}
            {!isFolder && (
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${hovered ? 'lacquer-seal-pulse' : ''}`}
                style={{ background: tone.seal, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
              </div>
            )}

            {/* Pin indicator */}
            {isPinned && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                style={{ background: 'rgba(184,148,76,0.9)', boxShadow: '0 0 6px rgba(184,148,76,0.6)' }} />
            )}
          </div>

          {/* Linha separadora */}
          <div className="w-full flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: 'rgba(184,148,76,0.12)' }} />
            <div className="w-1 h-1 rotate-45" style={{ background: 'rgba(184,148,76,0.4)' }} />
            <div className="h-px flex-1" style={{ background: 'rgba(184,148,76,0.12)' }} />
          </div>

          {/* Nome */}
          <div className="text-center w-full">
            <p className="text-[12px] leading-snug tracking-wider uppercase"
              style={{
                color: hovered ? 'rgba(230,205,155,1)' : 'rgba(200,175,130,0.85)',
                fontFamily: "'Cinzel', serif",
                fontWeight: 400,
                transition: 'color 0.2s',
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}>
              {displayName}
            </p>
            {file.modifiedTime && (
              <p className="text-[9px] mt-1.5 tracking-widest"
                style={{ color: 'rgba(184,148,76,0.3)', fontFamily: "'Cinzel', serif" }}>
                {new Date(file.modifiedTime).getFullYear()}
              </p>
            )}
          </div>
        </div>

        {/* Linha horizontal inferior */}
        <div className="absolute bottom-5 left-4 right-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(184,148,76,0.3), transparent)' }} />

        {isExpanding && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="w-6 h-6 border border-[rgba(184,148,76,0.8)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Menu */}
      <div ref={menuRef} className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(184,148,76,0.7)' }}
        >
          <MoreVertical size={13} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-7 w-44 z-50 animate-in fade-in duration-150"
            style={{
              background: '#060404',
              border: '1px solid rgba(139,0,0,0.4)',
              borderRadius: '1px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.95)',
              fontFamily: "'Cinzel', serif",
            }}>
            {[
              { icon: <Pin size={11} />, label: isPinned ? 'Desafixar' : 'Fixar', action: () => onTogglePin(file) },
              { icon: <Edit3 size={11} />, label: 'Renomear', action: () => onRename(file) },
              { icon: <FolderInput size={11} />, label: 'Mover', action: () => onMove(file) },
              { icon: <Share2 size={11} />, label: 'Compartilhar', action: () => onShare(file) },
              { icon: <Trash2 size={11} />, label: 'Excluir', action: () => onDelete(file), danger: true },
            ].map(({ icon, label, action, danger }: any) => (
              <button key={label}
                onClick={(e) => { e.stopPropagation(); action(); setActiveMenu(null); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] tracking-wider uppercase transition-colors"
                style={{ color: danger ? 'rgba(200,80,80,0.9)' : 'rgba(184,148,76,0.8)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,0,0,0.15)')}
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

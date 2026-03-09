/**
 * FileItem — Variante 4: SCRIPTORIUM
 * Estética: Manuscritos medievais iluminados. Cada card é uma página de pergaminho
 * com inicial decorada, borda de vitral e texto em caligrafia gótica.
 * Pastas: capítulos com letras capitulares iluminadas.
 * Arquivos: fólios com rubricas vermelhas.
 * Fonte: UnifrakturMaguntia + IM Fell English
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

// Cores de vitral medieval baseadas no id
const STAINED_GLASS = [
  { border: '#1a3a5c', glow: 'rgba(40,90,180,0.3)', accent: '#4a7fc4' },   // azul safira
  { border: '#3a1a1a', glow: 'rgba(180,40,40,0.3)', accent: '#c44a4a' },   // vermelho rubi
  { border: '#1a3a1a', glow: 'rgba(40,160,60,0.25)', accent: '#4ab464' },  // verde esmeralda
  { border: '#3a2a0a', glow: 'rgba(200,150,20,0.3)', accent: '#c8a020' },  // âmbar
  { border: '#2a1a3a', glow: 'rgba(130,40,180,0.3)', accent: '#9040c8' },  // ametista
];

function stainedGlass(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 11 + id.charCodeAt(i)) & 0xff;
  return STAINED_GLASS[h % STAINED_GLASS.length];
}

function capitalLetter(name: string): string {
  return name.charAt(0).toUpperCase() || 'S';
}

// Símbolo medieval para tipo de arquivo
function medievalSymbol(mimeType: string, name: string): string {
  if (mimeType === MIME_TYPES.FOLDER) return '☩'; // Cruz
  if (name.endsWith('.mindmap')) return '✦'; // Estrela
  if (mimeType === MIME_TYPES.PDF) return '☽'; // Lua
  return '✧'; // Estrela menor
}

export const FileItem: React.FC<FileItemProps> = ({
  file, onSelect, onTogglePin, onDelete, onShare, onMove, onRename,
  isOffline, isPinned, isActiveMenu, setActiveMenu, isExpanding
}) => {
  const isFolder = file.mimeType === MIME_TYPES.FOLDER;
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const glass = stainedGlass(file.id);
  const capital = capitalLetter(file.name);
  const symbol = medievalSymbol(file.mimeType, file.name);
  const displayName = file.name.length > 32 ? file.name.slice(0, 30) + '…' : file.name;

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
        @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=UnifrakturMaguntia&family=MedievalSharp&display=swap');
        .scriptorium-card {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s ease;
        }
        .scriptorium-card:hover {
          transform: translateY(-5px);
          filter: brightness(1.08);
        }
        @keyframes scribe-flicker {
          0%,95%,100% { opacity: 1 }
          97% { opacity: 0.7 }
        }
        .capital-letter { animation: scribe-flicker 6s ease-in-out infinite; }
        .vitral-corner {
          position: absolute;
          width: 12px;
          height: 12px;
          border-style: solid;
        }
      `}</style>

      <button
        onClick={() => onSelect(file)}
        className="scriptorium-card w-full text-left overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #f5f0e8 0%, #ede5d0 40%, #e8dfc4 100%)',
          border: `2px solid ${glass.border}`,
          borderRadius: '2px',
          boxShadow: hovered
            ? `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${glass.glow}, inset 0 0 30px rgba(0,0,0,0.04)`
            : `0 4px 16px rgba(0,0,0,0.3), inset 0 0 20px rgba(0,0,0,0.03)`,
          minHeight: '175px',
          position: 'relative',
        }}
      >
        {/* Bordas de vitral coloridas nos cantos */}
        {[
          { style: { top: 0, left: 0, borderTopColor: glass.accent, borderLeftColor: glass.accent, borderRightColor: 'transparent', borderBottomColor: 'transparent', borderWidth: '3px' } },
          { style: { top: 0, right: 0, borderTopColor: glass.accent, borderRightColor: glass.accent, borderLeftColor: 'transparent', borderBottomColor: 'transparent', borderWidth: '3px' } },
          { style: { bottom: 0, left: 0, borderBottomColor: glass.accent, borderLeftColor: glass.accent, borderTopColor: 'transparent', borderRightColor: 'transparent', borderWidth: '3px' } },
          { style: { bottom: 0, right: 0, borderBottomColor: glass.accent, borderRightColor: glass.accent, borderTopColor: 'transparent', borderLeftColor: 'transparent', borderWidth: '3px' } },
        ].map((c, i) => (
          <div key={i} className="vitral-corner" style={c.style as React.CSSProperties} />
        ))}

        {/* Textura de pergaminho */}
        <div className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg, transparent, transparent 24px,
              rgba(100,80,40,0.3) 24px, rgba(100,80,40,0.3) 25px
            )`,
          }}
        />

        {/* Margem lateral vermelha (rubrica medieval) */}
        <div className="absolute left-0 top-0 bottom-0 w-[1px]"
          style={{ background: 'rgba(160,40,40,0.4)', marginLeft: '28px' }} />

        <div className="relative z-10 p-4 pl-10">
          {/* Letra capitular iluminada */}
          <div className="float-left mr-2 mb-1">
            <div className="capital-letter w-12 h-12 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${glass.border}, ${glass.accent})`,
                border: `1px solid ${glass.accent}`,
                boxShadow: hovered ? `0 0 12px ${glass.glow}` : 'none',
                transition: 'box-shadow 0.3s',
              }}>
              <span style={{
                fontFamily: "'UnifrakturMaguntia', cursive",
                color: '#f5f0e8',
                fontSize: '26px',
                lineHeight: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}>{capital}</span>
            </div>
          </div>

          {/* Símbolo de tipo */}
          <div className="absolute top-3 right-3 text-lg"
            style={{ color: glass.accent, opacity: 0.7, fontFamily: 'serif' }}>
            {symbol}
          </div>

          {/* Nome do arquivo */}
          <p className="text-[13px] leading-snug mb-1"
            style={{
              fontFamily: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
              color: '#2a1a0a',
              fontWeight: isFolder ? 400 : 400,
              fontStyle: isFolder ? 'normal' : 'italic',
            }}>
            {displayName}
          </p>

          {/* Linha de texto decorativa */}
          <div className="clear-both mt-2 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: 'rgba(100,70,30,0.25)' }} />
            <span style={{ color: 'rgba(150,60,60,0.6)', fontSize: '10px', fontFamily: 'serif' }}>✦</span>
            <div className="h-px flex-1" style={{ background: 'rgba(100,70,30,0.25)' }} />
          </div>

          {/* Data em estilo de colofão */}
          {file.modifiedTime && (
            <p className="text-[9px] mt-2 text-center italic"
              style={{ fontFamily: "'IM Fell English', serif", color: 'rgba(140,60,60,0.7)', letterSpacing: '0.05em' }}>
              Anno Domini {new Date(file.modifiedTime).getFullYear()} — {new Date(file.modifiedTime).toLocaleDateString('pt-BR', { month: 'long' })}
            </p>
          )}

          {/* Indicadores */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            {isPinned && <div className="w-2 h-2 rounded-full" style={{ background: glass.accent, boxShadow: `0 0 4px ${glass.glow}` }} />}
            {isOffline && <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(60,160,80,0.8)' }} />}
          </div>
        </div>

        {isExpanding && (
          <div className="absolute inset-0 bg-[#f5f0e8]/80 flex items-center justify-center">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: glass.accent, borderTopColor: 'transparent' }} />
          </div>
        )}
      </button>

      {/* Menu */}
      <div ref={menuRef} className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveMenu(isActiveMenu ? null : file.id); }}
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          style={{ color: glass.accent, background: 'rgba(240,230,210,0.8)' }}
        >
          <MoreVertical size={13} />
        </button>

        {isActiveMenu && (
          <div className="absolute right-0 top-7 w-44 z-50 animate-in fade-in duration-150"
            style={{
              background: '#f5f0e8',
              border: `1px solid ${glass.border}`,
              borderRadius: '1px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              fontFamily: "'IM Fell English', serif",
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
                style={{ color: danger ? '#8B0000' : '#2a1a0a' }}
                onMouseEnter={e => (e.currentTarget.style.background = `${glass.glow}`)}
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
